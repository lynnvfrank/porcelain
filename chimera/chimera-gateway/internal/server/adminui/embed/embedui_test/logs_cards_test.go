package embedui_test

import (
	"strings"
	"testing"

	"github.com/dop251/goja"
)

func TestLogsCards_gatewayOverview_rendersIdAndVersion(t *testing.T) {
	vm := goja.New()
	loadCardTestCtx(t, vm)

	v, err := vm.RunString(`ctx.buildGatewayOverviewCardHtml()`)
	if err != nil {
		t.Fatal(err)
	}
	html := v.String()
	for _, want := range []string{`id="gw-overview"`, "9.9.9-test", "virtual/test", "Overview"} {
		if !strings.Contains(html, want) {
			t.Fatalf("missing %q in %q", want, html)
		}
	}
}

func TestLogsCards_adminUsers_section(t *testing.T) {
	vm := goja.New()
	loadCardTestCtx(t, vm)

	v, err := vm.RunString(`ctx.buildAdminUsersCardHtml()`)
	if err != nil {
		t.Fatal(err)
	}
	html := v.String()
	for _, want := range []string{`id="admin-users"`, "tenant-a", "Alice", "Add user"} {
		if !strings.Contains(html, want) {
			t.Fatalf("missing %q in %q", want, html)
		}
	}
}

func TestLogsCards_serviceAvatarInitials(t *testing.T) {
	vm := goja.New()
	loadCardTestCtx(t, vm)

	v, err := vm.RunString(`ctx.serviceAvatarInitials("chimera-gateway")`)
	if err != nil {
		t.Fatal(err)
	}
	if v.String() != "CW" {
		t.Fatalf("got %q", v.String())
	}
}

func TestLogsCards_formatMergedConversationSubtitle(t *testing.T) {
	vm := goja.New()
	loadCardTestCtx(t, vm)

	v, err := vm.RunString(`ctx.formatMergedConversationSubtitle(3)`)
	if err != nil {
		t.Fatal(err)
	}
	html := v.String()
	if !strings.Contains(html, "3 ids") {
		t.Fatalf("got %q", html)
	}
	v2, err := vm.RunString(`ctx.formatMergedConversationSubtitle(1)`)
	if err != nil {
		t.Fatal(err)
	}
	if v2.String() != "" {
		t.Fatalf("expected empty for single id, got %q", v2.String())
	}
}
