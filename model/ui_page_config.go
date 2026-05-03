package model

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const uiPageConfigMaxAPIURLs = 10

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

func GetUIPageConfig() (*UIPageConfig, error) {
	var config UIPageConfig
	err := DB.First(&config, "id = ?", 1).Error
	if err == nil {
		return &config, nil
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
