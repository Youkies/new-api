package setting

import (
	"time"
)

// PromotionSku is a single purchase tier within a promotion campaign.
// All money values are in CNY yuan; DeliveredQuota is computed at settlement
// time using the live common.QuotaPerUnit so admin doesn't have to think in
// quota units when configuring.
type PromotionSku struct {
	ID            string  // 路由/统计/限购 key，全局唯一 — 例 "p520-sku-1"
	Label         string  // 卡片大标题 — "我爱你之充电站"
	Subtitle      string  // 卡片次行
	Emoji         string  // 装饰 emoji — "❤️"
	PriceYuan     float64 // 用户实付
	DeliveredYuan float64 // 到账（按 QuotaPerUnit 换算成 quota）
	// DeliveredDisplay / PriceDisplay：可选的字面量显示字符串。设置后前端优先
	// 用它（保证 "5.20" "52.0" 这种带尾零的写法不会被通用格式化吃掉）；留空
	// 时前端 fallback 到 fmtAmount 自动格式化。
	DeliveredDisplay string
	PriceDisplay     string
	Highlight        bool // 是否主推（卡片加金色光晕）
	TotalLimit       int  // 0 = 不限总数
	PerUserLimit     int  // 0 = 不限每人，否则单用户购买上限
}

// PromotionCampaign 描述一个限时活动；v1 写死，不进数据库。后续需要多活动并存或
// 让运营自助配置时再升级为表驱动版本。
type PromotionCampaign struct {
	Slug       string
	Title      string
	Subtitle   string
	Emoji      string // 落地页头部主 emoji
	ThemeColor string // pink / purple / blue / green / yellow（对应 Clay token）
	StartsAt   int64  // unix 秒
	EndsAt     int64
	Enabled    bool
	Skus       []PromotionSku
	// 防滥用门槛
	RequireEmailVerified bool
	MinAccountAgeDays    int
}

// Promotion520 — 2026 520 充值狂欢活动。
// 价格按方案 C（.99 心理定价）全部锁定在 ≤ 9 折。
// 限购按梗设计：1314 / 520 / 99 总数呼应到账金额数字。
var Promotion520 = PromotionCampaign{
	Slug:       "520",
	Title:      "520 充值狂欢",
	Subtitle:   "我爱你的同时也爱你的钱包 · 限时 9 折起 — 来自 Claude Opus 4.7",
	Emoji:      "❤️",
	ThemeColor: "pink",
	// 5/19 12:00 +08 → 5/21 23:59:59 +08
	StartsAt:             mustTime("2026-05-19T12:00:00+08:00"),
	EndsAt:               mustTime("2026-05-21T23:59:59+08:00"),
	Enabled:              true,
	RequireEmailVerified: true,
	MinAccountAgeDays:    0,
	Skus: []PromotionSku{
		{
			ID:               "p520-sku-1",
			Label:            "5 块钱给我点关爱",
			Subtitle:         "充 ¥4.99 到账 ¥5.20",
			Emoji:            "🌱",
			PriceYuan:        4.99,
			DeliveredYuan:    5.20,
			PriceDisplay:     "4.99",
			DeliveredDisplay: "5.20",
			TotalLimit:       0,
			PerUserLimit:     5,
		},
		{
			ID:               "p520-sku-2",
			Label:            "一生一世小礼物",
			Subtitle:         "充 ¥11.99 到账 ¥13.14",
			Emoji:            "💝",
			PriceYuan:        11.99,
			DeliveredYuan:    13.14,
			PriceDisplay:     "11.99",
			DeliveredDisplay: "13.14",
			TotalLimit:       1314,
			PerUserLimit:     3,
		},
		{
			ID:               "p520-sku-3",
			Label:            "我爱你之充电站",
			Subtitle:         "充 ¥46.99 到账 ¥52.0",
			Emoji:            "❤️",
			PriceYuan:        46.99,
			DeliveredYuan:    52.0,
			PriceDisplay:     "46.99",
			DeliveredDisplay: "52.0",
			Highlight:        true,
			TotalLimit:       520,
			PerUserLimit:     2,
		},
		{
			ID:               "p520-sku-4",
			Label:            "长长久久",
			Subtitle:         "充 ¥89.99 到账 ¥99.99",
			Emoji:            "💎",
			PriceYuan:        89.99,
			DeliveredYuan:    99.99,
			PriceDisplay:     "89.99",
			DeliveredDisplay: "99.99",
			TotalLimit:       99,
			PerUserLimit:     1,
		},
	},
}

// activePromotions 当前所有活动注册表。新增活动只需 append。
var activePromotions = []*PromotionCampaign{
	&Promotion520,
}

// GetActivePromotionBySlug 返回 enabled + 当前时间在窗口期内的活动；找不到返回 nil。
// 注意：禁用活动 (Enabled=false) 也返回 nil，便于 admin 临时下架。
func GetActivePromotionBySlug(slug string) *PromotionCampaign {
	now := time.Now().Unix()
	for _, p := range activePromotions {
		if p.Slug != slug || !p.Enabled {
			continue
		}
		if now < p.StartsAt || now > p.EndsAt {
			// 窗口外：返回活动定义（前端用来显示"活动已结束/未开始"），但下单 API 自己判断
			return p
		}
		return p
	}
	return nil
}

// GetPromotionByAnyStatus 不看窗口期、不看 enabled，纯按 slug 查；用于诊断 / admin 列表。
func GetPromotionByAnyStatus(slug string) *PromotionCampaign {
	for _, p := range activePromotions {
		if p.Slug == slug {
			return p
		}
	}
	return nil
}

// GetPromotionSku 全局按 sku.ID 查找 — 跨活动唯一约束依赖 ID 前缀（"p520-sku-1"）。
func GetPromotionSku(skuID string) (*PromotionCampaign, *PromotionSku) {
	if skuID == "" {
		return nil, nil
	}
	for _, p := range activePromotions {
		for i := range p.Skus {
			if p.Skus[i].ID == skuID {
				return p, &p.Skus[i]
			}
		}
	}
	return nil, nil
}

// IsPromotionActive 当前时间是否落在活动窗口（用于下单时硬校验）。
func (p *PromotionCampaign) IsActive() bool {
	if p == nil || !p.Enabled {
		return false
	}
	now := time.Now().Unix()
	return now >= p.StartsAt && now <= p.EndsAt
}

// GetTopupBannerPromotion 返回当前唯一一个仍在窗口期、enabled 的活动；
// 用于 /topup 页顶部横幅。多活动并存时只取第一个（v1 简化）。
func GetTopupBannerPromotion() *PromotionCampaign {
	for _, p := range activePromotions {
		if p.IsActive() {
			return p
		}
	}
	return nil
}

// ListActivePromotions 返回当前所有正在进行（enabled + 窗口内）的活动。
func ListActivePromotions() []*PromotionCampaign {
	var out []*PromotionCampaign
	for _, p := range activePromotions {
		if p.IsActive() {
			out = append(out, p)
		}
	}
	return out
}

func mustTime(s string) int64 {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		// 启动时立刻 panic 比线上出问题好
		panic("promotion: bad time literal " + s + ": " + err.Error())
	}
	return t.Unix()
}
