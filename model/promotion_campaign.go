package model

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PromotionCampaign — 活动主表。
// slug 是稳定路由 key，建后**不可改**（路由 + top_ups.promotion_sku_id 的 sku_key
// 前缀依赖它）。soft delete 用 GORM deleted_at；admin 删活动只软删，订单日志
// 仍能通过 sku_key 解析。
type PromotionCampaign struct {
	Id                   int            `json:"id"`
	Slug                 string         `json:"slug" gorm:"type:varchar(64);not null;uniqueIndex:idx_promo_slug"`
	Title                string         `json:"title" gorm:"type:varchar(191);not null"`
	Subtitle             string         `json:"subtitle" gorm:"type:varchar(255);default:''"`
	Emoji                string         `json:"emoji" gorm:"type:varchar(16);default:''"`
	ThemeColor           string         `json:"theme_color" gorm:"type:varchar(16);default:'pink'"`
	LayoutVariant        string         `json:"layout_variant" gorm:"type:varchar(32);default:''"`
	StartsAt             int64          `json:"starts_at" gorm:"bigint;not null"`
	EndsAt               int64          `json:"ends_at" gorm:"bigint;not null"`
	Enabled              bool           `json:"enabled" gorm:"default:false;index"`
	RequireEmailVerified bool           `json:"require_email_verified" gorm:"default:false"`
	MinAccountAgeDays    int            `json:"min_account_age_days" gorm:"default:0"`
	TotalLimit           int            `json:"total_limit" gorm:"default:0"`     // 0 = 不限
	PerUserLimit         int            `json:"per_user_limit" gorm:"default:0"`
	ShowTopupBanner      bool           `json:"show_topup_banner" gorm:"default:true"`
	ShowDashboardCard    bool           `json:"show_dashboard_card" gorm:"default:false"`
	SortOrder            int            `json:"sort_order" gorm:"default:0"`
	CreatedTime          int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime          int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt            gorm.DeletedAt `json:"-" gorm:"index"`
}

// PromotionSku — SKU 子表。
// sku_key 是 top_ups.promotion_sku_id 引用的稳定字符串；建议格式 "p{slug}-sku-{n}"
// 但 admin 可自定义。enabled=0 表示禁用（隐藏不卖，但历史订单仍可解析）。
type PromotionSku struct {
	Id               int             `json:"id"`
	SkuKey           string          `json:"sku_key" gorm:"type:varchar(64);not null;uniqueIndex:idx_promo_sku_key"`
	CampaignId       int             `json:"campaign_id" gorm:"not null;index:idx_promo_sku_campaign"`
	SortOrder        int             `json:"sort_order" gorm:"default:0"`
	Label            string          `json:"label" gorm:"type:varchar(64);not null"`
	Subtitle         string          `json:"subtitle" gorm:"type:varchar(128);default:''"`
	Emoji            string          `json:"emoji" gorm:"type:varchar(16);default:''"`
	PriceYuan        decimal.Decimal `json:"price_yuan" gorm:"type:decimal(10,2);not null"`
	DeliveredYuan    decimal.Decimal `json:"delivered_yuan" gorm:"type:decimal(10,2);not null"`
	PriceDisplay     string          `json:"price_display" gorm:"type:varchar(32);default:''"`
	DeliveredDisplay string          `json:"delivered_display" gorm:"type:varchar(32);default:''"`
	Highlight        bool            `json:"highlight" gorm:"default:false"`
	TotalLimit       int             `json:"total_limit" gorm:"default:0"`
	PerUserLimit     int             `json:"per_user_limit" gorm:"default:0"`
	Enabled          bool            `json:"enabled" gorm:"default:true"`
	CreatedTime      int64           `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64           `json:"updated_time" gorm:"bigint"`
}

// 错误。
var (
	ErrPromotionNotFound      = errors.New("promotion not found")
	ErrPromotionSkuNotFound   = errors.New("promotion sku not found")
	ErrPromotionSlugInvalid   = errors.New("invalid promotion slug")
	ErrPromotionSlugDuplicate = errors.New("promotion slug already exists")
	ErrPromotionSkuKeyDup     = errors.New("promotion sku_key already exists")
	ErrPromotionSkuInUse      = errors.New("promotion sku has existing orders; disable instead of delete")
	ErrPromotionTimeRange     = errors.New("ends_at must be after starts_at")
)

var promotionSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$`)

