package server

import (
	"testing"

	"github.com/lynn/porcelain/internal/naming"
)

func TestTimelineKindForGatewayHTTPPath(t *testing.T) {
	cases := []struct {
		path string
		want string
	}{
		{"/v1/ingest", naming.TimelineKindIndexer},
		{"/v1/ingest/session", naming.TimelineKindIndexer},
		{"/v1/ingest/session/x/chunk", naming.TimelineKindIndexer},
		{"/v1/indexer/config", naming.TimelineKindIndexer},
		{"/v1/chat/completions", naming.TimelineKindBroker},
		{"/v1/models", naming.TimelineKindBroker},
		{"/ui/models", naming.TimelineKindBroker},
		{"/health", naming.TimelineKindWeb},
		{"/api/ui/logs", naming.TimelineKindWeb},
		{"/collections/foo/points/search", naming.TimelineKindVectorstore},
		{"", naming.TimelineKindWeb},
	}
	for _, tc := range cases {
		if got := timelineKindForGatewayHTTPPath(tc.path); got != tc.want {
			t.Fatalf("path=%q: got %q want %q", tc.path, got, tc.want)
		}
	}
}
