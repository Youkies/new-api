package operation_setting

import (
	"os"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

const (
	DefaultDebugConnectivityStreamProbeSeconds         = 60
	DefaultDebugConnectivityStreamProbeIntervalSeconds = 5
	DefaultDebugConnectivityNonStreamProbeSeconds      = 0
	MaxDebugConnectivityProbeSeconds                   = 600
	MaxDebugConnectivityStreamProbeIntervalSeconds     = 60
)

type DebugConnectivitySetting struct {
	StreamProbeSeconds         int `json:"stream_probe_seconds"`
	StreamProbeIntervalSeconds int `json:"stream_probe_interval_seconds"`
	NonStreamProbeSeconds      int `json:"non_stream_probe_seconds"`
}

var debugConnectivitySetting = DebugConnectivitySetting{
	StreamProbeSeconds:         envInt("DEBUG_CONNECTIVITY_STREAM_SECONDS", DefaultDebugConnectivityStreamProbeSeconds),
	StreamProbeIntervalSeconds: envInt("DEBUG_CONNECTIVITY_STREAM_INTERVAL_SECONDS", DefaultDebugConnectivityStreamProbeIntervalSeconds),
	NonStreamProbeSeconds:      envInt("DEBUG_CONNECTIVITY_NON_STREAM_SECONDS", DefaultDebugConnectivityNonStreamProbeSeconds),
}

func init() {
	config.GlobalConfig.Register("debug_connectivity_setting", &debugConnectivitySetting)
}

func GetDebugConnectivitySetting() DebugConnectivitySetting {
	return NormalizeDebugConnectivitySetting(debugConnectivitySetting)
}

func NormalizeDebugConnectivitySetting(setting DebugConnectivitySetting) DebugConnectivitySetting {
	if setting.StreamProbeSeconds <= 0 {
		setting.StreamProbeSeconds = DefaultDebugConnectivityStreamProbeSeconds
	}
	if setting.StreamProbeSeconds > MaxDebugConnectivityProbeSeconds {
		setting.StreamProbeSeconds = MaxDebugConnectivityProbeSeconds
	}

	if setting.StreamProbeIntervalSeconds <= 0 {
		setting.StreamProbeIntervalSeconds = DefaultDebugConnectivityStreamProbeIntervalSeconds
	}
	if setting.StreamProbeIntervalSeconds > MaxDebugConnectivityStreamProbeIntervalSeconds {
		setting.StreamProbeIntervalSeconds = MaxDebugConnectivityStreamProbeIntervalSeconds
	}
	if setting.StreamProbeIntervalSeconds > setting.StreamProbeSeconds {
		setting.StreamProbeIntervalSeconds = setting.StreamProbeSeconds
	}

	if setting.NonStreamProbeSeconds < 0 {
		setting.NonStreamProbeSeconds = DefaultDebugConnectivityNonStreamProbeSeconds
	}
	if setting.NonStreamProbeSeconds > MaxDebugConnectivityProbeSeconds {
		setting.NonStreamProbeSeconds = MaxDebugConnectivityProbeSeconds
	}

	return setting
}

func envInt(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