// ValidateSlug — slug 必须满足 a-z0-9- 且长度 1-64。
func ValidatePromotionSlug(slug string) error {
	if !promotionSlugPattern.MatchString(slug) {
		return ErrPromotionSlugInvalid
	}
	return nil
}

// ===============================================================
// 进程内缓存
// ===============================================================
//
// 公开读路径（banner / 落地页 / 入账）高频被访问，30 秒 TTL 进程内缓存避免每个
// 请求都查 DB。Admin 写路径（CRUD）调用 InvalidatePromotionCache() 立即失效。
//
// 不用 Redis：每个进程独立缓存，多 master 节点最多 30 秒不一致，业务无感。

type promotionCache struct {
	mu             sync.RWMutex
	expireAt       time.Time
	campaigns      []PromotionCampaign            // 仅 enabled + 未软删，按 SortOrder ASC
	skusByCampaign map[int][]PromotionSku         // campaign_id → 该活动 enabled SKU 列表
	skuByKey       map[string]promotionSkuRefView // sku_key → SKU + 所属 campaign 引用
}

type promotionSkuRefView struct {
	Sku      PromotionSku
	Campaign PromotionCampaign
}

var pCache = &promotionCache{}

const promotionCacheTTL = 30 * time.Second

// InvalidatePromotionCache — admin 任意写操作后调用。
func InvalidatePromotionCache() {
	pCache.mu.Lock()
	defer pCache.mu.Unlock()
	pCache.expireAt = time.Time{}
}

func refreshPromotionCacheLocked() error {
	var campaigns []PromotionCampaign
	if err := DB.Where("enabled = ?", true).Order("sort_order ASC, id ASC").Find(&campaigns).Error; err != nil {
		return err
	}
	if len(campaigns) == 0 {
		pCache.campaigns = nil
		pCache.skusByCampaign = map[int][]PromotionSku{}
		pCache.skuByKey = map[string]promotionSkuRefView{}
		pCache.expireAt = time.Now().Add(promotionCacheTTL)
		return nil
	}
	campaignIds := make([]int, 0, len(campaigns))
	for _, c := range campaigns {
		campaignIds = append(campaignIds, c.Id)
	}
	var skus []PromotionSku
	if err := DB.Where("campaign_id IN ? AND enabled = ?", campaignIds, true).
		Order("campaign_id ASC, sort_order ASC, id ASC").Find(&skus).Error; err != nil {
		return err
	}
	byCampaign := make(map[int][]PromotionSku, len(campaigns))
	byKey := make(map[string]promotionSkuRefView, len(skus))
	campaignMap := make(map[int]PromotionCampaign, len(campaigns))
	for _, c := range campaigns {
		campaignMap[c.Id] = c
	}
	for _, s := range skus {
		byCampaign[s.CampaignId] = append(byCampaign[s.CampaignId], s)
		if c, ok := campaignMap[s.CampaignId]; ok {
			byKey[s.SkuKey] = promotionSkuRefView{Sku: s, Campaign: c}
		}
	}
	pCache.campaigns = campaigns
	pCache.skusByCampaign = byCampaign
	pCache.skuByKey = byKey
	pCache.expireAt = time.Now().Add(promotionCacheTTL)
	return nil
}

func ensurePromotionCache() error {
	pCache.mu.RLock()
	fresh := !pCache.expireAt.IsZero() && time.Now().Before(pCache.expireAt)
	pCache.mu.RUnlock()
	if fresh {
		return nil
	}
	pCache.mu.Lock()
	defer pCache.mu.Unlock()
	// 双重检查避免重复加载
	if !pCache.expireAt.IsZero() && time.Now().Before(pCache.expireAt) {
		return nil
	}
	return refreshPromotionCacheLocked()
}

