package line

import "strings"

// ParseSlogTextLine parses log/slog text handler lines (space-separated key=value fields).
// Quoted values may contain spaces; backslash escapes the next rune inside quotes.
func ParseSlogTextLine(line string) map[string]string {
	out := make(map[string]string)
	i := 0
	for i < len(line) {
		for i < len(line) && line[i] == ' ' {
			i++
		}
		if i >= len(line) {
			break
		}
		eq := strings.IndexByte(line[i:], '=')
		if eq < 0 {
			break
		}
		key := line[i : i+eq]
		if key == "" {
			break
		}
		i += eq + 1
		var val string
		if i < len(line) && line[i] == '"' {
			i++
			var b strings.Builder
			for i < len(line) {
				if line[i] == '\\' {
					i++
					if i < len(line) {
						b.WriteByte(line[i])
						i++
					}
					continue
				}
				if line[i] == '"' {
					i++
					break
				}
				b.WriteByte(line[i])
				i++
			}
			val = b.String()
		} else {
			start := i
			for i < len(line) && line[i] != ' ' {
				i++
			}
			val = line[start:i]
		}
		out[key] = val
	}
	return out
}

// LooksLikeSlogText reports whether a line resembles slog text handler output.
func LooksLikeSlogText(line string) bool {
	kv := ParseSlogTextLine(strings.TrimSpace(line))
	if len(kv) == 0 {
		return false
	}
	_, hasTime := kv["time"]
	_, hasLevel := kv["level"]
	_, hasMsg := kv["msg"]
	return (hasTime || hasLevel) && hasMsg
}
