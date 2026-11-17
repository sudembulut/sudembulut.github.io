/* ASCII particle portrait on the light (Kemik) background.
   Particles fade and spring in once, the pointer gently pushes them, they settle.
   Ink is Gece; a fixed ~3 % of points are Alarm red. No colour transitions. */

(function () {
  const CHARS = " .:-=+*#%@";
  const INK = "#170F10";
  const ALARM = "#E8392C";
  const ALARM_PERCENT = 3;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The canvas fills the hero's right column; height follows the viewport.
  function boxFor(canvas) {
    const w = Math.max(200, Math.round(canvas.parentElement.clientWidth));
    const narrow = window.innerWidth <= 800;
    // Narrow: height depends on width only, so mobile toolbar collapse never changes it.
    const h = narrow ? Math.round(w * 1.25) : Math.round(Math.min(window.innerHeight * 0.8, 760, w * 1.35));
    return { w, h, font: narrow ? (w <= 360 ? 6 : 7) : (w <= 520 ? 8 : 9) };
  }

  function debounce(fn, ms) {
    let t = 0;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // Turn the image into a grid of characters for a w×h canvas.
  function sample(img, w, h, font) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");

    const scale = 0.96;
    let dh = h * scale;
    let dw = dh * (img.width / img.height);
    if (dw > w * scale) {
      dw = w * scale;
      dh = dw * (img.height / img.width);
    }
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const px = ctx.getImageData(0, 0, w, h).data;

    const colGap = font * 0.7;
    const rowGap = font * 1.1;
    const points = [];
    for (let y = 0; y < h; y += rowGap) {
      for (let x = 0; x < w; x += colGap) {
        const i = (Math.floor(y) * w + Math.floor(x)) * 4;
        if (px[i + 3] > 128) points.push({ x, y, b: (px[i] + px[i + 1] + px[i + 2]) / 765 });
      }
    }

    // Stretch brightness so the 3rd-97th percentile spans the full range.
    const sorted = points.map((p) => p.b).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.03)];
    const hi = sorted[Math.floor(sorted.length * 0.97)];
    const range = hi - lo || 1;

    return points.map((p, i) => {
      const v = Math.min(1, Math.max(0, (p.b - lo) / range));
      const d = Math.pow(1 - v, 0.6); // darkness: dark pixels -> dense glyphs
      return {
        tx: p.x,
        ty: p.y,
        ch: CHARS[2 + Math.round(d * 7)], // never blank, so the outline survives
        alpha: 0.72 + 0.28 * d,
        red: ((i * 2654435761) >>> 0) % 100 < ALARM_PERCENT, // fixed, not random per frame
      };
    });
  }

  function initPortrait(canvas) {
    const ctx = canvas.getContext("2d");
    const cache = {};
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false };
    let img = null;
    let box = { w: 0, h: 0, font: 8 };
    let particles = [];
    let startTime = 0;
    let frame = 0;

    function setup(withIntro) {
      box = boxFor(canvas);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.w * dpr);
      canvas.height = Math.round(box.h * dpr);
      canvas.style.width = box.w + "px";
      canvas.style.height = box.h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const key = `${box.w}x${box.h}`;
      if (!cache[key]) {
        Object.keys(cache).forEach((k) => delete cache[k]); // keep only the current size
        cache[key] = sample(img, box.w, box.h, box.font);
      }
      const spread = 400 * (box.w / 420);
      particles = cache[key].map((p) => ({
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
      ctx.clearRect(0, 0, box.w, box.h);
      ctx.font = `${box.font}px "DM Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of particles) {
        const t = elapsed - p.delay;
        if (t < 0) continue;
        const fade = 1 - Math.pow(1 - Math.min(t / 1.5, 1), 2);
        ctx.globalAlpha = p.alpha * fade;
        ctx.fillStyle = p.red ? ALARM : INK;
        ctx.fillText(p.ch, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }

    // Advance one frame; returns true while anything is still moving.
    function step(elapsed) {
      pointer.x += (pointer.tx - pointer.x) * 0.15;
      pointer.y += (pointer.ty - pointer.y) * 0.15;
      const reach = box.w * 0.2;
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
      // Stop once everything has settled; pointer input restarts it.
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

    function resized() {
      const next = boxFor(canvas);
      return next.w !== box.w || next.h !== box.h;
    }

    function start() {
      canvas.classList.add("is-ready");
      if (reducedMotion) {
        setup(false);
        draw(10);
        window.addEventListener("resize", debounce(() => {
          if (resized()) {
            setup(false);
            draw(10);
          }
        }, 150));
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
      window.addEventListener("resize", debounce(() => {
        if (resized()) {
          setup(false);
          wake();
        }
      }, 150));
    }

    img = new Image();
    img.onload = () => {
      // Wait for DM Mono so glyph widths match the sampling grid.
      const fonts = document.fonts ? document.fonts.load('9px "DM Mono"').catch(() => {}) : Promise.resolve();
      fonts.then(start);
    };
    img.src = canvas.dataset.src;
  }

  const canvas = document.getElementById("portrait");
  if (canvas) initPortrait(canvas);
})();
