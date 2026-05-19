package controller

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// ================================================================
// Admin promotion management endpoints. 路由前缀 /api/ui/admin/promotions
// ================================================================

// adminPromotionView — admin 列表/详情通用视图。
type adminPromotionView struct {
	model.PromotionCampaign
	Skus       []adminSkuView `json:"skus,omitempty"`
	SoldCount  int64          `json:"sold_count,omitempty"`
	TotalAmount string        `json:"total_amount,omitempty"` // 用 decimal.String 避免 float 精度丢失
}

type adminSkuView struct {
	model.PromotionSku
	Sold int64 `json:"sold"`
}

// AdminListPromotions — GET /api/ui/admin/promotions
// 列出全部活动（含禁用，不含软删），按 sort_order ASC。
func AdminListPromotions(c *gin.Context) {
	campaigns, err := model.ListAllCampaigns()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	out := make([]adminPromotionView, 0, len(campaigns))
	for _, p := range campaigns {
		sold, _ := model.CountCampaignSold(p.Id)
		out = append(out, adminPromotionView{
			PromotionCampaign: p,
			SoldCount:         sold,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// AdminGetPromotion — GET /api/ui/admin/promotions/:id
// 单活动详情 + 全部 SKU（含 enabled=false 的）。
func AdminGetPromotion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	campaign, err := model.GetCampaignById(id, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	skus, err := model.ListAllSkusByCampaign(id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	skuViews := make([]adminSkuView, 0, len(skus))
	for _, s := range skus {
		sold, _ := model.CountPromotionSkuSold(s.SkuKey)
		skuViews = append(skuViews, adminSkuView{PromotionSku: s, Sold: sold})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": adminPromotionView{
		PromotionCampaign: *campaign,
		Skus:              skuViews,
	}})
}

// AdminCreatePromotion — POST /api/ui/admin/promotions
// body 是 PromotionCampaign 主体（不含 id / 软删 / 时间戳；slug + title 必填）。
func AdminCreatePromotion(c *gin.Context) {
	var body model.PromotionCampaign
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	body.Slug = strings.TrimSpace(strings.ToLower(body.Slug))
	body.Title = strings.TrimSpace(body.Title)
	if body.Slug == "" || body.Title == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "slug 和 title 不能为空"})
		return
	}
	if err := model.CreateCampaign(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": body})
}

// AdminUpdatePromotion — PUT /api/ui/admin/promotions/:id
// 改活动基本信息（不动 slug / 不动 SKU 子表，SKU 走单独接口）。
func AdminUpdatePromotion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	var body model.PromotionCampaign
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	body.Id = id
	if err := model.UpdateCampaign(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": body})
}

// AdminDeletePromotion — DELETE /api/ui/admin/promotions/:id
// 软删活动 + 把全部 SKU 标 enabled=false。已有订单的活动不影响订单解析。
func AdminDeletePromotion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	if err := model.SoftDeleteCampaign(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminClonePromotion — POST /api/ui/admin/promotions/:id/clone
// body: { slug, title }；克隆活动 + 全部 SKU（sku_key 重新按新 slug 生成）。新活动默认 disabled。
func AdminClonePromotion(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	var body struct {
		Slug  string `json:"slug"`
		Title string `json:"title"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	body.Slug = strings.TrimSpace(strings.ToLower(body.Slug))
	if body.Slug == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "新 slug 不能为空"})
		return
	}
	clone, err := model.CloneCampaign(id, body.Slug, strings.TrimSpace(body.Title))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": clone})
}

// AdminCreateSku — POST /api/ui/admin/promotions/:id/skus
func AdminCreateSku(c *gin.Context) {
	campaignID, err := strconv.Atoi(c.Param("id"))
	if err != nil || campaignID <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	var body model.PromotionSku
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	body.CampaignId = campaignID
	body.SkuKey = strings.TrimSpace(body.SkuKey)
	if body.SkuKey == "" {
		// 自动生成：p{slug}-sku-{epoch}
		camp, gErr := model.GetCampaignById(campaignID, false)
		if gErr != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": gErr.Error()})
			return
		}
		body.SkuKey = "p" + camp.Slug + "-sku-" + strconv.FormatInt(time.Now().Unix(), 10)
	}
	if body.PriceYuan.IsZero() && body.DeliveredYuan.IsZero() {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "价格和到账金额不能都为 0"})
		return
	}
	if err := model.CreateSku(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": body})
}

// AdminUpdateSku — PUT /api/ui/admin/promotions/:id/skus/:sku_id
func AdminUpdateSku(c *gin.Context) {
	skuID, err := strconv.Atoi(c.Param("sku_id"))
	if err != nil || skuID <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的 sku id"})
		return
	}
	var body model.PromotionSku
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	body.Id = skuID
	if err := model.UpdateSku(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": body})
}

// AdminDeleteSku — DELETE /api/ui/admin/promotions/:id/skus/:sku_id
// 若 SKU 已有订单引用则拒绝，admin 应改 enabled=false 隐藏。
func AdminDeleteSku(c *gin.Context) {
	skuID, err := strconv.Atoi(c.Param("sku_id"))
	if err != nil || skuID <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的 sku id"})
		return
	}
	if err := model.DeleteSku(skuID); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminReorderSkus — POST /api/ui/admin/promotions/:id/skus/reorder
// body: { ids: [sku_id1, sku_id2, ...] }；按数组顺序写 sort_order=0,1,2,...
func AdminReorderSkus(c *gin.Context) {
	campaignID, err := strconv.Atoi(c.Param("id"))
	if err != nil || campaignID <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	var body struct {
		Ids []int `json:"ids"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误：" + err.Error()})
		return
	}
	if err := model.ReorderSkus(campaignID, body.Ids); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AdminCampaignStats — GET /api/ui/admin/promotions/:id/stats
// 销售统计：每个 SKU 销量 + 营收，整活动合计。
func AdminCampaignStats(c *gin.Context) {
	campaignID, err := strconv.Atoi(c.Param("id"))
	if err != nil || campaignID <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的活动 id"})
		return
	}
	stats, err := model.AggregateCampaignStats(campaignID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	// 把 decimal 转 string 给前端，不会丢精度
	type skuOut struct {
		SkuKey  string `json:"sku_key"`
		Label   string `json:"label"`
		Sold    int64  `json:"sold"`
		Revenue string `json:"revenue"`
	}
	out := struct {
		TotalOrders int64    `json:"total_orders"`
		TotalAmount string   `json:"total_amount"`
		BySku       []skuOut `json:"by_sku"`
	}{
		TotalOrders: stats.TotalOrders,
		TotalAmount: stats.TotalAmount.StringFixed(2),
		BySku:       make([]skuOut, 0, len(stats.BySku)),
	}
	for _, s := range stats.BySku {
		out.BySku = append(out.BySku, skuOut{
			SkuKey:  s.SkuKey,
			Label:   s.Label,
			Sold:    s.Sold,
			Revenue: s.Revenue.StringFixed(2),
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// 静默 unused-import warning（decimal 间接通过 model 使用）
var _ = decimal.Zero
