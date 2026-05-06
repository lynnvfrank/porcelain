package indexer

import (
	"encoding/json"
	"sort"
	"strings"
)

// RootScopeJSON is one roots[] row after merging default scope + gateway defaults,
// for operator logs (/ui/logs) and multi-target partitioning.
type RootScopeJSON struct {
	RootID           string `json:"root_id"`
	Path             string `json:"path"`
	WorkspaceID      string `json:"workspace_id,omitempty"`
	IngestProject    string `json:"ingest_project"`
	FlavorID         string `json:"flavor_id,omitempty"`
	IndexerTargetKey string `json:"indexer_target_key"`
}

func mergeScopeFragmentForRoot(r Resolved, root Root) ScopeFragment {
	return mergeScopeFragment(r.DefaultScope, root.Scope)
}

func effectiveIngestTriple(r Resolved, root Root, gw *IndexerConfig) (tenant, ingestProject, flavor string) {
	if gw != nil {
		tenant = strings.TrimSpace(gw.TenantID)
	}
	s := mergeScopeFragmentForRoot(r, root)
	ingestProject = strings.TrimSpace(IngestProject(s))
	flavor = strings.TrimSpace(s.FlavorID)
	if gw != nil {
		if ingestProject == "" {
			ingestProject = strings.TrimSpace(gw.Defaults.ProjectID)
		}
		if flavor == "" {
			flavor = strings.TrimSpace(gw.Defaults.FlavorID)
		}
	}
	return tenant, ingestProject, flavor
}

// RootScopesPayload returns JSON-encoded []RootScopeJSON (one row per watched root).
func RootScopesPayload(r Resolved, gw *IndexerConfig) []byte {
	rows := make([]RootScopeJSON, 0, len(r.Roots))
	for _, root := range r.Roots {
		tenant, proj, flav := effectiveIngestTriple(r, root, gw)
		ik := IndexerKey(tenant, proj, flav)
		ws := strings.TrimSpace(mergeScopeFragmentForRoot(r, root).WorkspaceID)
		rows = append(rows, RootScopeJSON{
			RootID:           root.ID,
			Path:             root.AbsPath,
			WorkspaceID:      ws,
			IngestProject:    proj,
			FlavorID:         flav,
			IndexerTargetKey: ik,
		})
	}
	b, err := json.Marshal(rows)
	if err != nil {
		return []byte("[]")
	}
	return b
}

// DistinctIndexerTargetKeys returns unique IndexerKey values across all roots (after merges).
func DistinctIndexerTargetKeys(r Resolved, gw *IndexerConfig) []string {
	seen := make(map[string]struct{})
	for _, root := range r.Roots {
		tenant, proj, flav := effectiveIngestTriple(r, root, gw)
		seen[IndexerKey(tenant, proj, flav)] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