// ===============================================================
// 公开读 API（缓存路径）
// ===============================================================

// ListEnabledCampaigns — 返回当前 enabled（**不论是否在窗口期**）活动，按 SortOrder 排序。
// 是否在窗口期由调用方用 IsInWindow() 判断；这样 admin "未开始" 状态也能展示给用户。
func ListEnabledCampaigns() ([]PromotionCampaign, error) {
	if err := ensurePromotionCache(); err != nil {
		return nil, err
	}
	pCache.mu.RLock()
	defer pCache.mu.RUnlock()
	out := make([]PromotionCampaign, len(pCache.campaigns))
	copy(out, pCache.campaigns)
	return out, nil
}

// ListActiveCampaigns — 当前 enabled + 在窗口期内的活动。
func ListActiveCampaigns() ([]PromotionCampaign, error) {
	all, err := ListEnabledCampaigns()
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	out := make([]PromotionCampaign, 0, len(all))
	for _, c := range all {
		if now >= c.StartsAt && now <= c.EndsAt {
			out = append(out, c)
		}
	}
	return out, nil
}

// FindCampaignBySlugCached — 缓存命中的活动查询（含 disabled，所以 admin 也走此路径要小心）。
// 仅返回 enabled 活动（缓存里就只有 enabled），未找到返回 nil, nil。
func FindCampaignBySlugCached(slug string) (*PromotionCampaign, error) {
	if err := ensurePromotionCache(); err != nil {
		return nil, err
	}
	pCache.mu.RLock()
	defer pCache.mu.RUnlock()
	for i := range pCache.campaigns {
		if pCache.campaigns[i].Slug == slug {
			c := pCache.campaigns[i]
			return &c, nil
		}
	}
	return nil, nil
}

// ListSkusByCampaignCached — 返回某 campaign 的 enabled SKU。
func ListSkusByCampaignCached(campaignID int) ([]PromotionSku, error) {
	if err := ensurePromotionCache(); err != nil {
		return nil, err
	}
	pCache.mu.RLock()
	defer pCache.mu.RUnlock()
	list := pCache.skusByCampaign[campaignID]
	out := make([]PromotionSku, len(list))
	copy(out, list)
	return out, nil
}

// FindSkuByKey — 入账高频路径，跟 enabled 状态无关：哪怕 SKU 被禁用了，历史订单
// 也要能解析。所以这里**不走 enabled-only 缓存**，直接 DB 查（带小缓存：sku_key
// 永久不变，可缓存 60 秒）。
//
// 同时返回所属 campaign 用于做权限/上下文检查。
var skuByKeyLongCache sync.Map // sku_key → *PromotionSku
type cachedSku struct {
	sku       PromotionSku
	campaign  PromotionCampaign
	expiresAt time.Time
}

const skuKeyLongCacheTTL = 60 * time.Second

func FindSkuByKey(skuKey string) (*PromotionSku, *PromotionCampaign, error) {
	if skuKey == "" {
		return nil, nil, ErrPromotionSkuNotFound
	}
	if v, ok := skuByKeyLongCache.Load(skuKey); ok {
		c := v.(*cachedSku)
		if time.Now().Before(c.expiresAt) {
			s, p := c.sku, c.campaign
			return &s, &p, nil
		}
	}
	var sku PromotionSku
	if err := DB.Where("sku_key = ?", skuKey).First(&sku).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrPromotionSkuNotFound
		}
		return nil, nil, err
	}
	var campaign PromotionCampaign
	if err := DB.Unscoped().Where("id = ?", sku.CampaignId).First(&campaign).Error; err != nil {
		return nil, nil, err
	}
	skuByKeyLongCache.Store(skuKey, &cachedSku{
		sku:       sku,
		campaign:  campaign,
		expiresAt: time.Now().Add(skuKeyLongCacheTTL),
	})
	return &sku, &campaign, nil
}

func invalidateSkuByKeyCache(skuKey string) {
	if skuKey == "" {
		return
	}
	skuByKeyLongCache.Delete(skuKey)
}

