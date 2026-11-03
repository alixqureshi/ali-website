/* Site v2: the booking link and the mobile menu. */
(function () {
  "use strict";

  // One place to change where every "Book a call" button goes.
  // There is no Cal.com or Calendly link yet, so calls are booked by email from /contact/.
  // When a booking link exists, set it here (for example "https://cal.com/...") and every
  // [data-book-call] link on the site will use it.
  var BOOK_CALL_URL = "/contact/";

  var external = /^https?:\/\//.test(BOOK_CALL_URL);
  var onTarget = !external && location.pathname === BOOK_CALL_URL;
  document.querySelectorAll("[data-book-call]").forEach(function (link) {
    link.href = onTarget ? "#book" : BOOK_CALL_URL;
    if (external) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  });
  // On /contact/ the booking action is an email until a booking link exists.
  if (external) {
    document.querySelectorAll("[data-book-call-email]").forEach(function (link) {
      link.href = BOOK_CALL_URL;
      link.target = "_blank";
      link.rel = "noopener";
    });
  }

  var button = document.querySelector(".v2-menu-btn");
  var nav = document.getElementById("v2-nav");
  if (!button || !nav) return;
  var label = button.querySelector(".v2-menu-label");

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    if (label) label.textContent = open ? "Close" : "Menu";
  }

  button.addEventListener("click", function () {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", function (event) {
    if (
      nav.classList.contains("is-open") &&
      !nav.contains(event.target) &&
      !button.contains(event.target)
    )
      setOpen(false);
  });
  matchMedia("(min-width: 1024px)").addEventListener("change", function (m) {
    if (m.matches) setOpen(false);
  });
})();
