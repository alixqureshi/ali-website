// aliqureshi.co: motion and small interactions. No build step.
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Smooth scrolling (Lenis, loaded from the CDN before this file)
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
    var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // In-page links (e.g. "Apply" jumps to the form)
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      var el = id.length > 1 && document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: -90, duration: 1.4 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      var first = el.querySelector("input, textarea, select");
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, reduce ? 0 : 1200);
    });
  });

  // Nav: a soft highlight that slides to whichever link you hover
  var pill = document.querySelector(".pill");
  if (pill) {
    var hover = document.createElement("span");
    hover.className = "nav-hover";
    pill.prepend(hover);
    var place = function (link) {
      var p = pill.getBoundingClientRect();
      var r = link.getBoundingClientRect();
      hover.style.width = r.width + "px";
      hover.style.transform = "translateX(" + (r.left - p.left) + "px)";
    };
    pill.querySelectorAll(".nav-link:not(.nav-cta)").forEach(function (link) {
      link.addEventListener("mouseenter", function () {
        if (hover.style.opacity !== "1") {
          hover.style.transition = "none";
          place(link);
          hover.offsetWidth; // apply position before fading in
          hover.style.transition = "";
        } else {
          place(link);
        }
        hover.style.opacity = link.getAttribute("aria-current") === "page" ? "0" : "1";
      });
    });
    pill.addEventListener("mouseleave", function () { hover.style.opacity = "0"; });
  }

  // Split opener text into words so it can reveal word by word
  var delayStep = 34;
  document.querySelectorAll("[data-split]").forEach(function (root) {
    var i = 0;
    var start = parseInt(root.getAttribute("data-split"), 10) || 0;
    var wrap = function (node) {
      var s = document.createElement("span");
      s.className = "w";
      s.style.setProperty("--d", start + i++ * delayStep + "ms");
      return s;
    };
    var walk = function (el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/([ \t\n\r]+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = wrap();
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          if (n.matches("img, a, .tile, [data-unit]")) {
            var s = wrap();
            n.replaceWith(s);
            s.appendChild(n);
          } else {
            walk(n);
          }
        }
      });
    };
    walk(root);
  });

  // Reveal on load (above the fold) and on scroll
  var items = document.querySelectorAll(".rv, [data-split]");
  var show = function (el) { el.classList.add("is-in"); };
  var revealAll = /[?&]reveal\b/.test(location.search);
  window.addEventListener("beforeprint", function () { items.forEach(show); });
  if (reduce || revealAll || !("IntersectionObserver" in window)) {
    items.forEach(show);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { items.forEach(function (el) { io.observe(el); }); });
    });
  }

  // Questions
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    btn.setAttribute("aria-expanded", item.classList.contains("is-open") ? "true" : "false");
    btn.addEventListener("click", function () {
      var open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });


  // Hover cards: a short line about the photo and each logo.
  // Mouse: hover. Keyboard: focus. Touch: first tap shows it, second tap follows the link.
  var tipped = document.querySelectorAll("[data-tip]");
  if (tipped.length) {
    var tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    var current = null;
    var hideTimer = null;

    // Sits off the top-right corner like a speech bubble; flips left near the edge.
    var position = function (el) {
      var r = el.getBoundingClientRect();
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var left = r.right + tw + 12 > window.innerWidth;
      var x = left ? r.left - tw + 4 : r.right - 4;
      var y = Math.max(8, r.top - th + 2);
      tip.classList.toggle("is-left", left);
      tip.style.setProperty("--x", Math.round(x) + "px");
      tip.style.setProperty("--y", Math.round(y) + "px");
    };

    var showTip = function (el) {
      clearTimeout(hideTimer);
      var wasOn = tip.classList.contains("is-on");
      tip.innerHTML = "";
      var t = el.getAttribute("data-tip-title");
      if (t) { var b = document.createElement("b"); b.textContent = t; tip.appendChild(b); }
      tip.appendChild(document.createTextNode(el.getAttribute("data-tip")));
      if (!wasOn) { tip.style.transition = "none"; position(el); tip.offsetWidth; tip.style.transition = ""; }
      else position(el);
      tip.classList.add("is-on");
      current = el;
    };
    var hideTip = function (delay) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { tip.classList.remove("is-on"); current = null; }, delay || 0);
    };

    tipped.forEach(function (el) {
      el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") showTip(el); });
      el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideTip(80); });
      el.addEventListener("focus", function () { showTip(el); });
      el.addEventListener("blur", function () { hideTip(0); });
      el.addEventListener("click", function (e) {
        if (window.matchMedia("(hover: hover)").matches) return;
        if (current !== el) { e.preventDefault(); showTip(el); }
      });
    });
    document.addEventListener("pointerdown", function (e) {
      if (current && !current.contains(e.target)) hideTip(0);
    });
    window.addEventListener("scroll", function () { if (current) hideTip(0); }, { passive: true });
    window.addEventListener("resize", function () { if (current) position(current); });
  }

  // Price card: light follows the cursor
  document.querySelectorAll(".price").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - r.left + "px");
      card.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  // Selects: show white text once something is picked
  document.querySelectorAll("select.field").forEach(function (s) {
    s.addEventListener("change", function () { s.classList.toggle("has-value", !!s.value); });
  });

  // Forms post to the site's Worker, which emails Ali. If that fails (or
  // the site is opened locally), fall back to opening an email instead.
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var trap = document.createElement("input");
    trap.type = "text"; trap.name = "website"; trap.tabIndex = -1;
    trap.autocomplete = "off"; trap.className = "sr-only"; trap.setAttribute("aria-hidden", "true");
    form.appendChild(trap);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = new FormData(form);
      var subject = form.getAttribute("data-subject") || "Website enquiry";
      data.append("_subject", subject);
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : "";
      var done = function () { form.classList.add("is-sent"); };
      var fallback = function () {
        var lines = [];
        data.forEach(function (v, k) { if (v && k.charAt(0) !== "_" && k !== "website") lines.push(k + ": " + v); });
        window.location.href =
          "mailto:hello@aliqureshi.co?subject=" + encodeURIComponent(subject) +
          "&body=" + encodeURIComponent(lines.join("\n\n"));
        done();
      };

      var endpoint = form.getAttribute("data-endpoint");
      if (!endpoint || location.protocol === "file:") return fallback();
      if (btn) { btn.disabled = true; btn.textContent = "Sending\u2026"; }
      fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          fallback();
        });
    });
  });
})();
