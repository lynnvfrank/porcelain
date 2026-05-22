/**
 * Collapsible operator cards: <article|div class="sum-card--collapsible"> + <header class="sum-card__hdr">
 * (interactive controls allowed in the header; not inside <summary>).
 */
(function () {
  "use strict";

  var INTERACTIVE_SEL =
    "button, a, input, select, textarea, label, [data-sum-card-no-toggle]";

  function isInteractiveTarget(hdr, target) {
    if (!target || !hdr.contains(target)) return false;
    return !!target.closest(INTERACTIVE_SEL);
  }

  function setExpanded(card, open) {
    if (!card) return;
    if (open) {
      card.setAttribute("open", "");
    } else {
      card.removeAttribute("open");
    }
    var hdr = card.querySelector(":scope > .sum-card__hdr");
    if (hdr) hdr.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function toggleCard(card) {
    setExpanded(card, !card.hasAttribute("open"));
  }

  function wireCard(card) {
    if (!card || card.getAttribute("data-sum-card-wired") === "1") return;
    var hdr = card.querySelector(":scope > .sum-card__hdr");
    if (!hdr) return;
    card.setAttribute("data-sum-card-wired", "1");
    if (!hdr.hasAttribute("role")) hdr.setAttribute("role", "button");
    if (!hdr.hasAttribute("tabindex")) hdr.setAttribute("tabindex", "0");
    hdr.setAttribute("aria-expanded", card.hasAttribute("open") ? "true" : "false");

    hdr.addEventListener("click", function (ev) {
      if (isInteractiveTarget(hdr, ev.target)) return;
      toggleCard(card);
    });

    hdr.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      if (isInteractiveTarget(hdr, ev.target)) return;
      ev.preventDefault();
      toggleCard(card);
    });

    var stop = card.querySelectorAll(INTERACTIVE_SEL);
    for (var i = 0; i < stop.length; i++) {
      stop[i].addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    }
  }

  function wireAll(root) {
    if (!root || !root.querySelectorAll) return;
    var cards = root.querySelectorAll(".sum-card.sum-card--collapsible");
    for (var i = 0; i < cards.length; i++) wireCard(cards[i]);
  }

  globalThis.ChimeraUI = globalThis.ChimeraUI || {};
  globalThis.ChimeraUI.CollapsibleCard = {
    wireCard: wireCard,
    wireAll: wireAll,
    setExpanded: setExpanded
  };
})();
