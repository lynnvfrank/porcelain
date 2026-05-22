/**
 * Embed UI theme bootstrap: default design-01, optional localStorage override.
 * Load synchronously in <head> before stylesheets to avoid flash of wrong tokens.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "embed-ui-theme";
  var DEFAULT_THEME = "design-01";
  var THEMES = { legacy: true, porcelain: true, "design-01": true };

  function normalize(name) {
    if (name === "default") {
      return "legacy";
    }
    return THEMES[name] ? name : DEFAULT_THEME;
  }

  function apply(name, persist) {
    var theme = normalize(name);
    var root = document.documentElement;
    if (theme === "legacy") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
    syncPickers(theme);
    return theme;
  }

  function current() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "porcelain" || attr === "design-01") {
      return attr;
    }
    return "legacy";
  }

  function readStored() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES[stored]) {
        return stored;
      }
    } catch (e) {}
    return DEFAULT_THEME;
  }

  function syncPickers(activeTheme) {
    var pickers = document.querySelectorAll("[data-embed-theme-picker]");
    for (var p = 0; p < pickers.length; p++) {
      var buttons = pickers[p].querySelectorAll("[data-embed-theme]");
      for (var b = 0; b < buttons.length; b++) {
        var btn = buttons[b];
        var id = btn.getAttribute("data-embed-theme");
        var on = normalize(id) === activeTheme;
        btn.setAttribute("aria-checked", on ? "true" : "false");
      }
    }
  }

  function bindPicker(picker) {
    if (!picker || picker._embedThemeBound) {
      return;
    }
    picker._embedThemeBound = true;
    var buttons = picker.querySelectorAll("[data-embed-theme]");
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          apply(btn.getAttribute("data-embed-theme"), true);
        });
      })(buttons[i]);
    }
    syncPickers(current());
  }

  function bindAllPickers() {
    var pickers = document.querySelectorAll("[data-embed-theme-picker]");
    for (var i = 0; i < pickers.length; i++) {
      bindPicker(pickers[i]);
    }
  }

  apply(readStored(), false);

  var api = {
    storageKey: STORAGE_KEY,
    defaultTheme: DEFAULT_THEME,
    apply: apply,
    current: current,
    bindPicker: bindPicker,
    bindAllPickers: bindAllPickers,
  };

  global.EmbedTheme = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindAllPickers);
  } else {
    bindAllPickers();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