// IsInWindow — 时间窗口判断（不看 enabled）。
func (c *PromotionCampaign) IsInWindow() bool {
	if c == nil {
		return false
	}
	now := time.Now().Unix()
	return now >= c.StartsAt && now <= c.EndsAt
}

// IsCurrentlyActive — enabled + 在窗口期内。
func (c *PromotionCampaign) IsCurrentlyActive() bool {
	return c != nil && c.Enabled && c.IsInWindow()
}

// ===============================================================
// Admin CRUD
// ===============================================================

// CreateCampaign — 写入活动（slug 必须未占用）。
func CreateCampaign(c *PromotionCampaign) error {
	if err := ValidatePromotionSlug(c.Slug); err != nil {
		return err
	}
	if c.EndsAt <= c.StartsAt {
		return ErrPromotionTimeRange
	}
	now := time.Now().Unix()
	c.CreatedTime = now
	c.UpdatedTime = now
	err := DB.Create(c).Error
	if err != nil {
		if isDuplicateKey(err) {
			return ErrPromotionSlugDuplicate
		}
		return err
	}
	InvalidatePromotionCache()
	return nil
}

// UpdateCampaign — 改活动；slug 不允许变（前端禁用）。
func UpdateCampaign(c *PromotionCampaign) error {
	if c.Id == 0 {
		return ErrPromotionNotFound
	}
	if c.EndsAt <= c.StartsAt {
		return ErrPromotionTimeRange
	}
	c.UpdatedTime = time.Now().Unix()
	// 显式不更新 Slug / CreatedTime / DeletedAt
	res := DB.Model(&PromotionCampaign{}).
		Where("id = ?", c.Id).
		Updates(map[string]interface{}{
			"title":                  c.Title,
			"subtitle":               c.Subtitle,
			"emoji":                  c.Emoji,
			"theme_color":            c.ThemeColor,
			"layout_variant":         c.LayoutVariant,
			"starts_at":              c.StartsAt,
			"ends_at":                c.EndsAt,
			"enabled":                c.Enabled,
			"require_email_verified": c.RequireEmailVerified,
			"min_account_age_days":   c.MinAccountAgeDays,
			"total_limit":            c.TotalLimit,
			"per_user_limit":         c.PerUserLimit,
			"show_topup_banner":      c.ShowTopupBanner,
			"show_dashboard_card":    c.ShowDashboardCard,
			"sort_order":             c.SortOrder,
			"updated_time":           c.UpdatedTime,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPromotionNotFound
	}
	InvalidatePromotionCache()
	return nil
}

// GetCampaignById — admin 详情查询，可见软删 / 禁用活动。
// includeDeleted=true 时连软删的也查。
func GetCampaignById(id int, includeDeleted bool) (*PromotionCampaign, error) {
	var c PromotionCampaign
	tx := DB
	if includeDeleted {
		tx = DB.Unscoped()
	}
	if err := tx.Where("id = ?", id).First(&c).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPromotionNotFound
		}
		return nil, err
	}
	return &c, nil
}

// ListAllCampaigns — admin 列表（含禁用），不含软删。
func ListAllCampaigns() ([]PromotionCampaign, error) {
	var out []PromotionCampaign
	err := DB.Order("sort_order ASC, id ASC").Find(&out).Error
	return out, err
}

// SoftDeleteCampaign — 软删活动 + 其所有 SKU 标 enabled=0。
func SoftDeleteCampaign(id int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		// 先把 SKU 全禁用避免落地页还查到
		if err := tx.Model(&PromotionSku{}).
			Where("campaign_id = ?", id).
			Updates(map[string]interface{}{"enabled": false, "updated_time": time.Now().Unix()}).Error; err != nil {
			return err
		}
		res := tx.Delete(&PromotionCampaign{}, id)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrPromotionNotFound
		}
		InvalidatePromotionCache()
		// 不能 invalidate 所有 sku-by-key 缓存（key 不知道），但 60s 自然过期
		return nil
	})
}

