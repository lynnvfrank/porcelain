package servicelogs

import (
	"testing"

	"github.com/lynn/porcelain/internal/naming"
)

func TestLogSourcesMatchNamingContracts(t *testing.T) {
	pairs := []struct {
		svc    string
		naming string
	}{
		{SourceChimeraGateway, naming.LogSourceChimeraGateway},
		{SourceChimeraBroker, naming.LogSourceChimeraBroker},
		{SourceChimeraVectorstore, naming.LogSourceChimeraVectorstore},
		{SourceChimeraIndexer, naming.LogSourceChimeraIndexer},
		{SourceChimeraSupervisor, naming.LogSourceChimeraSupervisor},
	}
	for _, p := range pairs {
		if p.svc != p.naming {
			t.Fatalf("servicelogs %q != naming %q", p.svc, p.naming)
		}
	}
}
