package model

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const uiPageConfigMaxAPIURLs = 10
const uiPageMembershipBadgesOptionKey = "ui_page_config.membership_badges"

var ErrUIPageConfigTableMissing = errors.New("页面配置表 ui_page_configs 不存在，请先完成数据库迁移")

var uiPageAPIURLTones = map[string]bool{
	"pink":   true,
	"blue":   true,
	"green":  true,
	"yellow": true,
}

var uiPageAPIURLIcons = map[string]bool{
	"globe": true,
	"zap":   true,
	"link":  true,
}

type UIPageConfig struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	APIURLs   string `json:"-" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"default:0"`
	UpdatedAt int64  `json:"updated_at" gorm:"default:0"`
}

func (UIPageConfig) TableName() string {
	return "ui_page_configs"
}

type UIPageAPIURL struct {
	URL     string `json:"url"`
	Label   string `json:"label"`
	Desc    string `json:"desc"`
	Icon    string `json:"icon"`
	Tone    string `json:"tone"`
	Enabled bool   `json:"enabled"`
}

type UIPageMembershipBadge struct {
	Key        string `json:"key"`
	Label      string `json:"label"`
	ShortLabel string `json:"short_label"`
	Tagline    string `json:"tagline"`
}

func DefaultUIPageAPIURLs() []UIPageAPIURL {
	return []UIPageAPIURL{
		{
			URL:     "https://newapi.youkies.space",
			Label:   "通用地址",
			Desc:    "直连服务器，全球可访问",
			Icon:    "globe",
			Tone:    "pink",
			Enabled: true,
		},
		{
			URL:     "https://newapi.youkies.cn",
			Label:   "国内优化",
			Desc:    "国内中转加速，已备案",
			Icon:    "zap",
			Tone:    "blue",
			Enabled: true,
		},
	}
}

func DefaultUIPageMembershipBadges() []UIPageMembershipBadge {
	return []UIPageMembershipBadge{
		{Key: "default", Label: "普通用户", ShortLabel: "普通", Tagline: "基础额度与标准模型权限"},
		{Key: "standard", Label: "Standard 优", ShortLabel: "Standard", Tagline: "充值活跃用户专属签到福利"},
		{Key: "pro", Label: "Pro优", ShortLabel: "Pro", Tagline: "更优价格与常用高级模型"},
		{Key: "super", Label: "Super优", ShortLabel: "Super", Tagline: "更高调用优先级与扩展权益"},
		{Key: "ultra", Label: "Ultra优", ShortLabel: "Ultra", Tagline: "最高阶权限与旗舰模型体验"},
	}
}