// CloneCampaign — 复制一份活动 + 全部 SKU。新 slug 由调用方提供（必须未占用）。
// 新活动默认 enabled=false，开始 / 结束时间复用原值（admin 之后改）。
func CloneCampaign(srcId int, newSlug, newTitle string) (*PromotionCampaign, error) {
	if err := ValidatePromotionSlug(newSlug); err != nil {
		return nil, err
	}
	src, err := GetCampaignById(srcId, false)
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	clone := *src
	clone.Id = 0
	clone.Slug = newSlug
	if newTitle != "" {
		clone.Title = newTitle
	} else {
		clone.Title = src.Title + "（副本）"
	}
	clone.Enabled = false
	clone.CreatedTime = now
	clone.UpdatedTime = now
	clone.DeletedAt = gorm.DeletedAt{}
	var srcSkus []PromotionSku
	if err := DB.Where("campaign_id = ?", srcId).Order("sort_order ASC").Find(&srcSkus).Error; err != nil {
		return nil, err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&clone).Error; err != nil {
			if isDuplicateKey(err) {
				return ErrPromotionSlugDuplicate
			}
			return err
		}
		for i, s := range srcSkus {
			cs := s
			cs.Id = 0
			cs.CampaignId = clone.Id
			cs.SkuKey = fmt.Sprintf("p%s-sku-%d", newSlug, i+1)
			cs.CreatedTime = now
			cs.UpdatedTime = now
			if err := tx.Create(&cs).Error; err != nil {
				if isDuplicateKey(err) {
					return ErrPromotionSkuKeyDup
				}
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	InvalidatePromotionCache()
	return &clone, nil
}

// ===============================================================
// SKU CRUD
// ===============================================================

// CreateSku — 加 SKU。sku_key 必须全局唯一。
func CreateSku(s *PromotionSku) error {
	if s.SkuKey == "" {
		return ErrPromotionSkuKeyDup
	}
	if s.CampaignId == 0 {
		return ErrPromotionNotFound
	}
	now := time.Now().Unix()
	s.CreatedTime = now
	s.UpdatedTime = now
	err := DB.Create(s).Error
	if err != nil {
		if isDuplicateKey(err) {
			return ErrPromotionSkuKeyDup
		}
		return err
	}
	InvalidatePromotionCache()
	invalidateSkuByKeyCache(s.SkuKey)
	return nil
}

// UpdateSku — 改 SKU。sku_key 不允许动（避免历史订单失联）。
func UpdateSku(s *PromotionSku) error {
	if s.Id == 0 {
		return ErrPromotionSkuNotFound
	}
	s.UpdatedTime = time.Now().Unix()
	res := DB.Model(&PromotionSku{}).
		Where("id = ?", s.Id).
		Updates(map[string]interface{}{
			"sort_order":        s.SortOrder,
			"label":             s.Label,
			"subtitle":          s.Subtitle,
			"emoji":             s.Emoji,
			"price_yuan":        s.PriceYuan,
			"delivered_yuan":    s.DeliveredYuan,
			"price_display":     s.PriceDisplay,
			"delivered_display": s.DeliveredDisplay,
			"highlight":         s.Highlight,
			"total_limit":       s.TotalLimit,
			"per_user_limit":    s.PerUserLimit,
			"enabled":           s.Enabled,
			"updated_time":      s.UpdatedTime,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPromotionSkuNotFound
	}
	InvalidatePromotionCache()
	// 这里没法精确 invalidate sku-by-key 缓存（不知道 key），自然过期即可
	return nil
}

// GetSkuById — admin 编辑用。
func GetSkuById(id int) (*PromotionSku, error) {
	var s PromotionSku
	if err := DB.Where("id = ?", id).First(&s).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPromotionSkuNotFound
		}
		return nil, err
	}
	return &s, nil
}

// ListAllSkusByCampaign — admin 编辑页 SKU 列表（含禁用，不含软删的；SKU 无软删）。
func ListAllSkusByCampaign(campaignID int) ([]PromotionSku, error) {
	var out []PromotionSku
	err := DB.Where("campaign_id = ?", campaignID).Order("sort_order ASC, id ASC").Find(&out).Error
	return out, err
}

// DeleteSku — 真删 SKU；若已有订单引用则报错（admin 应该改用 enabled=false）。
func DeleteSku(id int) error {
	s, err := GetSkuById(id)
	if err != nil {
		return err
	}
	var cnt int64
	if err := DB.Model(&TopUp{}).Where("promotion_sku_id = ?", s.SkuKey).Count(&cnt).Error; err != nil {
		return err
	}
	if cnt > 0 {
		return ErrPromotionSkuInUse
	}
	if err := DB.Delete(&PromotionSku{}, id).Error; err != nil {
		return err
	}
	InvalidatePromotionCache()
	invalidateSkuByKeyCache(s.SkuKey)
	return nil
}

// ReorderSkus — 批量更新 sort_order；ids 顺序就是新顺序。
func ReorderSkus(campaignID int, ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	now := time.Now().Unix()
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			res := tx.Model(&PromotionSku{}).
				Where("id = ? AND campaign_id = ?", id, campaignID).
				Updates(map[string]interface{}{"sort_order": i, "updated_time": now})
			if res.Error != nil {
				return res.Error
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	InvalidatePromotionCache()
	return nil
}

// ===============================================================
// 销售统计
// ===============================================================

// CountCampaignSold — 整个活动的成功订单数。
func CountCampaignSold(campaignID int) (int64, error) {
	var skus []PromotionSku
	if err := DB.Where("campaign_id = ?", campaignID).Find(&skus).Error; err != nil {
		return 0, err
	}
	if len(skus) == 0 {
		return 0, nil
	}
	keys := make([]string, len(skus))
	for i, s := range skus {
		keys[i] = s.SkuKey
	}
	var n int64
	err := DB.Model(&TopUp{}).
		Where("promotion_sku_id IN ? AND status = ?", keys, common.TopUpStatusSuccess).
		Count(&n).Error
	return n, err
}

// CountUserCampaignPurchases — 用户在整个活动的成功购买数（用于活动级 per_user_limit）。
func CountUserCampaignPurchases(userID, campaignID int) (int64, error) {
	var skus []PromotionSku
	if err := DB.Where("campaign_id = ?", campaignID).Find(&skus).Error; err != nil {
		return 0, err
	}
	if len(skus) == 0 {
		return 0, nil
	}
	keys := make([]string, len(skus))
	for i, s := range skus {
		keys[i] = s.SkuKey
	}
	var n int64
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND promotion_sku_id IN ? AND status = ?", userID, keys, common.TopUpStatusSuccess).
		Count(&n).Error
	return n, err
}

// CampaignSalesStats — 单活动销售统计聚合。
type CampaignSalesStats struct {
	TotalOrders int64                  `json:"total_orders"`
	TotalAmount decimal.Decimal        `json:"total_amount"` // 价格金额合计（实付）
	BySku       []SkuSalesStats        `json:"by_sku"`
}

type SkuSalesStats struct {
	SkuKey  string          `json:"sku_key"`
	Label   string          `json:"label"`
	Sold    int64           `json:"sold"`
	Revenue decimal.Decimal `json:"revenue"` // 价格金额合计
}

// AggregateCampaignStats — admin 统计页用。
func AggregateCampaignStats(campaignID int) (*CampaignSalesStats, error) {
	skus, err := ListAllSkusByCampaign(campaignID)
	if err != nil {
		return nil, err
	}
	stats := &CampaignSalesStats{}
	if len(skus) == 0 {
		return stats, nil
	}
	for _, s := range skus {
		var n int64
		if err := DB.Model(&TopUp{}).
			Where("promotion_sku_id = ? AND status = ?", s.SkuKey, common.TopUpStatusSuccess).
			Count(&n).Error; err != nil {
			return nil, err
		}
		revenue := s.PriceYuan.Mul(decimal.NewFromInt(n))
		stats.BySku = append(stats.BySku, SkuSalesStats{
			SkuKey:  s.SkuKey,
			Label:   s.Label,
			Sold:    n,
			Revenue: revenue,
		})
		stats.TotalOrders += n
		stats.TotalAmount = stats.TotalAmount.Add(revenue)
	}
	return stats, nil
}

// ===============================================================
// helpers
// ===============================================================

// isDuplicateKey — 检测 GORM/MySQL/Postgres/SQLite 的唯一约束冲突。
func isDuplicateKey(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique_violation") ||
		strings.Contains(msg, "1062")
}

// ===============================================================
// Seed
// ===============================================================

// SeedDefaultPromotions — 启动时一次性写入默认活动。
//
// 触发条件：promotion_campaigns 表 Unscoped count == 0（包括软删的记录）。
// 这样 admin 编辑/删除/禁用过任何活动后，重启不会被这里再次覆盖。
//
// 当前唯一默认活动：520 充值狂欢（数据与历史 setting/promotion.go 一致，
// sku_key 与已有 top_ups.promotion_sku_id 引用对齐）。
func SeedDefaultPromotions() error {
	var n int64
	if err := DB.Unscoped().Model(&PromotionCampaign{}).Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return seed520()
}

func seed520() error {
	now := time.Now().Unix()
	// 时间窗口：2026-05-19 12:00 ~ 2026-05-20 23:59 +08
	startsAt, _ := time.Parse(time.RFC3339, "2026-05-19T12:00:00+08:00")
	endsAt, _ := time.Parse(time.RFC3339, "2026-05-20T23:59:59+08:00")
	campaign := PromotionCampaign{
		Slug:                 "520",
		Title:                "520 充值狂欢",
		Subtitle:             "我爱你的同时也爱你的钱包 · 限时 9 折起 — 来自 Claude Opus 4.7",
		Emoji:                "❤️",
		ThemeColor:           "pink",
		StartsAt:             startsAt.Unix(),
		EndsAt:               endsAt.Unix(),
		Enabled:              true,
		RequireEmailVerified: true,
		ShowTopupBanner:      true,
		CreatedTime:          now,
		UpdatedTime:          now,
	}
	skus := []PromotionSku{
		{
			SkuKey:           "p520-sku-1",
			SortOrder:        1,
			Label:            "5 块钱给我点关爱",
			Subtitle:         "充 ¥4.99 到账 ¥5.20",
			Emoji:            "🌱",
			PriceYuan:        decimal.NewFromFloat(4.99),
			DeliveredYuan:    decimal.NewFromFloat(5.20),
			PriceDisplay:     "4.99",
			DeliveredDisplay: "5.20",
			PerUserLimit:     5,
			Enabled:          true,
		},
		{
			SkuKey:           "p520-sku-2",
			SortOrder:        2,
			Label:            "一生一世小礼物",
			Subtitle:         "充 ¥11.99 到账 ¥13.14",
			Emoji:            "💝",
			PriceYuan:        decimal.NewFromFloat(11.99),
			DeliveredYuan:    decimal.NewFromFloat(13.14),
			PriceDisplay:     "11.99",
			DeliveredDisplay: "13.14",
			TotalLimit:       1314,
			PerUserLimit:     3,
			Enabled:          true,
		},
		{
			SkuKey:           "p520-sku-3",
			SortOrder:        3,
			Label:            "我爱你之充电站",
			Subtitle:         "充 ¥46.99 到账 ¥52.0",
			Emoji:            "❤️",
			PriceYuan:        decimal.NewFromFloat(46.99),
			DeliveredYuan:    decimal.NewFromFloat(52.0),
			PriceDisplay:     "46.99",
			DeliveredDisplay: "52.0",
			Highlight:        true,
			TotalLimit:       520,
			PerUserLimit:     2,
			Enabled:          true,
		},
		{
			SkuKey:           "p520-sku-4",
			SortOrder:        4,
			Label:            "长长久久",
			Subtitle:         "充 ¥89.99 到账 ¥99.99",
			Emoji:            "💎",
			PriceYuan:        decimal.NewFromFloat(89.99),
			DeliveredYuan:    decimal.NewFromFloat(99.99),
			PriceDisplay:     "89.99",
			DeliveredDisplay: "99.99",
			TotalLimit:       99,
			PerUserLimit:     1,
			Enabled:          true,
		},
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&campaign).Error; err != nil {
			return err
		}
		for i := range skus {
			skus[i].CampaignId = campaign.Id
			skus[i].CreatedTime = now
			skus[i].UpdatedTime = now
		}
		return tx.Create(&skus).Error
	})
}

