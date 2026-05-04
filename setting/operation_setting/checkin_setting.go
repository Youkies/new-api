package operation_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type CheckinQuotaRange struct {
	MinQuota int `json:"min_quota"`
	MaxQuota int `json:"max_quota"`
}

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled     bool                         `json:"enabled"`      // 是否启用签到功能
	MinQuota    int                          `json:"min_quota"`    // 默认签到最小额度奖励
	MaxQuota    int                          `json:"max_quota"`    // 默认签到最大额度奖励
	GroupQuotas map[string]CheckinQuotaRange `json:"group_quotas"` // 分组签到额度覆盖
}

// 默认配置
var checkinSetting = CheckinSetting{
	Enabled:     false, // 默认关闭
	MinQuota:    1000,  // 默认最小额度 1000 (约 0.002 USD)
	MaxQuota:    10000, // 默认最大额度 10000 (约 0.02 USD)
	GroupQuotas: map[string]CheckinQuotaRange{},
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取签到额度范围
func GetCheckinQuotaRange() (min, max int) {
	return normalizeCheckinQuotaRange(CheckinQuotaRange{
		MinQuota: checkinSetting.MinQuota,
		MaxQuota: checkinSetting.MaxQuota,
	})
}

func GetCheckinQuotaRangeForGroup(group string) (min, max int) {
	defaultMin, defaultMax := GetCheckinQuotaRange()
	if checkinSetting.GroupQuotas == nil {
		return defaultMin, defaultMax
	}

	if quotaRange, ok := checkinSetting.GroupQuotas[strings.TrimSpace(group)]; ok {
		return normalizeCheckinQuotaRangeWithFallback(quotaRange, defaultMin, defaultMax)
	}

	canonicalGroup := normalizeCheckinGroup(group)
	if quotaRange, ok := checkinSetting.GroupQuotas[canonicalGroup]; ok {
		return normalizeCheckinQuotaRangeWithFallback(quotaRange, defaultMin, defaultMax)
	}

	return defaultMin, defaultMax
}

func UpdateCheckinGroupQuotasByJSONString(jsonStr string) error {
	groupQuotas, err := ParseCheckinGroupQuotas(jsonStr)
	if err != nil {
		return err
	}
	checkinSetting.GroupQuotas = groupQuotas
	return nil
}

func ValidateCheckinGroupQuotas(jsonStr string) error {
	_, err := ParseCheckinGroupQuotas(jsonStr)
	return err
}

func ParseCheckinGroupQuotas(jsonStr string) (map[string]CheckinQuotaRange, error) {
	jsonStr = strings.TrimSpace(jsonStr)
	if jsonStr == "" || jsonStr == "null" {
		return map[string]CheckinQuotaRange{}, nil
	}

	rawGroupQuotas := make(map[string]CheckinQuotaRange)
	if err := common.UnmarshalJsonStr(jsonStr, &rawGroupQuotas); err != nil {
		return nil, fmt.Errorf("分组签到额度不是合法的 JSON 对象: %w", err)
	}

	groupQuotas := make(map[string]CheckinQuotaRange, len(rawGroupQuotas))
	for group, quotaRange := range rawGroupQuotas {
		group = strings.TrimSpace(group)
		if group == "" {
			return nil, fmt.Errorf("分组签到额度包含空分组名")
		}
		if quotaRange.MinQuota < 0 || quotaRange.MaxQuota < 0 {
			return nil, fmt.Errorf("分组 %s 的签到额度不能为负数", group)
		}
		if quotaRange.MaxQuota < quotaRange.MinQuota {
			return nil, fmt.Errorf("分组 %s 的最大签到额度不能小于最小额度", group)
		}
		groupQuotas[group] = quotaRange
	}

	return groupQuotas, nil
}

func normalizeCheckinQuotaRange(quotaRange CheckinQuotaRange) (min, max int) {
	min = quotaRange.MinQuota
	max = quotaRange.MaxQuota
	if min < 0 {
		min = 0
	}
	if max < min {
		max = min
	}
	return min, max
}

func normalizeCheckinQuotaRangeWithFallback(quotaRange CheckinQuotaRange, fallbackMin int, fallbackMax int) (min, max int) {
	if quotaRange.MinQuota < 0 || quotaRange.MaxQuota < quotaRange.MinQuota {
		return fallbackMin, fallbackMax
	}
	return normalizeCheckinQuotaRange(quotaRange)
}

func normalizeCheckinGroup(group string) string {
	group = strings.ToLower(strings.TrimSpace(group))
	group = strings.ReplaceAll(group, " ", "")
	group = strings.ReplaceAll(group, "_", "")
	group = strings.ReplaceAll(group, "-", "")

	switch {
	case group == "":
		return "default"
	case strings.Contains(group, "ultra"):
		return "ultra"
	case strings.Contains(group, "super") || strings.Contains(group, "spuer"):
		return "super"
	case strings.Contains(group, "pro"):
		return "pro"
	case strings.Contains(group, "standard") || strings.Contains(group, "stand"):
		return "standard"
	default:
		return group
	}
}
