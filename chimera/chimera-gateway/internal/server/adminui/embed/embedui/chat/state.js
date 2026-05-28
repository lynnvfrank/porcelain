/**
 * In-memory chat session state.
 */
(function () {
  "use strict";

  function newId() {
    if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "msg-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function createMessage(role, content, extra) {
    extra = extra || {};
    return {
      id: newId(),
      role: role,
      content: content || "",
      status: extra.status || "done",
      selectedModel: extra.selectedModel || "",
      upstreamModel: extra.upstreamModel || "",
      ragHits: extra.ragHits || null,
      error: extra.error || "",
      retryUserText: extra.retryUserText || ""
    };
  }

  function createState() {
    return {
      messages: [],
      conversationId: "",
      selectedModel: "",
      selectedWorkspaceKey: "",
      inputHistory: [],
      isStreaming: false,
      abortController: null
    };
  }

  function messagesForAPI(messages) {
    var out = [];
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!m || m.role === "error") continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (m.status === "streaming" && !m.content) continue;
      out.push({ role: m.role, content: m.content });
    }
    return out;
  }

  function resolvedModel(m) {
    if (!m) return "";
    var model = m.upstreamModel || m.selectedModel || "";
    return String(model).trim();
  }

  function snippetLanguage(source, hint) {
    var Snippet =
      globalThis.ChimeraChat &&
      ChimeraChat.Render &&
      ChimeraChat.Render.Snippet &&
      typeof ChimeraChat.Render.Snippet.inferLanguage === "function"
        ? ChimeraChat.Render.Snippet
        : null;
    if (Snippet) return Snippet.inferLanguage(source, hint);
    if (hint) return String(hint).trim().toLowerCase();
    return "";
  }

  function formatScore(score) {
    if (score == null || isNaN(Number(score))) return "";
    return Number(score).toFixed(3);
  }

  function codeFence(text, lang) {
    text = String(text == null ? "" : text);
    lang = lang ? String(lang).trim() : "";
    var fence = "```";
    while (text.indexOf(fence) >= 0) fence += "`";
    return fence + (lang ? lang : "") + "\n" + text + "\n" + fence;
  }

  function formatRAGHitsMarkdown(hits) {
    if (!hits || !hits.length) return "";
    var parts = ["### Workspace Snippets", ""];
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i] || {};
      var src = h.source != null ? String(h.source).trim() : "source";
      var text = h.text != null ? String(h.text) : "";
      var score = formatScore(h.score);
      var lang = snippetLanguage(src, h.language);
      var heading = "#### " + src;
      if (score) heading += " (score: " + score + ")";
      parts.push(heading);
      parts.push("");
      parts.push(codeFence(text, lang));
      if (i < hits.length - 1) parts.push("");
    }
    return parts.join("\n");
  }

  function formatAssistantMarkdown(m) {
    var parts = ["## Assistant", ""];
    var model = resolvedModel(m);
    if (model) {
      parts.push("**Model:** `" + model + "`");
      parts.push("");
    }
    var content = String(m.content || "").trim();
    if (content) {
      parts.push(content);
    } else if (m.status === "streaming") {
      parts.push("*(streaming…)*");
    }
    var rag = formatRAGHitsMarkdown(m.ragHits);
    if (rag) {
      parts.push("");
      parts.push(rag);
    }
    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function formatUserMarkdown(m) {
    return ("## User\n\n" + String(m.content || "")).trim();
  }

  function formatErrorMarkdown(m) {
    return ("## Error\n\n" + String(m.error || m.content || "")).trim();
  }

  function transcriptText(messages) {
    var blocks = [];
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      if (!m) continue;
      if (m.role === "user") {
        blocks.push(formatUserMarkdown(m));
      } else if (m.role === "assistant") {
        if (m.status === "streaming" && !String(m.content || "").trim() && !resolvedModel(m) && !(m.ragHits && m.ragHits.length)) {
          continue;
        }
        blocks.push(formatAssistantMarkdown(m));
      } else if (m.role === "error") {
        blocks.push(formatErrorMarkdown(m));
      }
    }
    return blocks.join("\n\n---\n\n").trim();
  }

  globalThis.ChimeraChat = globalThis.ChimeraChat || {};
  globalThis.ChimeraChat.State = {
    newId: newId,
    createMessage: createMessage,
    createState: createState,
    messagesForAPI: messagesForAPI,
    transcriptText: transcriptText
  };
})();
