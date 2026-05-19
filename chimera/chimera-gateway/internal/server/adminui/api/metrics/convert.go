package metrics

import (
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/gatewaymetrics"
	"github.com/lynn/porcelain/internal/operatorapi"
)

func toOperatorRollups(in []gatewaymetrics.UsageRollup) []operatorapi.UsageRollup {
	if len(in) == 0 {
		return []operatorapi.UsageRollup{}
	}
	out := make([]operatorapi.UsageRollup, len(in))
	for i, r := range in {
		out[i] = operatorapi.UsageRollup{
			Provider:  r.Provider,
			ModelID:   r.ModelID,
			Status:    r.Status,
			Calls:     r.Calls,
			EstTokens: r.EstTokens,
		}
	}
	return out
}

func toOperatorEvents(in []gatewaymetrics.CallEvent) []operatorapi.CallEvent {
	if len(in) == 0 {
		return []operatorapi.CallEvent{}
	}
	out := make([]operatorapi.CallEvent, len(in))
	for i, e := range in {
		out[i] = operatorapi.CallEvent{
			OccurredAt: e.OccurredAt,
			Provider:   e.Provider,
			ModelID:    e.ModelID,
			Status:     e.Status,
			EstTokens:  e.EstTokens,
		}
	}
	return out
}
