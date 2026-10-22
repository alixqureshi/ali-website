/* Small progressive enhancements. Every enquiry still has a visible email route. */
(function () {
  "use strict";
  var contact = document.querySelector("[data-contact-form]");
  if (contact) {
    var topics = {
      "ai-brain-workshop": {
        subject: "AI brain workshop interest",
        message:
          "I’d like the date and ticket details for the Build your AI brain workshop.",
      },
      project: { subject: "AI project enquiry", message: "" },
    };
    var topic = topics[new URLSearchParams(location.search).get("topic")];
    if (topic && topic.message) contact.elements.message.value = topic.message;
    contact.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!contact.reportValidity()) return;
      var subject = topic ? topic.subject : "Website enquiry";
      var body =
        "Name: " +
        contact.elements.name.value +
        "\nEmail: " +
        contact.elements.email.value +
        "\n\n" +
        contact.elements.message.value;
      var url =
        "mailto:hello@aliqureshi.co?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
      var status = contact.querySelector(".form-status");
      status.replaceChildren(
        document.createTextNode(
          "Your email draft is ready. Send it in your email app to finish. ",
        ),
      );
      var link = document.createElement("a");
      link.href = url;
      link.textContent = "Open the draft again";
      status.appendChild(link);
      location.href = url;
    });
  }
  var signup = document.querySelector("[data-newsletter-form]");
  if (signup) {
    signup.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!signup.reportValidity()) return;
      var button = signup.querySelector("button");
      var status = signup.querySelector(".form-status");
      button.disabled = true;
      status.textContent = "";
      try {
        var response = await fetch(signup.action, {
          method: "POST",
          body: new FormData(signup),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("Subscription request failed");
        var data = await response.json();
        if (data.status !== "success")
          throw new Error("Please finish signup on Kit");
        status.textContent =
          "Thanks. Check your inbox for any confirmation email from Kit.";
        signup.reset();
      } catch (error) {
        status.replaceChildren(
          document.createTextNode("Please finish subscribing on Kit. "),
        );
        var link = document.createElement("a");
        link.href = "https://aliqureshi.kit.com";
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Open the newsletter signup ↗";
        status.appendChild(link);
      } finally {
        button.disabled = false;
      }
    });
  }
  var scene = document.querySelector(".newsletter-scene");
  if (scene) {
    var media = matchMedia("(prefers-reduced-motion: reduce)");
    var applyMotion = function () {
      if (media.matches) {
        scene.pause();
        scene.removeAttribute("autoplay");
      } else {
        scene.play().catch(function () {});
      }
    };
    applyMotion();
    media.addEventListener("change", applyMotion);
  }
  var library = document.querySelector(".library");
  var open = document.querySelector("[data-library-open]");
  if (library && open) {
    library.hidden = true;
    var close = library.querySelector("[data-library-close]");
    var previousFocus;
    var oldOverflow;
    function showLibrary(event) {
      if (event) event.preventDefault();
      previousFocus = document.activeElement;
      oldOverflow = document.body.style.overflow;
      library.hidden = false;
      library.classList.add("is-modal");
      library.setAttribute("role", "dialog");
      library.setAttribute("aria-modal", "true");
      document.body.style.overflow = "hidden";
      close.focus();
    }
    function hideLibrary() {
      library.hidden = true;
      library.classList.remove("is-modal");
      library.removeAttribute("role");
      library.removeAttribute("aria-modal");
      document.body.style.overflow = oldOverflow || "";
      if (previousFocus) previousFocus.focus();
    }
    open.addEventListener("click", showLibrary);
    close.addEventListener("click", hideLibrary);
    document.addEventListener("keydown", function (event) {
      if (library.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        hideLibrary();
        return;
      }
      if (event.key === "Tab") {
        var nodes = Array.from(
          library.querySelectorAll("a[href],button"),
        ).filter(function (el) {
          return el.getClientRects().length;
        });
        var first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    document.addEventListener("click", function (event) {
      if (
        !library.hidden &&
        !library.contains(event.target) &&
        !open.contains(event.target)
      )
        hideLibrary();
    });
    var filters = library.querySelectorAll("[data-filter]");
    var activeFilter = "all";
    function applyFilter() {
      var count = 0;
      library.querySelectorAll(".edition").forEach(function (book) {
        book.hidden =
          activeFilter !== "all" && book.dataset.kind !== activeFilter;
        if (!book.hidden) count++;
      });
      library.querySelector(".library-empty").hidden = count > 0;
    }
    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.dataset.filter;
        filters.forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === button));
        });
        applyFilter();
      });
    });
    if (location.hash === "#previous") showLibrary();
    // The existing daily feed job can publish new real editions without a code change.
    fetch("/posts.json")
      .then(function (r) {
        if (!r.ok) throw new Error("Feed unavailable");
        return r.json();
      })
      .then(function (posts) {
        if (!Array.isArray(posts)) return;
        var shelf = library.querySelector(".bookshelf");
        var fragment = document.createDocumentFragment();
        posts.forEach(function (post) {
          var url;
          try {
            url = new URL(post.url);
          } catch (e) {
            return;
          }
          if (
            url.protocol !== "https:" ||
            url.hostname !== "aliqureshi.kit.com" ||
            !post.title
          )
            return;
          var book = document.createElement("a");
          book.className = "edition book-card--navy";
          book.href = url.href;
          book.target = "_blank";
          book.rel = "noopener";
          book.dataset.kind = "newsletter";
          [
            ["span", "AI WITH ALI", "eyebrow"],
            ["h3", post.title, ""],
            ["span", (post.date || "") + " / Newsletter", ""],
            ["span", "Read issue ↗", "edition-open"],
          ].forEach(function (item) {
            var el = document.createElement(item[0]);
            el.textContent = item[1];
            el.className = item[2];
            book.appendChild(el);
          });
          fragment.appendChild(book);
        });
        if (fragment.childNodes.length) {
          shelf.replaceChildren(fragment);
          applyFilter();
        }
      })
      .catch(function () {
        /* Keep the published HTML edition when the feed is unavailable. */
      });
  }
})();