// EnsureKids61Campaign — 幂等写入六一儿童节活动。
// 仅在 slug="children-day-2026" 不存在时插入；已存在则跳过（admin 可自由修改）。
// 活动默认 enabled=false，需 admin 手动开启。
func EnsureKids61Campaign() error {
	var n int64
	if err := DB.Unscoped().Model(&PromotionCampaign{}).
		Where("slug = ?", "children-day-2026").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	return seedKids61()
}

func seedKids61() error {
	now := time.Now().Unix()
	// 默认窗口：即时开始 ~ 2026-06-01 23:59:59 +08:00
	startsAt := now
	endsAt, _ := time.Parse(time.RFC3339, "2026-06-01T23:59:59+08:00")

	campaign := PromotionCampaign{
		Slug:            "children-day-2026",
		Title:           "六一儿童节",
		Subtitle:        "世界很大，今天先做个小孩。",
		Emoji:           "🎈",
		ThemeColor:      "pink",
		LayoutVariant:   "kids_61",
		StartsAt:        startsAt,
		EndsAt:          endsAt.Unix(),
		Enabled:         false, // admin 手动开启
		ShowTopupBanner: true,
		SortOrder:       10,
		CreatedTime:     now,
		UpdatedTime:     now,
	}
	skus := []PromotionSku{
		{
			SkuKey:        "p61-sku-1",
			SortOrder:     1,
			Label:         "六一特惠",
			Subtitle:      "每人限购一次",
			Emoji:         "🎁",
			PriceYuan:     decimal.NewFromFloat(6.1),
			DeliveredYuan: decimal.NewFromFloat(10),
			PriceDisplay:  "6.1",
			TotalLimit:    100,
			PerUserLimit:  1,
			Enabled:       true,
		},
		{
			SkuKey:        "p61-sku-2",
			SortOrder:     2,
			Label:         "小熊礼包",
			Emoji:         "🎈",
			PriceYuan:     decimal.NewFromFloat(28),
			DeliveredYuan: decimal.NewFromFloat(30),
			PerUserLimit:  5,
			Enabled:       true,
		},
		{
			SkuKey:        "p61-sku-3",
			SortOrder:     3,
			Label:         "儿童礼包",
			Subtitle:      "呼应节日数字",
			Emoji:         "🌈",
			PriceYuan:     decimal.NewFromFloat(56),
			DeliveredYuan: decimal.NewFromFloat(61),
			PerUserLimit:  3,
			Enabled:       true,
		},
		{
			SkuKey:        "p61-sku-4",
			SortOrder:     4,
			Label:         "成长礼包",
			Emoji:         "🌟",
			PriceYuan:     decimal.NewFromFloat(98),
			DeliveredYuan: decimal.NewFromFloat(108),
			PerUserLimit:  2,
			Enabled:       true,
		},
		{
			SkuKey:        "p61-sku-5",
			SortOrder:     5,
			Label:         "欢乐礼包",
			Subtitle:      "最受欢迎",
			Emoji:         "⭐",
			PriceYuan:     decimal.NewFromFloat(168),
			DeliveredYuan: decimal.NewFromFloat(188),
			Highlight:     true,
			PerUserLimit:  2,
			Enabled:       true,
		},
		{
			SkuKey:        "p61-sku-6",
			SortOrder:     6,
			Label:         "童年礼包",
			Emoji:         "🎊",
			PriceYuan:     decimal.NewFromFloat(255),
			DeliveredYuan: decimal.NewFromFloat(288),
			PerUserLimit:  1,
			Enabled:       true,
		},
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&campaign).Error; err != nil {
			return err
		}
		for i := range skus {
			skus[i].CampaignId = campaign.Id
			skus[i].CreatedTime = now
			skus[i].UpdatedTime = now
		}
		return tx.Create(&skus).Error
	})
}
