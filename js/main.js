/* Tabs, active nav link and reveal-on-scroll. Content is fully readable without this file. */

(function () {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- tabs (WAI-ARIA pattern, used by Experience and Community) ----------

  document.querySelectorAll("[data-tabs]").forEach((root) => {
    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    root.classList.add("is-enhanced");

    function select(index, focus) {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      root.style.setProperty("--active", index);
      if (focus) tabs[index].focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i, false));
      tab.addEventListener("keydown", (e) => {
        const last = tabs.length - 1;
        const next = {
          ArrowDown: i === last ? 0 : i + 1,
          ArrowRight: i === last ? 0 : i + 1,
          ArrowUp: i === 0 ? last : i - 1,
          ArrowLeft: i === 0 ? last : i - 1,
          Home: 0,
          End: last,
        }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(next, true);
      });
    });

    select(Math.max(0, tabs.findIndex((t) => t.getAttribute("aria-selected") === "true")), false);
  });

  // ---------- active nav link ----------

  const links = new Map();
  document.querySelectorAll('.nav a[href^="#"]').forEach((a) => {
    const section = document.querySelector(a.getAttribute("href"));
    if (section) links.set(section, a);
  });

  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = links.get(entry.target);
        if (entry.isIntersecting) {
          links.forEach((l) => l.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "true");
        }
      });
    },
    // A section counts as current while it crosses the band 40-50 % down the viewport.
    { rootMargin: "-40% 0px -50% 0px" }
  );
  links.forEach((_, section) => navObserver.observe(section));

  // ---------- reveal on scroll ----------

  if (reducedMotion) return;
  const hidden = document.querySelectorAll(".reveal");
  document.documentElement.classList.add("can-reveal");
  const revealObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  hidden.forEach((el) => revealObserver.observe(el));
})();
