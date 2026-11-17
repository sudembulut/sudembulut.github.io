/* Header contrast: the logo, the menu pill and (on phones) the header bar switch
   to light-on-dark whenever the part of the page underneath them is dark. */

(function () {
  const nav = document.querySelector(".site-nav");
  if (!nav || !document.elementsFromPoint) return;

  const parts = [nav.querySelector(".brand"), nav.querySelector(".pill")].filter(Boolean);
  const GECE = [23, 15, 16];
  const KEMIK = [247, 238, 232];

  function luminance(rgb) {
    const [r, g, b] = rgb.map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Background colour of the page content (not the header) at a viewport point.
  function backgroundAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (nav.contains(el)) continue;
      for (let n = el; n; n = n.parentElement) {
        const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) > 0.5)) return m.slice(0, 3).map(Number);
      }
      break;
    }
    return KEMIK;
  }

  // Light text reads better than dark text on this background.
  const isDark = (rgb) => contrast(rgb, KEMIK) > contrast(rgb, GECE);

  let frame = 0;

  function update() {
    frame = 0;
    parts.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.classList.toggle("is-inverted", isDark(backgroundAt(r.left + r.width / 2, r.top + r.height / 2)));
    });
    const bar = nav.getBoundingClientRect();
    nav.classList.toggle("is-dark", isDark(backgroundAt(bar.left + bar.width / 2, bar.bottom - 2)));
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
})();
