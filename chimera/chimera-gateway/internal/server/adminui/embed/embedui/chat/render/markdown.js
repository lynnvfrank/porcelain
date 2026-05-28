/**
 * Safe subset markdown → HTML for assistant chat responses.
 */
(function () {
  "use strict";

  function escapeHtml(s) {
    if (globalThis.ChimeraUI && ChimeraUI.escapeHtml) return ChimeraUI.escapeHtml(s);
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeHref(raw) {
    var h = String(raw || "").trim();
    if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
    return "";
  }

  function inlineMarkdown(text) {
    var s = escapeHtml(text);
    s = s.replace(/`([^`\n]+)`/g, function (_m, code) {
      return "<code>" + code + "</code>";
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
    s = s.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, function (_m, label, href) {
      var safe = safeHref(href);
      if (!safe) return label;
      return '<a href="' + escapeHtml(safe) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    return s;
  }

  function flushParagraph(lines, out) {
    if (!lines.length) return;
    out.push("<p>" + inlineMarkdown(lines.join(" ")) + "</p>");
    lines.length = 0;
  }

  function flushList(items, ordered, out) {
    if (!items.length) return;
    var tag = ordered ? "ol" : "ul";
    out.push("<" + tag + ">");
    for (var i = 0; i < items.length; i++) {
      out.push("<li>" + inlineMarkdown(items[i]) + "</li>");
    }
    out.push("</" + tag + ">");
    items.length = 0;
  }

  function renderBlocks(text) {
    text = String(text || "");
    var segments = text.split(/(```[\s\S]*?```)/g);
    var out = [];

    for (var si = 0; si < segments.length; si++) {
      var seg = segments[si];
      if (!seg) continue;
      if (seg.indexOf("```") === 0) {
        var fence = seg.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
        out.push("<pre><code>" + escapeHtml(fence) + "</code></pre>");
        continue;
      }

      var lines = seg.replace(/\r\n/g, "\n").split("\n");
      var para = [];
      var ul = [];
      var ol = [];

      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        var trimmed = line.trim();

        if (!trimmed) {
          flushParagraph(para, out);
          flushList(ul, false, out);
          flushList(ol, true, out);
          continue;
        }

        var hm = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (hm) {
          flushParagraph(para, out);
          flushList(ul, false, out);
          flushList(ol, true, out);
          var level = hm[1].length;
          out.push("<h" + level + ">" + inlineMarkdown(hm[2]) + "</h" + level + ">");
          continue;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          flushParagraph(para, out);
          flushList(ul, false, out);
          flushList(ol, true, out);
          out.push("<hr>");
          continue;
        }

        var ulm = trimmed.match(/^[-*+]\s+(.+)$/);
        if (ulm) {
          flushParagraph(para, out);
          flushList(ol, true, out);
          ul.push(ulm[1]);
          continue;
        }

        var olm = trimmed.match(/^\d+\.\s+(.+)$/);
        if (olm) {
          flushParagraph(para, out);
          flushList(ul, false, out);
          ol.push(olm[1]);
          continue;
        }

        flushList(ul, false, out);
        flushList(ol, true, out);
        para.push(trimmed);
      }

      flushParagraph(para, out);
      flushList(ul, false, out);
      flushList(ol, true, out);
    }

    return out.join("");
  }

  function renderMarkdown(text) {
    var html = renderBlocks(text);
    return html || "<p></p>";
  }

  globalThis.ChimeraChat = globalThis.ChimeraChat || {};
  globalThis.ChimeraChat.Render = globalThis.ChimeraChat.Render || {};
  globalThis.ChimeraChat.Render.Markdown = {
    render: renderMarkdown,
    escapeHtml: escapeHtml
  };
})();
