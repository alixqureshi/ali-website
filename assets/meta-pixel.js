/* AI with Ali: explicit PageView tracking on the production marketing site. */
(function (window, document) {
  "use strict";

  if (
    !/^(www\.)?aliqureshi\.co$/.test(window.location.hostname) ||
    window.navigator.globalPrivacyControl === true ||
    window.navigator.doNotTrack === "1" ||
    window.aiWithAliPixelLoaded
  ) return;
  window.aiWithAliPixelLoaded = true;

  var pixelId = "1167132298977136";
  if (!window.fbq) {
    var fbq = (window.fbq = function () {
      fbq.callMethod
        ? fbq.callMethod.apply(fbq, arguments)
        : fbq.queue.push(arguments);
    });
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  // Track only explicit events; don't infer events from buttons or form fields.
  window.fbq("set", "autoConfig", false, pixelId);
  window.fbq("init", pixelId);
  window.fbq("trackSingle", pixelId, "PageView");
})(window, document);
