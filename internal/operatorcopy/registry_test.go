package operatorcopy_test

import (
	"testing"

	"github.com/lynn/porcelain/internal/operatorcopy"
)

func TestEmbeddedRegistryValid(t *testing.T) {
	r, err := operatorcopy.LoadEmbedded()
	if err != nil {
		t.Fatal(err)
	}
	if r.Locale != "en" {
		t.Fatalf("locale: got %q want en", r.Locale)
	}
	if len(r.Messages) < 165 {
		t.Fatalf("expected at least 165 messages for Phase 2-6 coverage, got %d", len(r.Messages))
	}
	for _, m := range r.Messages {
		if m.GalleryPreview == "" {
			t.Fatalf("gallery_preview required: %s", m.Slug)
		}
	}
}

func TestResolveCanonical_alias(t *testing.T) {
	r, err := operatorcopy.LoadEmbedded()
	if err != nil {
		t.Fatal(err)
	}
	if got := r.ResolveCanonical("qdrant.version"); got != "vectorstore.version" {
		t.Fatalf("ResolveCanonical(qdrant.version) = %q, want vectorstore.version", got)
	}
	if got := r.ResolveCanonical("chimera-broker.ready"); got != "broker.ready" {
		t.Fatalf("ResolveCanonical(chimera-broker.ready) = %q, want broker.ready", got)
	}
}

func TestGalleryPreviewRequired(t *testing.T) {
	raw := []byte(`
version: 1
locale: en
formatters:
  noop:
    description: test
messages:
  - slug: test.slug
    formatter: noop
    gallery_preview: Example line
`)
	r, err := operatorcopy.ParseRegistry(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Messages) != 1 {
		t.Fatalf("got %d messages", len(r.Messages))
	}
}
