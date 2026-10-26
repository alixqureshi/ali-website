/* Booked page: record one Purchase per Stripe checkout session, then tidy the URL. */
(function (window, document) {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var session = params.get("session_id") || "";
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(session)) return;

  // Strip the session ID from the address bar so it isn't shared or bookmarked.
  params.delete("session_id");
  var query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);

  var key = "aiwa-purchase-" + session;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch (e) {
    // Storage blocked: the eventID still lets Meta deduplicate.
  }

  var value = { value: 97, currency: "USD" };
  if (window.fbq) {
    window.fbq(
      "trackSingle",
      "1167132298977136",
      "Purchase",
      { value: 97, currency: "USD", content_name: "Build your AI brain", content_type: "product" },
      { eventID: session }
    );
  }
  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: session,
      value: value.value,
      currency: value.currency,
      items: [{ item_id: "build-your-ai-brain", item_name: "Build your AI brain", price: 97, quantity: 1 }]
    });
  }
})(window, document);