func defaultUIPageConfig() *UIPageConfig {
	now := common.GetTimestamp()
	payload, _ := common.Marshal(DefaultUIPageAPIURLs())
	return &UIPageConfig{
		Id:        1,
		APIURLs:   string(payload),
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func normalizeUIPageAPIURL(item *UIPageAPIURL, index int) {
	item.URL = strings.TrimSpace(item.URL)
	item.Label = strings.TrimSpace(item.Label)
	item.Desc = strings.TrimSpace(item.Desc)
	item.Icon = strings.ToLower(strings.TrimSpace(item.Icon))
	item.Tone = strings.ToLower(strings.TrimSpace(item.Tone))
	if item.Label == "" {
		item.Label = "地址 " + strconv.Itoa(index+1)
	}
	if !uiPageAPIURLIcons[item.Icon] {
		item.Icon = "link"
	}
	if !uiPageAPIURLTones[item.Tone] {
		item.Tone = "blue"
	}
}

func NormalizeUIPageAPIURLs(items []UIPageAPIURL) []UIPageAPIURL {
	result := make([]UIPageAPIURL, 0, len(items))
	for index, item := range items {
		normalizeUIPageAPIURL(&item, index)
		result = append(result, item)
	}
	return result
}

func ValidateUIPageAPIURLs(items []UIPageAPIURL) ([]UIPageAPIURL, error) {
	if len(items) == 0 {
		return nil, errors.New("至少需要配置一个 API 地址")
	}
	if len(items) > uiPageConfigMaxAPIURLs {
		return nil, errors.New("API 地址最多配置 10 个")
	}
	items = NormalizeUIPageAPIURLs(items)
	enabledCount := 0
	for index, item := range items {
		if item.URL == "" {
			return nil, errors.New("API 地址不能为空")
		}
		parsed, err := url.Parse(item.URL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return nil, errors.New("API 地址格式不正确")
		}
		if parsed.Scheme != "http" && parsed.Scheme != "https" {
			return nil, errors.New("API 地址仅支持 http 或 https")
		}
		if len([]rune(item.Label)) > 40 {
			return nil, errors.New("API 地址名称不能超过 40 个字符")
		}
		if len([]rune(item.Desc)) > 120 {
			return nil, errors.New("API 地址说明不能超过 120 个字符")
		}
		if item.Enabled {
			enabledCount++
		}
		items[index] = item
	}
	if enabledCount == 0 {
		return nil, errors.New("至少需要启用一个 API 地址")
	}
	return items, nil
}

func (config *UIPageConfig) APIURLItems() []UIPageAPIURL {
	if config == nil || strings.TrimSpace(config.APIURLs) == "" {
		return DefaultUIPageAPIURLs()
	}
	var items []UIPageAPIURL
	if err := common.UnmarshalJsonStr(config.APIURLs, &items); err != nil || len(items) == 0 {
		return DefaultUIPageAPIURLs()
	}
	return NormalizeUIPageAPIURLs(items)
}

func EnabledUIPageAPIURLs(items []UIPageAPIURL) []UIPageAPIURL {
	result := make([]UIPageAPIURL, 0, len(items))
	for _, item := range items {
		if item.Enabled {
			result = append(result, item)
		}
	}
	return result
}

func normalizeUIPageMembershipBadgeKey(key string) string {
	key = strings.ToLower(strings.TrimSpace(key))
	key = strings.ReplaceAll(key, " ", "")
	key = strings.ReplaceAll(key, "_", "")
	key = strings.ReplaceAll(key, "-", "")
	switch {
	case key == "":
		return "default"
	case strings.Contains(key, "ultra"):
		return "ultra"
	case strings.Contains(key, "super") || strings.Contains(key, "spuer"):
		return "super"
	case strings.Contains(key, "pro"):
		return "pro"
	case strings.Contains(key, "standard") || strings.Contains(key, "stand"):
		return "standard"
	default:
		return key
	}
}

func defaultUIPageMembershipBadgeMap() map[string]UIPageMembershipBadge {
	result := make(map[string]UIPageMembershipBadge)
	for _, item := range DefaultUIPageMembershipBadges() {
		result[item.Key] = item
	}
	return result
}

func NormalizeUIPageMembershipBadges(items []UIPageMembershipBadge) []UIPageMembershipBadge {
	defaults := defaultUIPageMembershipBadgeMap()
	orderedKeys := []string{"default", "standard", "pro", "super", "ultra"}
	for _, item := range items {
		key := normalizeUIPageMembershipBadgeKey(item.Key)
		base, ok := defaults[key]
		if !ok {
			base = UIPageMembershipBadge{Key: key}
		}
		item.Key = key
		item.Label = strings.TrimSpace(item.Label)
		item.ShortLabel = strings.TrimSpace(item.ShortLabel)
		item.Tagline = strings.TrimSpace(item.Tagline)
		if item.Label == "" {
			item.Label = base.Label
		}
		if item.ShortLabel == "" {
			item.ShortLabel = base.ShortLabel
		}
		if item.Tagline == "" {
			item.Tagline = base.Tagline
		}
		defaults[key] = item
	}
	result := make([]UIPageMembershipBadge, 0, len(defaults))
	for _, key := range orderedKeys {
		if item, ok := defaults[key]; ok {
			result = append(result, item)
			delete(defaults, key)
		}
	}
	for _, item := range defaults {
		result = append(result, item)
	}
	return result
}

func ValidateUIPageMembershipBadges(items []UIPageMembershipBadge) ([]UIPageMembershipBadge, error) {
	items = NormalizeUIPageMembershipBadges(items)
	for _, item := range items {
		if len([]rune(item.Label)) > 30 {
			return nil, errors.New("会员铭牌名称不能超过 30 个字符")
		}
		if len([]rune(item.ShortLabel)) > 20 {
			return nil, errors.New("会员铭牌短名称不能超过 20 个字符")
		}
		if len([]rune(item.Tagline)) > 80 {
			return nil, errors.New("会员铭牌描述不能超过 80 个字符")
		}
	}
	return items, nil
}

func GetUIPageMembershipBadges() []UIPageMembershipBadge {
	raw := ""
	common.OptionMapRWMutex.RLock()
	if common.OptionMap != nil {
		raw = common.OptionMap[uiPageMembershipBadgesOptionKey]
	}
	common.OptionMapRWMutex.RUnlock()

	if strings.TrimSpace(raw) == "" && DB != nil {
		var option Option
		if err := DB.Where(commonKeyCol+" = ?", uiPageMembershipBadgesOptionKey).First(&option).Error; err == nil {
			raw = option.Value
		}
	}

	if strings.TrimSpace(raw) == "" {
		return DefaultUIPageMembershipBadges()
	}
	var items []UIPageMembershipBadge
	if err := common.UnmarshalJsonStr(raw, &items); err != nil {
		return DefaultUIPageMembershipBadges()
	}
	return NormalizeUIPageMembershipBadges(items)
}

func GetUIPageConfig() (*UIPageConfig, error) {
	if DB == nil {
		return defaultUIPageConfig(), nil
	}
	if !DB.Migrator().HasTable(UIPageConfig{}.TableName()) {
		return defaultUIPageConfig(), nil
	}
	var config UIPageConfig
	err := DB.First(&config, "id = ?", 1).Error
	if err == nil {
		return &config, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	configPtr := defaultUIPageConfig()
	if err = DB.Create(configPtr).Error; err != nil {
		return nil, err
	}
	return configPtr, nil
}

func SaveUIPageConfigAPIURLs(config *UIPageConfig, items []UIPageAPIURL) error {
	if config == nil {
		return errors.New("页面配置不能为空")
	}
	if DB == nil || !DB.Migrator().HasTable(UIPageConfig{}.TableName()) {
		return ErrUIPageConfigTableMissing
	}
	normalized, err := ValidateUIPageAPIURLs(items)
	if err != nil {
		return err
	}
	payload, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	config.Id = 1
	if config.CreatedAt == 0 {
		config.CreatedAt = now
	}
	config.UpdatedAt = now
	config.APIURLs = string(payload)
	return DB.Save(config).Error
}

func SaveUIPageMembershipBadges(items []UIPageMembershipBadge) error {
	normalized, err := ValidateUIPageMembershipBadges(items)
	if err != nil {
		return err
	}
	payload, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	return UpdateOption(uiPageMembershipBadgesOptionKey, string(payload))
}
