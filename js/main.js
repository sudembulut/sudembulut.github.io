/* Marks the nav link of the section in view. Content is fully usable without this file. */

(function () {
  const links = new Map();
  document.querySelectorAll('.pill a[href^="#"]').forEach((a) => {
    const section = document.querySelector(a.getAttribute("href"));
    if (section) links.set(section, a);
  });
  if (!links.size || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.removeAttribute("aria-current"));
        links.get(entry.target).setAttribute("aria-current", "true");
      });
    },
    // A section counts as current while it crosses the band 40-50 % down the viewport.
    { rootMargin: "-40% 0px -50% 0px" }
  );
  links.forEach((_, section) => observer.observe(section));

  // The hero has no link of its own: clear the highlight when it is in view.
  const intro = document.getElementById("intro");
  if (intro) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) links.forEach((l) => l.removeAttribute("aria-current"));
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    ).observe(intro);
  }
})();
