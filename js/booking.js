/* Booking panel drawn in the site's own style, backed by Cal.com's public API.
   Slots: GET  api.cal.com/v2/slots     (no key needed for a public event type)
   Book:  POST api.cal.com/v2/bookings  (Cal.com sends the invite and video link)
   Markup lives in #booking; config comes from its data-cal-user / data-cal-event. */

(function () {
  const root = document.getElementById("booking");
  if (!root) return;

  const API = "https://api.cal.com/v2";
  const USER = root.dataset.calUser;
  const EVENT = root.dataset.calEvent;
  const EMAIL = root.dataset.email;
  const MONTHS_AHEAD = 2;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";

  const TEXT = {
    en: {
      loading: "Loading available times…",
      pickDay: "Pick a day to see available times.",
      noSlots: "No free times on this day.",
      tz: (z) => `Times shown in ${z}`,
      chosen: (d) => `${d} · 30 min`,
      pickFirst: "Pick a day and time to continue.",
      sending: "Booking…",
      done: (d, e) => `You're booked for <strong>${d}</strong>. A calendar invite with the video link is on its way to <strong>${e}</strong>.`,
      taken: "That time was just taken — please pick another.",
      failed: "Something went wrong while booking. You can try again or email me instead.",
      unavailable: "The calendar isn't available right now. Email me and we'll find a time.",
      prev: "Previous month",
      next: "Next month",
    },
    tr: {
      loading: "Uygun saatler yükleniyor…",
      pickDay: "Uygun saatleri görmek için bir gün seç.",
      noSlots: "Bu günde boş saat yok.",
      tz: (z) => `Saatler ${z} saat dilimine göre`,
      chosen: (d) => `${d} · 30 dk`,
      pickFirst: "Devam etmek için bir gün ve saat seç.",
      sending: "Kaydediliyor…",
      done: (d, e) => `<strong>${d}</strong> için randevun alındı. Video bağlantısını içeren takvim daveti <strong>${e}</strong> adresine gönderiliyor.`,
      taken: "Bu saat az önce doldu — lütfen başka bir saat seç.",
      failed: "Randevu alınırken bir sorun oldu. Tekrar deneyebilir ya da bana e-posta atabilirsin.",
      unavailable: "Takvim şu an kullanılamıyor. Bana e-posta at, birlikte bir zaman bulalım.",
      prev: "Önceki ay",
      next: "Sonraki ay",
    },
  };

  const $ = (sel) => root.querySelector(sel);
  const toggle = $(".bk-toggle");
  const panel = $(".bk-panel");
  const monthLabel = $(".bk-month");
  const prevBtn = $(".bk-prev");
  const nextBtn = $(".bk-next");
  const dowRow = $(".bk-dow");
  const grid = $(".bk-days");
  const times = $(".bk-times");
  const tzLabel = $(".bk-tz");
  const form = $(".bk-form");
  const summary = $(".bk-summary");
  const status = $(".bk-status");
  const submit = form.querySelector('button[type="submit"]');

  const today = new Date();
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + MONTHS_AHEAD, 1);
  let month = new Date(firstMonth);
  let slots = {};          // "YYYY-MM-DD" -> [ISO start, ...]
  const fetched = new Set();
  let day = null;
  let slot = null;
  let loaded = false;

  const t = () => TEXT[window.i18n?.lang === "tr" ? "tr" : "en"];
  const locale = () => (window.i18n?.lang === "tr" ? "tr-TR" : "en-GB");
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function fmtDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: tz });
  }

  function fmtFull(iso) {
    return new Date(iso).toLocaleString(locale(), {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz,
    });
  }

  function setStatus(html, kind) {
    status.innerHTML = html || "";
    status.dataset.kind = kind || "";
  }

  // ---------- data ----------

  async function loadMonth(m) {
    const key = ymd(m);
    if (fetched.has(key)) return;
    const start = m < today ? today : m;
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const params = new URLSearchParams({
      username: USER,
      eventTypeSlug: EVENT,
      start: ymd(start),
      end: ymd(end),
      timeZone: tz,
    });
    const res = await fetch(`${API}/slots?${params}`, { headers: { "cal-api-version": "2024-09-04" } });
    if (!res.ok) throw new Error("slots " + res.status);
    const body = await res.json();
    Object.entries(body.data || {}).forEach(([d, list]) => {
      slots[d] = list.map((s) => s.start);
    });
    fetched.add(key);
  }

  async function book(name, email, notes) {
    const res = await fetch(`${API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cal-api-version": "2024-08-13" },
      body: JSON.stringify({
        start: new Date(slot).toISOString(),
        eventTypeSlug: EVENT,
        username: USER,
        attendee: { name, email, timeZone: tz, language: window.i18n?.lang === "tr" ? "tr" : "en" },
        bookingFieldsResponses: notes ? { notes } : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === "error") {
      const msg = JSON.stringify(body.error || body).toLowerCase();
      const err = new Error(msg);
      err.taken = /not available|already|taken|no available/.test(msg);
      throw err;
    }
    return body.data;
  }

  // ---------- rendering ----------

  function renderMonth() {
    monthLabel.textContent = month.toLocaleDateString(locale(), { month: "long", year: "numeric" });
    prevBtn.disabled = month <= firstMonth;
    nextBtn.disabled = month >= lastMonth;
    prevBtn.setAttribute("aria-label", t().prev);
    nextBtn.setAttribute("aria-label", t().next);

    // Monday-first weekday names in the current language (1 Jan 2024 was a Monday).
    dowRow.innerHTML = Array.from({ length: 7 }, (_, i) =>
      `<span>${new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: "short" })}</span>`
    ).join("");

    const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    let html = "<span></span>".repeat(offset);
    for (let d = 1; d <= days; d++) {
      const key = ymd(new Date(month.getFullYear(), month.getMonth(), d));
      const open = (slots[key] || []).length > 0;
      html += `<button type="button" class="bk-day" data-day="${key}" ${open ? "" : "disabled"}
        aria-pressed="${key === day}" aria-label="${fmtDay(key)}">${d}</button>`;
    }
    grid.innerHTML = html;
  }

  function renderTimes() {
    tzLabel.textContent = t().tz(tz);
    if (!loaded) {
      times.innerHTML = `<p class="bk-hint">${t().loading}</p>`;
      return;
    }
    if (!day) {
      times.innerHTML = `<p class="bk-hint">${t().pickDay}</p>`;
      return;
    }
    const list = slots[day] || [];
    times.innerHTML = list.length
      ? list.map((s) => `<button type="button" class="bk-time" data-slot="${s}" aria-pressed="${s === slot}">${fmtTime(s)}</button>`).join("")
      : `<p class="bk-hint">${t().noSlots}</p>`;
  }

  function renderSummary() {
    summary.textContent = slot ? t().chosen(fmtFull(slot)) : t().pickFirst;
    summary.classList.toggle("is-set", !!slot);
    submit.disabled = !slot;
  }

  function render() {
    renderMonth();
    renderTimes();
    renderSummary();
  }

  function unavailable() {
    root.classList.add("is-unavailable");
    setStatus(`${t().unavailable} <a href="mailto:${EMAIL}">${EMAIL}</a>`, "error");
  }

  async function showMonth() {
    render();
    try {
      await loadMonth(month);
      loaded = true;
      // Jump to the first open day of the month so there's something to click straight away.
      if (!day || !day.startsWith(ymd(month).slice(0, 7))) {
        day = Object.keys(slots).sort().find((k) => k.startsWith(ymd(month).slice(0, 7)) && slots[k].length) || null;
        slot = null;
      }
      render();
    } catch (e) {
      loaded = true;
      render();
      unavailable();
    }
  }

  // ---------- events ----------

  function open(state) {
    toggle.setAttribute("aria-expanded", String(state));
    panel.hidden = !state;
    if (state && !fetched.size) showMonth();
  }

  toggle?.addEventListener("click", () => open(toggle.getAttribute("aria-expanded") !== "true"));

  root.querySelectorAll(".bk-channel [data-channel]").forEach((b) => {
    b.addEventListener("click", () => {
      root.dataset.channel = b.dataset.channel;
      root.querySelectorAll(".bk-channel [data-channel]").forEach((o) =>
        o.setAttribute("aria-pressed", String(o === b))
      );
    });
  });

  prevBtn.addEventListener("click", () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    showMonth();
  });

  nextBtn.addEventListener("click", () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    showMonth();
  });

  grid.addEventListener("click", (e) => {
    const b = e.target.closest(".bk-day");
    if (!b || b.disabled) return;
    day = b.dataset.day;
    slot = null;
    setStatus("");
    render();
  });

  times.addEventListener("click", (e) => {
    const b = e.target.closest(".bk-time");
    if (!b) return;
    slot = b.dataset.slot;
    setStatus("");
    renderTimes();
    renderSummary();
    form.querySelector('[name="name"]').focus({ preventScroll: true });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!slot || !form.reportValidity()) return;
    const data = new FormData(form);
    submit.disabled = true;
    setStatus(t().sending, "info");
    try {
      await book(data.get("name").trim(), data.get("email").trim(), data.get("notes").trim());
      root.classList.add("is-booked");
      setStatus(t().done(fmtFull(slot), data.get("email").trim()), "success");
    } catch (err) {
      if (err.taken) {
        (slots[day] || []).splice((slots[day] || []).indexOf(slot), 1);
        slot = null;
        render();
        setStatus(t().taken, "error");
      } else {
        submit.disabled = false;
        setStatus(`${t().failed} <a href="mailto:${EMAIL}">${EMAIL}</a>`, "error");
      }
    }
  });

  window.i18n?.onChange(() => {
    if (!panel.hidden) render();
    if (root.classList.contains("is-unavailable")) unavailable();
  });

  // The standalone /book page opens the panel straight away.
  open(root.hasAttribute("data-open"));
})();
