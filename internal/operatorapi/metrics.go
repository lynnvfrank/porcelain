package operatorapi

// UsageRollup is one row from minute or day rollup tables (UTC buckets).
type UsageRollup struct {
	Provider  string `json:"provider"`
	ModelID   string `json:"model_id"`
	Status    int    `json:"status"`
	Calls     int    `json:"calls"`
	EstTokens int    `json:"est_tokens"`
}

// CallEvent is a recent row from broker_call_events.
type CallEvent struct {
	OccurredAt string `json:"occurred_at"`
	Provider   string `json:"provider"`
	ModelID    string `json:"model_id"`
	Status     int    `json:"status"`
	EstTokens  int    `json:"est_tokens"`
}

// MetricsResponse is GET /api/ui/metrics.
type MetricsResponse struct {
	OK                   bool          `json:"ok"`
	MetricsStoreOpen     bool          `json:"metrics_store_open"`
	MetricsConfigEnabled bool          `json:"metrics_config_enabled"`
	SQLitePath           string        `json:"sqlite_path"`
	NowUTC               string        `json:"now_utc"`
	CurrentMinuteUTC     string        `json:"current_minute_utc"`
	CurrentDayUTC        string        `json:"current_day_utc"`
	BucketsNote          string        `json:"buckets_note"`
	EstimatorNote        string        `json:"estimator_note"`
	MinuteRollups        []UsageRollup `json:"minute_rollups"`
	DayRollups           []UsageRollup `json:"day_rollups"`
	RecentEvents         []CallEvent   `json:"recent_events"`
	Message              string        `json:"message,omitempty"`
	Error                string        `json:"error,omitempty"`
}
