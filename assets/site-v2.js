/* Site v2: the booking link, the contact form and the mobile menu. */
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

  // The contact form posts to the enquiry Worker (workers/enquiry), which saves each
  // enquiry to Notion. Until the Worker is deployed this is empty and the form opens an
  // email draft instead, so no enquiry is lost.
  var ENQUIRY_ENDPOINT = "";

  var enquiry = document.querySelector("[data-enquiry-form]");
  if (enquiry) setUpEnquiry(enquiry);

  function setUpEnquiry(form) {
    var steps = form.querySelectorAll(".v2-enq-step");
    var back = form.querySelector("[data-enq-back]");
    var next = form.querySelector("[data-enq-next]");
    var status = form.querySelector(".form-status");
    var done = document.querySelector("[data-enq-done]");
    var current = 0;
    // Each step is checked on its own, so the browser must not block on the hidden step.
    form.noValidate = true;

    function show(index) {
      current = index;
      steps.forEach(function (step, i) {
        step.classList.toggle("is-current", i === index);
      });
      back.hidden = index === 0;
      next.textContent = index === steps.length - 1 ? "Send" : "Continue";
    }

    function stepIsValid(step) {
      var fields = step.querySelectorAll("input, textarea, select");
      for (var i = 0; i < fields.length; i++) {
        if (!fields[i].checkValidity()) {
          fields[i].reportValidity();
          return false;
        }
      }
      return true;
    }

    function answers() {
      var data = {};
      new FormData(form).forEach(function (value, key) {
        data[key] = String(value).trim();
      });
      data.page = location.pathname + location.search;
      return data;
    }

    function emailDraft(data) {
      var lines = [
        "Name: " + data.name,
        "Email: " + data.email,
        "Company: " + data.company,
        "Role: " + (data.role || ""),
        "Team size: " + data.team_size,
        "Interested in: " + data.interest,
        "Timing: " + data.timing,
        "First job for AI: " + (data.first_job || ""),
      ];
      var to = (form.getAttribute("action") || "").replace(/^mailto:/, "") || "ali@adcrate.co";
      return (
        "mailto:" +
        to +
        "?subject=" +
        encodeURIComponent("Website enquiry: " + data.company) +
        "&body=" +
        encodeURIComponent(lines.join("\n"))
      );
    }

    function fallBackToEmail(data) {
      var url = emailDraft(data);
      status.replaceChildren(
        document.createTextNode("Your email draft is ready. Send it in your email app to finish. "),
      );
      var link = document.createElement("a");
      link.href = url;
      link.textContent = "Open the draft again";
      status.appendChild(link);
      location.href = url;
    }

    back.addEventListener("click", function () {
      status.textContent = "";
      show(current - 1);
      steps[current].querySelector("input").focus();
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!stepIsValid(steps[current])) return;
      if (current < steps.length - 1) {
        show(current + 1);
        steps[current].querySelector("input").focus();
        return;
      }
      var data = answers();
      if (data.website) return; // Spam trap was filled in.
      if (!ENQUIRY_ENDPOINT) return fallBackToEmail(data);

      next.disabled = true;
      status.textContent = "Sending…";
      try {
        var response = await fetch(ENQUIRY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Enquiry failed: " + response.status);
        form.hidden = true;
        done.hidden = false;
        done.focus();
      } catch (error) {
        next.disabled = false;
        fallBackToEmail(data);
      }
    });

    show(0);
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
