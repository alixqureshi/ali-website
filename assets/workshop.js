/* Build your AI brain workshop page: booking switch and the before/after chat. */
(() => {
  // Booking switch. Leave empty until checkout is live; the buttons then link
  // to the waitlist. Paste the payment link here to open bookings.
  const CHECKOUT_URL = "https://buy.stripe.com/aFa9ATeBJgSg4SUgOG24004";

  // Pass Meta's browser IDs to Stripe as client_reference_id, so the
  // server-side Purchase (meta-capi on Railway) can be matched to the ad click.
  // Payment links only accept letters, digits, dashes and underscores:
  //   a1-<fbp version>-<fbp time>-<fbp random>-<fbc version>-<fbc time>-<fbclid>
  // Opted-out visitors send "optout" and the server skips their Purchase.
  const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
  const cookie = (name) =>
    (document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)) || [])[1] || "";
  const stripeRef = () => {
    if (optedOut) return "optout";
    const p = /^fb\.(\d)\.(\d+)\.(\d+)$/.exec(cookie("_fbp")) || [];
    let c = /^fb\.(\d)\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(cookie("_fbc"));
    const fbclid = new URLSearchParams(location.search).get("fbclid");
    if (!c && fbclid && /^[A-Za-z0-9_-]+$/.test(fbclid)) c = [, "1", String(Date.now()), fbclid];
    c = c || [];
    const join = (parts) => ["a1", ...parts].map((v) => v || "").join("-");
    const ref = join([p[1], p[2], p[3], c[1], c[2], c[3]]);
    if (!p[1] && !c[1]) return "";
    return ref.length <= 200 ? ref : join([p[1], p[2], p[3]]);
  };

  if (CHECKOUT_URL) {
    for (const a of document.querySelectorAll("[data-book]")) {
      // The page HTML carries the button labels; only the link is set here.
      a.href = CHECKOUT_URL;
      // Read the cookies at click time: the pixel sets _fbp after the page loads.
      const withRef = () => {
        const url = new URL(CHECKOUT_URL);
        const ref = stripeRef();
        if (ref) url.searchParams.set("client_reference_id", ref);
        a.href = url.toString();
      };
      a.addEventListener("click", withRef);
      a.addEventListener("auxclick", withRef);
    }
    for (const p of document.querySelectorAll("[data-prebooking]")) p.remove();
  }

  const section = document.querySelector(".ba");
  if (!section) return;

  const PASTE =
    "We’re a 12 person agency. We help software teams with ads. Our tone is friendly but…";
  const ASK = "Write a follow up to today’s call with Sarah.";
  const GENERIC =
    "Hi Sarah, I hope this email finds you well. Thank you for taking the time to speak with me today. It was great to learn more about your business and goals. Please let me know if you have any questions.";
  const GOOD =
    "Hi Sarah, thanks for today. You said the goal is 20 new ads tested a month without another hire. Our Growth plan covers that for $4,000 a month. Shall I send the proposal over by Thursday?";
  const FILES = ["offer.md", "voice.md", "call notes"];

  const sides = {};
  for (const win of section.querySelectorAll(".ba-win")) {
    sides[win.dataset.side] = {
      thread: win.querySelector(".ba-thread"),
      field: win.querySelector(".ba-field"),
      points: [...win.querySelectorAll(".ba-points li")],
    };
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let run = 0;

  const sleep = (ms, id) =>
    new Promise((resolve, reject) =>
      setTimeout(() => (id === run ? resolve() : reject("stopped")), ms),
    );
  const el = (cls, html) => {
    const d = document.createElement("div");
    d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  };
  const idle = (s) => (s.field.innerHTML = '<span class="ba-ph">Message…</span>');
  const reset = () => {
    for (const s of Object.values(sides)) {
      s.thread.innerHTML = "";
      s.points.forEach((p) => p.classList.remove("is-on"));
      idle(s);
    }
  };
  const send = (s, html) => {
    s.thread.append(el("ba-msg ba-user", html));
    idle(s);
  };
  const reply = (text) => `<div class="ba-dot">AI</div><div class="ba-text">${text}</div>`;

  async function type(s, text, id) {
    s.field.innerHTML = "";
    const t = document.createElement("span");
    s.field.append(t, el("ba-caret"));
    for (const ch of text) {
      t.textContent += ch;
      await sleep(28, id);
    }
    await sleep(250, id);
  }
  async function typing(s, ms, id) {
    const t = el(
      "ba-msg ba-ai",
      '<div class="ba-dot">AI</div><div class="ba-typing"><b></b><b></b><b></b></div>',
    );
    s.thread.append(t);
    await sleep(ms, id);
    t.remove();
  }
  async function stream(s, text, id) {
    const m = el("ba-msg ba-ai", reply(""));
    s.thread.append(m);
    const box = m.querySelector(".ba-text");
    for (const w of text.split(" ")) {
      box.textContent += (box.textContent ? " " : "") + w;
      await sleep(55, id);
    }
  }
  async function points(s, id) {
    for (const p of s.points) {
      p.classList.add("is-on");
      await sleep(320, id);
    }
  }
  async function tools(s, id) {
    const row = el("ba-msg ba-tools");
    s.thread.append(row);
    for (const f of FILES) {
      const chip = el("ba-tool", `<span>◌</span>Reading ${f}`);
      row.append(chip);
      await sleep(380, id);
      chip.classList.add("is-done");
      chip.firstChild.textContent = "✓";
    }
    await sleep(250, id);
  }

  function finalState() {
    run++;
    reset();
    const b = sides.before;
    const a = sides.after;
    send(b, `<span class="ba-paste">${PASTE}</span>${ASK}`);
    b.thread.append(el("ba-msg ba-ai", reply(GENERIC)));
    send(a, ASK);
    a.thread.append(
      el(
        "ba-msg ba-tools",
        FILES.map((f) => `<div class="ba-tool is-done"><span>✓</span>Reading ${f}</div>`).join(""),
      ),
    );
    a.thread.append(el("ba-msg ba-ai", reply(GOOD)));
    [...b.points, ...a.points].forEach((p) => p.classList.add("is-on"));
  }

  async function play() {
    const id = ++run;
    reset();
    try {
      const b = sides.before;
      const a = sides.after;
      await sleep(500, id);
      // Before: paste the company paragraph, type the request, get a generic reply.
      b.field.textContent = PASTE;
      await sleep(700, id);
      await type(b, ASK, id);
      send(b, `<span class="ba-paste">${PASTE}</span>${ASK}`);
      await sleep(400, id);
      await typing(b, 1200, id);
      await stream(b, GENERIC, id);
      await sleep(300, id);
      await points(b, id);
      await sleep(900, id);
      // After: just the request. It reads the business files, then replies.
      await type(a, ASK, id);
      send(a, ASK);
      await sleep(350, id);
      await tools(a, id);
      await typing(a, 800, id);
      await stream(a, GOOD, id);
      await sleep(300, id);
      await points(a, id);
      await sleep(6000, id);
      play();
    } catch {
      // A newer run replaced this one.
    }
  }

  section.classList.add("is-animated");
  section
    .querySelector(".ba-replay")
    .addEventListener("click", () => (reduced ? finalState() : play()));
  if (reduced) {
    finalState();
    return;
  }
  finalState();
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        io.disconnect();
        play();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(section);
})();

// Show the session time in the visitor's own time zone. The HTML carries the UK time as the fallback.
(() => {
  const start = new Date("2026-11-19T16:00:00Z");
  const end = new Date("2026-11-19T18:00:00Z");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return;
  const label = zone === "Europe/London" ? "UK" : "your time";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(start);
  const time = (d) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const text = {
    long: `${day}, ${time(start)}–${time(end)} ${label}`,
    short: `${day} · ${time(start)} ${label}`,
    range: `${time(start)} to ${time(end)} ${label}`,
  };
  for (const el of document.querySelectorAll("[data-when]")) {
    if (text[el.dataset.when]) el.textContent = text[el.dataset.when];
  }
})();
