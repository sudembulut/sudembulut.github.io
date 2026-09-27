/* ASCII particle portrait.
   Particles start scattered and grey (noise), spring into place and turn blue (signal).
   The pointer pushes them away; displaced particles drift back to grey until they settle. */

(function () {
  const CHARS = " .:-=+*#%@";
  const NOISE = [85, 100, 122];   // --noise
  const SIGNAL = [111, 155, 255]; // --signal
  const GREY_AT = 20;             // px from target at which a particle is fully grey

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function sizeFor(width) {
    // keep a 16px gutter on each side on the narrowest phones
    if (width <= 480) return Math.min(320, width - 32);
    if (width <= 768) return 380;
    // two-column layout, but still too narrow for the full size beside the text
    if (width <= 1000) return 420;
    return 500;
  }

  function fontFor(size) {
    if (size <= 340) return 6;
    return size <= 420 ? 7 : 8;
  }

  // Turn the image into a grid of characters sized for a square canvas of `size` px.
  function sample(img, size) {
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const ctx = off.getContext("2d");

    const scale = 0.9;
    let h = size * scale;
    let w = h * (img.width / img.height);
    if (w > size * scale) {
      w = size * scale;
      h = w * (img.height / img.width);
    }
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    const px = ctx.getImageData(0, 0, size, size).data;

    const font = fontFor(size);
    const colGap = font * 0.7;
    const rowGap = font * 1.1;
    const points = [];
    for (let y = 0; y < size; y += rowGap) {
      for (let x = 0; x < size; x += colGap) {
        const i = (Math.floor(y) * size + Math.floor(x)) * 4;
        if (px[i + 3] > 128) {
          points.push({ x, y, b: (px[i] + px[i + 1] + px[i + 2]) / 765 });
        }
      }
    }

    // Stretch brightness so the 3rd-97th percentile spans the full character range.
    const sorted = points.map((p) => p.b).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.03)];
    const hi = sorted[Math.floor(sorted.length * 0.97)];
    const range = hi - lo || 1;

    return points.map((p) => {
      const b = Math.min(1, Math.max(0, (p.b - lo) / range));
      return {
        tx: p.x,
        ty: p.y,
        // Opaque pixels never map to the blank character, so dark hair keeps its outline.
        ch: CHARS[1 + Math.floor(b * (CHARS.length - 2))],
        alpha: 0.4 + b * 0.6,
      };
    });
  }

  function colourAt(dist) {
    const t = Math.min(1, dist / GREY_AT);
    const r = Math.round(SIGNAL[0] + (NOISE[0] - SIGNAL[0]) * t);
    const g = Math.round(SIGNAL[1] + (NOISE[1] - SIGNAL[1]) * t);
    const b = Math.round(SIGNAL[2] + (NOISE[2] - SIGNAL[2]) * t);
    return `${r},${g},${b}`;
  }

  function initPortrait(canvas) {
    const ctx = canvas.getContext("2d");
    const cache = {};
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false };
    let img = null;
    let size = 0;
    let particles = [];
    let startTime = 0;
    let frame = 0;

    function setup(withIntro) {
      size = sizeFor(window.innerWidth);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.height = Math.round(size * dpr);
      canvas.style.width = canvas.style.height = size + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cache[size] = cache[size] || sample(img, size);
      const spread = 400 * (size / 420);
      particles = cache[size].map((p) => ({
        ...p,
        x: withIntro ? p.tx + (Math.random() - 0.5) * spread : p.tx,
        y: withIntro ? p.ty + (Math.random() - 0.5) * spread : p.ty,
        vx: 0,
        vy: 0,
        delay: withIntro ? Math.random() * 0.4 : 0,
      }));
      startTime = performance.now() - (withIntro ? 0 : 10000);
    }

    function draw(elapsed) {
      const font = fontFor(size);
      ctx.clearRect(0, 0, size, size);
      ctx.font = `${font}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of particles) {
        const t = elapsed - p.delay;
        if (t < 0) continue;
        const fade = 1 - Math.pow(1 - Math.min(t / 1.5, 1), 2);
        const dist = Math.hypot(p.x - p.tx, p.y - p.ty);
        ctx.fillStyle = `rgba(${colourAt(dist)},${p.alpha * fade})`;
        ctx.fillText(p.ch, p.x, p.y);
      }
    }

    // Advance one frame; returns true while anything is still moving.
    function step(elapsed) {
      pointer.x += (pointer.tx - pointer.x) * 0.15;
      pointer.y += (pointer.ty - pointer.y) * 0.15;
      const reach = size * 0.2;
      let moving = false;

      for (const p of particles) {
        const t = elapsed - p.delay;
        if (t < 0) {
          moving = true;
          continue;
        }

        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < reach) {
            const force = (1 - d / reach) * 4;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        const eased = 1 - Math.pow(1 - Math.min(t / 2.5, 1), 3);
        const pull = 0.01 + eased * 0.08;
        p.vx = (p.vx + (p.tx - p.x) * pull) * (pointer.active || t < 3 ? 0.92 : 0.85);
        p.vy = (p.vy + (p.ty - p.y) * pull) * (pointer.active || t < 3 ? 0.92 : 0.85);
        p.x += p.vx;
        p.y += p.vy;

        if (Math.abs(p.x - p.tx) < 0.05 && Math.abs(p.y - p.ty) < 0.05 && Math.abs(p.vx) + Math.abs(p.vy) < 0.05) {
          p.x = p.tx;
          p.y = p.ty;
          p.vx = p.vy = 0;
        } else {
          moving = true;
        }
      }
      return moving || elapsed < 3 || pointer.active;
    }

    function loop() {
      const elapsed = (performance.now() - startTime) / 1000;
      const moving = step(elapsed);
      draw(elapsed);
      // Stop the loop once everything has settled; pointer input restarts it.
      frame = moving ? requestAnimationFrame(loop) : 0;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(loop);
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (!pointer.active) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.active = true;
      wake();
    }

    function onLeave() {
      pointer.active = false;
      pointer.tx = pointer.ty = -1e4;
    }

    img = new Image();
    img.onload = () => {
      canvas.classList.add("is-ready");
      if (reducedMotion) {
        setup(false);
        draw(10);
        window.addEventListener("resize", () => {
          if (sizeFor(window.innerWidth) !== size) {
            setup(false);
            draw(10);
          }
        });
        return;
      }

      setup(true);
      wake();
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerdown", onMove);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointercancel", onLeave);
      canvas.addEventListener("pointerup", (e) => {
        if (e.pointerType !== "mouse") onLeave();
      });
      window.addEventListener("resize", () => {
        if (sizeFor(window.innerWidth) !== size) {
          setup(false);
          wake();
        }
      });
    };
    img.src = canvas.dataset.src;
  }

  const canvas = document.getElementById("portrait");
  if (canvas) initPortrait(canvas);
})();
