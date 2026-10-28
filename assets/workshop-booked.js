/* Remove checkout identifiers before analytics loads. A redirect URL is not proof of payment. */
(function (window) {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  if (!params.has("session_id")) return;

  // Purchase is recorded only by meta-capi after Stripe verifies a paid session.
  // Never send Meta or Google purchase events from an unverified query string.
  params.delete("session_id");
  var query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
})(window);
