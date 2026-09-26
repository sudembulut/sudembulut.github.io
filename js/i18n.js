/* English is the page's own markup; Turkish comes from js/lang-tr.js.
   Elements opt in with data-i18n="key" (innerHTML) and data-i18n-attr="attr:key;attr:key".
   Choice is kept in localStorage and can be forced with ?lang=tr / ?lang=en. */

(function () {
  const LANGS = ["en", "tr"];
  const listeners = [];
  const english = new Map();
  const englishAttrs = new Map();

  function stored() {
    try { return localStorage.getItem("lang"); } catch (e) { return null; }
  }

  function store(lang) {
    try { localStorage.setItem("lang", lang); } catch (e) { /* private mode: not remembered */ }
  }

  const fromUrl = new URLSearchParams(location.search).get("lang");
  let lang = LANGS.includes(fromUrl) ? fromUrl : LANGS.includes(stored()) ? stored() : "en";

  function dict() {
    return lang === "tr" ? window.LANG_TR || {} : {};
  }

  function apply() {
    const tr = dict();
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (!english.has(el)) english.set(el, el.innerHTML);
      el.innerHTML = tr[key] ?? english.get(el);
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        const id = key + "@" + attr;
        if (!englishAttrs.has(el)) englishAttrs.set(el, {});
        const saved = englishAttrs.get(el);
        if (!(id in saved)) saved[id] = el.getAttribute(attr) || "";
        el.setAttribute(attr, tr[key] ?? saved[id]);
      });
    });

    document.querySelectorAll(".lang-toggle [data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    listeners.forEach((fn) => fn(lang));
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    store(lang);
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    }
    apply();
  }

  window.i18n = {
    get lang() { return lang; },
    set,
    onChange(fn) { listeners.push(fn); },
  };

  document.querySelectorAll(".lang-toggle [data-lang]").forEach((b) => {
    b.addEventListener("click", () => set(b.dataset.lang));
  });

  apply();
})();
