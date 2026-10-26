(function (window, document) {
  "use strict";
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get("session_id");
  // Remove the checkout token and campaign parameters before loading any analytics.
  window.history.replaceState(null, "", window.location.pathname);
  // Keep refreshes useful within this tab without putting the token back in the
  // URL or retaining it in persistent local storage. Storage can be blocked.
  try {
    if (sessionId) window.sessionStorage.setItem("ai-with-ali-checkout", sessionId);
    else sessionId = window.sessionStorage.getItem("ai-with-ali-checkout");
  } catch (_) { /* The original redirect still works without tab storage. */ }
  var config = window.aiWithAliCheckout || {};
  var status = document.getElementById("booking-status");
  var title = document.getElementById("booking-title");
  var message = document.getElementById("booking-message");
  var retry = document.getElementById("booking-retry");
  var busy = false;

  function show(heading, text, canRetry) {
    title.textContent = heading;
    message.textContent = text;
    status.setAttribute("aria-busy", "false");
    retry.hidden = !canRetry;
  }

  function trackPurchase(payment) {
    if (payment.mode !== "live" || config.mode !== "live" ||
        !/^(www\.)?aliqureshi\.co$/.test(window.location.hostname) ||
        window.navigator.globalPrivacyControl === true ||
        window.navigator.doNotTrack === "1") return;
    // Best-effort per-browser deduplication. The stable order ID also lets GA4
    // deduplicate purchases and is ready for future Pixel/CAPI deduplication.
    // It is a one-way hash, never the checkout token or buyer contact details.
    var key = "ai-with-ali-purchase:" + payment.transaction_id;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch (_) { return; }
    if (window["ga-disable-G-D74XK8FM1T"] !== true) {
      var ga = document.createElement("script");
      ga.src = "/assets/analytics.js";
      ga.setAttribute("data-measurement-id", "G-D74XK8FM1T");
      ga.onload = function () {
        if (typeof window.gtag === "function") window.gtag("event", "purchase", {
          transaction_id: payment.transaction_id, value: payment.value,
          currency: payment.currency, items: [{ item_id: "build-your-ai-brain", item_name: "Build your AI brain", quantity: 1 }]
        });
      };
      document.head.appendChild(ga);
    }
    var pixel = document.createElement("script");
    pixel.src = "/assets/meta-pixel.js";
    pixel.onload = function () {
      if (typeof window.fbq === "function") window.fbq("trackSingle", "1167132298977136", "Purchase",
        { value: payment.value, currency: payment.currency, content_ids: ["build-your-ai-brain"], content_type: "product" },
        { eventID: payment.event_id });
    };
    document.head.appendChild(pixel);
  }

  async function check() {
    if (busy) return;
    if (!/^cs_(test|live)_[A-Za-z0-9]{8,240}$/.test(sessionId || "")) {
      show("No payment to check", "Open the confirmation link from your Stripe checkout. Visiting this page does not reserve a seat.", false);
      return;
    }
    var endpoint;
    try {
      endpoint = new URL(config.statusEndpoint);
      var local = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
      if (endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:" &&
          (endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost"))) throw new Error();
    } catch (_) {
      show("Payment check is not available yet", "Booking is not open. If you have already paid, contact Ali with your Stripe receipt so he can check the payment directly.", false);
      return;
    }
    busy = true;
    retry.hidden = true;
    status.setAttribute("aria-busy", "true");
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 12000);
    try {
      endpoint.searchParams.set("session_id", sessionId);
      var response = await window.fetch(endpoint.href, { cache: "no-store", credentials: "omit",
        referrerPolicy: "no-referrer", signal: controller.signal });
      if (!response.ok && response.status !== 404) throw new Error();
      var payment = await response.json();
      if (payment.status === "paid") {
        if (payment.mode !== config.mode || !/^(test|live)$/.test(payment.mode) ||
            !/^order_[a-f0-9]{32}$/.test(payment.transaction_id) || payment.event_id !== payment.transaction_id ||
            !Number.isFinite(payment.value) || payment.value <= 0 || payment.currency !== "USD") throw new Error();
        if (payment.mode === "test") {
          show("Test payment confirmed", "This was a Stripe test. No money was charged and no workshop seat was booked.", false);
        } else {
          show("Payment confirmed", "Stripe confirms your workshop payment. Keep your Stripe receipt. Ali will send your joining instructions separately; this page does not confirm that an invitation has been sent.", false);
          trackPurchase(payment);
        }
      } else if (payment.status === "pending") {
        show("Your payment is still processing", "We have not confirmed payment yet. Check again shortly. Avoid paying a second time while Stripe is processing your first payment.", true);
      } else if (payment.status === "refunded") {
        show("A refund was recorded", "Stripe shows a refund against this payment. Contact Ali to confirm your booking status.", false);
      } else if (payment.status === "expired" || payment.status === "not_found") {
        show("Payment could not be confirmed", "This checkout is expired or does not match this workshop. If you have a Stripe receipt, contact Ali before trying another payment.", false);
      } else throw new Error();
    } catch (_) {
      show("We could not check your payment", "The payment check is temporarily unavailable. Check again, or contact Ali with your Stripe receipt. Do not pay again just because this page could not confirm your payment.", true);
    } finally {
      busy = false;
      window.clearTimeout(timeout);
      status.setAttribute("aria-busy", "false");
    }
  }
  retry.addEventListener("click", check);
  check();
})(window, document);
