package genoperatorcopy

import (
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	"github.com/lynn/porcelain/internal/operatorcopy"
	"github.com/lynn/porcelain/internal/operatorcopy/genlogmessages"
)

// DefaultOperatorCopyJSPath is the embed path for generated operator copy (full registry).
const DefaultOperatorCopyJSPath = "chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/operator_copy.js"

// WriteOperatorCopyJS emits ChimeraLogs.OperatorCopy from the full messages.yaml catalog.
func WriteOperatorCopyJS(w io.Writer, reg *operatorcopy.Registry) error {
	if reg == nil {
		return fmt.Errorf("genoperatorcopy: nil registry")
	}
	var b strings.Builder
	b.WriteString("/**\n")
	b.WriteString(" * Operator message registry — generated from internal/operatorcopy/messages.yaml.\n")
	b.WriteString(" * slog JSON may contain duplicate \"msg\" keys (human title + slug); use resolveFlat(flat).\n")
	b.WriteString(" * Legacy aliases (remove after 2026-08-01): qdrant.* -> vectorstore.*, chimera-broker.* -> broker.*\n")
	b.WriteString(" * DO NOT EDIT; run: make operator-copy-generate\n")
	b.WriteString(" */\n")
	b.WriteString("(function () {\n")
	b.WriteString("  globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};\n")
	b.WriteString("  function fieldPresent(flat, field) {\n")
	b.WriteString("    if (!flat || typeof flat !== \"object\") return false;\n")
	b.WriteString("    if (!Object.prototype.hasOwnProperty.call(flat, field)) return false;\n")
	b.WriteString("    var v = flat[field];\n")
	b.WriteString("    if (v === null || v === undefined) return false;\n")
	b.WriteString("    if (typeof v === \"string\" && v.trim() === \"\") return false;\n")
	b.WriteString("    return true;\n")
	b.WriteString("  }\n")
	b.WriteString("  function fieldIsBool(flat, field) {\n")
	b.WriteString("    return flat && typeof flat === \"object\" && typeof flat[field] === \"boolean\";\n")
	b.WriteString("  }\n")
	b.WriteString("  function matchFields(flat, rules) {\n")
	b.WriteString("    if (!rules) return true;\n")
	b.WriteString("    var i;\n")
	b.WriteString("    if (rules.require_all) {\n")
	b.WriteString("      for (i = 0; i < rules.require_all.length; i++) {\n")
	b.WriteString("        if (!fieldPresent(flat, rules.require_all[i])) return false;\n")
	b.WriteString("      }\n")
	b.WriteString("    }\n")
	b.WriteString("    var anyGroup = (rules.require_any && rules.require_any.length) || (rules.require_any_bool && rules.require_any_bool.length);\n")
	b.WriteString("    if (anyGroup) {\n")
	b.WriteString("      var anyOk = false;\n")
	b.WriteString("      if (rules.require_any) {\n")
	b.WriteString("        for (i = 0; i < rules.require_any.length; i++) {\n")
	b.WriteString("          if (fieldPresent(flat, rules.require_any[i])) { anyOk = true; break; }\n")
	b.WriteString("        }\n")
	b.WriteString("      }\n")
	b.WriteString("      if (!anyOk && rules.require_any_bool) {\n")
	b.WriteString("        for (i = 0; i < rules.require_any_bool.length; i++) {\n")
	b.WriteString("          if (fieldIsBool(flat, rules.require_any_bool[i])) { anyOk = true; break; }\n")
	b.WriteString("        }\n")
	b.WriteString("      }\n")
	b.WriteString("      if (!anyOk) return false;\n")
	b.WriteString("    }\n")
	b.WriteString("    return true;\n")
	b.WriteString("  }\n")
	b.WriteString("  var aliasToCanonical = {\n")
	firstAlias := true
	for _, m := range reg.Messages {
		for _, a := range m.Aliases {
			if m.MatchFields != nil {
				continue
			}
			if !firstAlias {
				b.WriteString(",\n")
			}
			firstAlias = false
			fmt.Fprintf(&b, "    %s: %s", strconv.Quote(strings.ToLower(strings.TrimSpace(a))), strconv.Quote(m.Slug))
		}
	}
	if firstAlias {
		b.WriteString("    \n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString("  };\n")
	b.WriteString("  var flatAliasRules = [\n")
	firstRule := true
	for _, m := range reg.Messages {
		for _, a := range m.Aliases {
			if m.MatchFields == nil {
				continue
			}
			if !firstRule {
				b.WriteString(",\n")
			}
			firstRule = false
			fmt.Fprintf(&b, "    { slug: %s, alias: %s, match: ", strconv.Quote(m.Slug), strconv.Quote(strings.ToLower(strings.TrimSpace(a))))
			writeMatchFieldsJS(&b, m.MatchFields)
			b.WriteString(" }")
		}
	}
	if firstRule {
		b.WriteString("    \n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString("  ];\n")
	b.WriteString("  var prefixSlugs = [\n")
	firstPrefix := true
	for _, m := range reg.Messages {
		if !m.MatchPrefix {
			continue
		}
		if !firstPrefix {
			b.WriteString(",\n")
		}
		firstPrefix = false
		fmt.Fprintf(&b, "    %s", strconv.Quote(m.Slug))
	}
	if firstPrefix {
		b.WriteString("    \n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString("  ];\n")
	b.WriteString("  var bySlug = {\n")
	firstMsg := true
	for _, m := range reg.Messages {
		if !firstMsg {
			b.WriteString(",\n")
		}
		firstMsg = false
		fmt.Fprintf(&b, "    %s: {", strconv.Quote(m.Slug))
		summary := strings.TrimSpace(m.Summary)
		if summary == "" {
			summary = strings.TrimSpace(m.GalleryPreview)
		}
		if summary != "" {
			fmt.Fprintf(&b, "summary: %s", strconv.Quote(summary))
		}
		if f := strings.TrimSpace(m.Formatter); f != "" {
			if summary != "" {
				b.WriteString(", ")
			}
			fmt.Fprintf(&b, "formatter: %s", strconv.Quote(f))
		}
		if sh := strings.TrimSpace(m.Shape); sh != "" {
			if summary != "" || strings.TrimSpace(m.Formatter) != "" {
				b.WriteString(", ")
			} else {
				b.WriteString(" ")
			}
			fmt.Fprintf(&b, "shape: %s", strconv.Quote(sh))
		}
		if mc := strings.TrimSpace(m.MetricsCounter); mc != "" {
			b.WriteString(", ")
			fmt.Fprintf(&b, "metricsCounter: %s", strconv.Quote(mc))
		}
		b.WriteString("}")
	}
	if firstMsg {
		b.WriteString("    \n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString("  };\n")
	if len(reg.IndexerStates) > 0 {
		b.WriteString("  var indexerStateLabels = {\n")
		stateCodes := make([]string, 0, len(reg.IndexerStates))
		for code := range reg.IndexerStates {
			stateCodes = append(stateCodes, code)
		}
		sort.Strings(stateCodes)
		firstSt := true
		for _, code := range stateCodes {
			if !firstSt {
				b.WriteString(",\n")
			}
			firstSt = false
			fmt.Fprintf(&b, "    %s: %s", strconv.Quote(code), strconv.Quote(reg.IndexerStates[code]))
		}
		if firstSt {
			b.WriteString("    \n")
		} else {
			b.WriteString("\n")
		}
		b.WriteString("  };\n")
	} else {
		b.WriteString("  var indexerStateLabels = {};\n")
	}
	b.WriteString("  var Slug = {\n")
	firstSlugConst := true
	for _, m := range reg.Messages {
		if !firstSlugConst {
			b.WriteString(",\n")
		}
		firstSlugConst = false
		fmt.Fprintf(&b, "    %s: %s", genlogmessages.SlugToConstName(m.Slug), strconv.Quote(m.Slug))
	}
	if firstSlugConst {
		b.WriteString("    \n")
	} else {
		b.WriteString("\n")
	}
	b.WriteString("  };\n")
	b.WriteString("  ChimeraLogs.OperatorCopy = {\n")
	b.WriteString("    Slug: Slug,\n")
	b.WriteString("    aliasToCanonical: aliasToCanonical,\n")
	b.WriteString("    bySlug: bySlug,\n")
	b.WriteString("    indexerStateLabels: indexerStateLabels,\n")
	b.WriteString("    resolveCanonical: function (msg) {\n")
	b.WriteString("      var s = String(msg != null ? msg : \"\").trim();\n")
	b.WriteString("      if (!s) return \"\";\n")
	b.WriteString("      var low = s.toLowerCase();\n")
	b.WriteString("      if (Object.prototype.hasOwnProperty.call(bySlug, low)) return low;\n")
	b.WriteString("      if (Object.prototype.hasOwnProperty.call(aliasToCanonical, low)) return aliasToCanonical[low];\n")
	b.WriteString("      return \"\";\n")
	b.WriteString("    },\n")
	b.WriteString("    resolveFlat: function (flat) {\n")
	b.WriteString("      if (!flat || typeof flat !== \"object\") return \"\";\n")
	b.WriteString("      var rawMsg = flat.msg != null ? flat.msg : flat.message;\n")
	b.WriteString("      var raw = String(rawMsg != null ? rawMsg : \"\").toLowerCase().trim();\n")
	b.WriteString("      if (!raw) return \"\";\n")
	b.WriteString("      if (Object.prototype.hasOwnProperty.call(bySlug, raw)) return raw;\n")
	b.WriteString("      var pi;\n")
	b.WriteString("      for (pi = 0; pi < prefixSlugs.length; pi++) {\n")
	b.WriteString("        var ps = prefixSlugs[pi];\n")
	b.WriteString("        if (raw === ps || raw.indexOf(ps) === 0) return ps;\n")
	b.WriteString("      }\n")
	b.WriteString("      var ri;\n")
	b.WriteString("      for (ri = 0; ri < flatAliasRules.length; ri++) {\n")
	b.WriteString("        var rule = flatAliasRules[ri];\n")
	b.WriteString("        if (raw === rule.alias && matchFields(flat, rule.match)) return rule.slug;\n")
	b.WriteString("      }\n")
	b.WriteString("      if (Object.prototype.hasOwnProperty.call(aliasToCanonical, raw)) return aliasToCanonical[raw];\n")
	b.WriteString("      return raw;\n")
	b.WriteString("    },\n")
	b.WriteString("    inferShapeForFlat: function (flat, source) {\n")
	b.WriteString("      if (!flat || typeof flat !== \"object\") {\n")
	b.WriteString("        if (source === \"chimera-vectorstore\" || source === \"chimera-broker\" || source === \"chimera-indexer\") return \"service.\" + source;\n")
	b.WriteString("        return \"\";\n")
	b.WriteString("      }\n")
	b.WriteString("      var slug = ChimeraLogs.OperatorCopy.resolveFlat(flat);\n")
	b.WriteString("      if (slug && Object.prototype.hasOwnProperty.call(bySlug, slug) && bySlug[slug].shape) return bySlug[slug].shape;\n")
	b.WriteString("      return \"\";\n")
	b.WriteString("    },\n")
	b.WriteString("    metricsCounterForFlat: function (flat) {\n")
	b.WriteString("      if (!flat || typeof flat !== \"object\") return \"\";\n")
	b.WriteString("      var slug = ChimeraLogs.OperatorCopy.resolveFlat(flat);\n")
	b.WriteString("      if (slug && Object.prototype.hasOwnProperty.call(bySlug, slug) && bySlug[slug].metricsCounter) return bySlug[slug].metricsCounter;\n")
	b.WriteString("      return \"\";\n")
	b.WriteString("    }\n")
	b.WriteString("  };\n")
	b.WriteString("})();\n")
	_, err := io.WriteString(w, b.String())
	return err
}

func writeMatchFieldsJS(b *strings.Builder, mf *operatorcopy.MatchFields) {
	b.WriteString("{")
	first := true
	if len(mf.RequireAll) > 0 {
		b.WriteString("require_all: [")
		for i, f := range mf.RequireAll {
			if i > 0 {
				b.WriteString(", ")
			}
			fmt.Fprintf(b, "%s", strconv.Quote(f))
		}
		b.WriteString("]")
		first = false
	}
	if len(mf.RequireAny) > 0 {
		if !first {
			b.WriteString(", ")
		}
		b.WriteString("require_any: [")
		for i, f := range mf.RequireAny {
			if i > 0 {
				b.WriteString(", ")
			}
			fmt.Fprintf(b, "%s", strconv.Quote(f))
		}
		b.WriteString("]")
		first = false
	}
	if len(mf.RequireAnyBool) > 0 {
		if !first {
			b.WriteString(", ")
		}
		b.WriteString("require_any_bool: [")
		for i, f := range mf.RequireAnyBool {
			if i > 0 {
				b.WriteString(", ")
			}
			fmt.Fprintf(b, "%s", strconv.Quote(f))
		}
		b.WriteString("]")
	}
	b.WriteString("}")
}
