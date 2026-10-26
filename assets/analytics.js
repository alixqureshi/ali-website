/* AI with Ali: GA4 traffic measurement, configured by the page's script tag. */
(function (window, document) {
  "use strict";

  var source = document.currentScript;
  var measurementId = source && source.getAttribute("data-measurement-id");
  if (
    !/^G-[A-Z0-9]+$/.test(measurementId || "") ||
    !/^(www\.)?aliqureshi\.co$/.test(window.location.hostname) ||
    window.navigator.globalPrivacyControl === true ||
    window.navigator.doNotTrack === "1" ||
    window["ga-disable-" + measurementId] === true ||
    window.aiWithAliAnalyticsLoaded
  ) return;
  window.aiWithAliAnalyticsLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + measurementId;
  document.head.appendChild(script);
})(window, document);
