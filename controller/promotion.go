package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// 活动 SKU 卡片在前端的展示态。
const (
	skuStatePurchasable      = "purchasable"       // 可购买
	skuStateSoldOut          = "sold_out"          // 全部售罄
	skuStateUserLimit        = "user_limit"        // 该用户已达个人上限
	skuStateUserHasPending   = "user_has_pending"  // 该用户在该 SKU 上有未支付订单
	skuStateActivityClosed   = "activity_closed"   // 活动未开始或已结束
	skuStateActivityDisabled = "disabled"          // 活动 SKU 被禁用
)

type promotionSkuView struct {
	Id               string  `json:"id"` // 实为 sku_key（前端调用 /order 接口要带的 id）
	Label            string  `json:"label"`
	Subtitle         string  `json:"subtitle"`
	Emoji            string  `json:"emoji"`
	PriceYuan        float64 `json:"price_yuan"`
	DeliveredYuan    float64 `json:"delivered_yuan"`
	PriceDisplay     string  `json:"price_display,omitempty"`
	DeliveredDisplay string  `json:"delivered_display,omitempty"`
	Highlight        bool    `json:"highlight"`
	TotalLimit       int     `json:"total_limit"`
	PerUserLimit     int     `json:"per_user_limit"`
	SoldCount        int64   `json:"sold_count"`
	UserBoughtN      int64   `json:"user_bought_n"`
	State            string  `json:"state"`
	UserCanBuyN      int     `json:"user_can_buy_n"`
}

type promotionView struct {
	Slug                 string             `json:"slug"`
	Title                string             `json:"title"`
	Subtitle             string             `json:"subtitle"`
	Emoji                string             `json:"emoji"`
	ThemeColor           string             `json:"theme_color"`
	LayoutVariant        string             `json:"layout_variant"`
	StartsAt             int64              `json:"starts_at"`
	EndsAt               int64              `json:"ends_at"`
	Now                  int64              `json:"now"`
	Active               bool               `json:"active"`
	Skus                 []promotionSkuView `json:"skus"`
	RequireEmailVerified bool               `json:"require_email_verified"`
	MinAccountAgeDays    int                `json:"min_account_age_days"`
}

// GetPromotion — GET /api/user/promotion/:slug
// 任何登录用户可调；返回活动信息 + 每个 SKU 的销量/用户已购/卡片状态。
func GetPromotion(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "活动不存在"})
		return
	}
	p, err := model.FindCampaignBySlugCached(slug)
	if err != nil || p == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "活动不存在"})
		return
	}
	skus, err := model.ListSkusByCampaignCached(p.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "活动数据异常"})
		return
	}

	userID := c.GetInt("id")
	now := time.Now().Unix()
	active := p.IsCurrentlyActive()

	keys := make([]string, 0, len(skus))
	for _, s := range skus {
		keys = append(keys, s.SkuKey)
	}
	soldMap, _ := model.CountPromotionSkuSoldBatch(keys)
	userMap, _ := model.CountUserPromotionSkuPurchasesBatch(userID, keys)

	skuViews := make([]promotionSkuView, 0, len(skus))
	for _, s := range skus {
		sold := soldMap[s.SkuKey]
		userBought := userMap[s.SkuKey]
		state := skuStatePurchasable
		userCanBuy := 0
		switch {
		case !s.Enabled:
			state = skuStateActivityDisabled
		case !active:
			state = skuStateActivityClosed
		case s.TotalLimit > 0 && sold >= int64(s.TotalLimit):
			state = skuStateSoldOut
		case s.PerUserLimit > 0 && userBought >= int64(s.PerUserLimit):
			state = skuStateUserLimit
		}
		if s.PerUserLimit > 0 {
			remaining := int64(s.PerUserLimit) - userBought
			if remaining < 0 {
				remaining = 0
			}
			userCanBuy = int(remaining)
		}

		skuViews = append(skuViews, promotionSkuView{
			Id:               s.SkuKey,
			Label:            s.Label,
			Subtitle:         s.Subtitle,
			Emoji:            s.Emoji,
			PriceYuan:        decimalToFloat(s.PriceYuan),
			DeliveredYuan:    decimalToFloat(s.DeliveredYuan),
			PriceDisplay:     s.PriceDisplay,
			DeliveredDisplay: s.DeliveredDisplay,
			Highlight:        s.Highlight,
			TotalLimit:       s.TotalLimit,
			PerUserLimit:     s.PerUserLimit,
			SoldCount:        sold,
			UserBoughtN:      userBought,
			State:            state,
			UserCanBuyN:      userCanBuy,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": promotionView{
			Slug:                 p.Slug,
			Title:                p.Title,
			Subtitle:             p.Subtitle,
			Emoji:                p.Emoji,
			ThemeColor:           p.ThemeColor,
			LayoutVariant:        p.LayoutVariant,
			StartsAt:             p.StartsAt,
			EndsAt:               p.EndsAt,
			Now:                  now,
			Active:               active,
			Skus:                 skuViews,
			RequireEmailVerified: p.RequireEmailVerified,
			MinAccountAgeDays:    p.MinAccountAgeDays,
		},
	})
}

// OrderPromotionSku — POST /api/user/promotion/:slug/order  body: { sku_id }
// 创建一笔 KPay 订单，写入 promotion_sku_id，返回 QR 码数据。
func OrderPromotionSku(c *gin.Context) {
	if !isKPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "支付未启用"})
		return
	}

	slug := strings.TrimSpace(c.Param("slug"))
	var req struct {
		SkuId         string `json:"sku_id"`
		PaymentMethod string `json:"payment_method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "参数错误"})
		return
	}
	req.SkuId = strings.TrimSpace(req.SkuId)
	if req.SkuId == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请选择套餐"})
		return
	}

	sku, p, err := model.FindSkuByKey(req.SkuId)
	if err != nil || sku == nil || p == nil || p.Slug != slug {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "套餐不存在"})
		return
	}
	if !p.Enabled || !sku.Enabled {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "该套餐已下架"})
		return
	}
	if !p.IsInWindow() {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "活动未开始或已结束"})
		return
	}

	userID := c.GetInt("id")
	user, err := model.GetUserById(userID, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "用户不存在"})
		return
	}

	// Anti-abuse soft gates
	if p.RequireEmailVerified && strings.TrimSpace(user.Email) == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "需先绑定并验证邮箱才能参与该活动"})
		return
	}
	if p.MinAccountAgeDays > 0 {
		ageDays := (time.Now().Unix() - user.CreatedAt) / 86400
		if ageDays < int64(p.MinAccountAgeDays) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("账号注册需满 %d 天才能参与", p.MinAccountAgeDays)})
			return
		}
	}

	// 限购预检（authoritative 防超卖在 RechargeKPay 二次校验里做兜底）
	if sku.TotalLimit > 0 {
		sold, _ := model.CountPromotionSkuSold(sku.SkuKey)
		if sold >= int64(sku.TotalLimit) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "该套餐已售罄"})
			return
		}
	}
	if sku.PerUserLimit > 0 {
		bought, _ := model.CountUserPromotionSkuPurchases(userID, sku.SkuKey)
		if bought >= int64(sku.PerUserLimit) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "您已达该套餐购买上限"})
			return
		}
	}

	// 防止同 SKU 反复创建 pending 订单灌爆 KPay 平台。
	if pending, _ := model.CountUserPromotionPendingSkuPurchases(userID, sku.SkuKey); pending > 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "您已有一笔该套餐的待支付订单，请先完成或等待过期"})
		return
	}

	payMethod := normalizeKPayMethod(req.PaymentMethod)
	if payMethod == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "支付方式不存在"})
		return
	}

	priceFloat := decimalToFloat(sku.PriceYuan)
	deliveredFloat := decimalToFloat(sku.DeliveredYuan)

	tradeNo := fmt.Sprintf("PROMO%sUSR%dNO%s%d", strings.ToUpper(p.Slug), userID, common.GetRandomString(6), time.Now().Unix())

	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          int64(deliveredFloat + 0.0001),
		Money:           priceFloat,
		TradeNo:         tradeNo,
		PaymentMethod:   payMethod,
		PaymentProvider: model.PaymentProviderKPay,
		PromotionSkuId:  sku.SkuKey,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("promotion 创建订单失败 user_id=%d sku=%s trade_no=%s error=%q", userID, sku.SkuKey, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "创建订单失败"})
		return
	}

	callbackAddress := service.GetCallbackAddress()
	notifyURL := callbackAddress + "/api/kpay/notify"
	returnURL := buildKPayReturnURL(callbackAddress)
	selectedMerchantID := getKPaySelectedMerchantID()

	orderReq := &kpayCreateOrderRequest{
		MerchantOrderNo:    tradeNo,
		Amount:             priceFloat,
		PaymentMode:        kpayDirectMode,
		PayMethod:          payMethod,
		ProductName:        fmt.Sprintf("%s · %s", p.Title, sku.Label),
		ProductDesc:        sku.Subtitle,
		NotifyUrl:          notifyURL,
		ReturnUrl:          returnURL,
		SelectStrategy:     getKPaySelectStrategy(),
		SelectedMerchantId: selectedMerchantID,
	}
	orderData, err := createKPayOrder(c.Request.Context(), orderReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("promotion 调 KPay 失败 user_id=%d sku=%s trade_no=%s error=%q", userID, sku.SkuKey, tradeNo, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "拉起支付失败：" + err.Error()})
		return
	}

	providerOrderNo := strings.TrimSpace(orderData.OrderNo)
	if providerOrderNo != "" {
		topUp.ProviderOrderNo = providerOrderNo
		if err := topUp.Update(); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("promotion 保存 provider_order_no 失败 trade_no=%s error=%q", tradeNo, err.Error()))
		}
		SchedulePostCreateKPayWatch(tradeNo, providerOrderNo)
	}

	qrURL := getKPayQRCodeURL(orderData)
	qrDataURI := fetchKPayQRCodeDataURI(c.Request.Context(), qrURL)
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("promotion 订单创建成功 user_id=%d slug=%s sku=%s trade_no=%s provider_order_no=%s money=%.2f", userID, p.Slug, sku.SkuKey, tradeNo, providerOrderNo, priceFloat))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"trade_no":          tradeNo,
			"provider_order_no": orderData.OrderNo,
			"sku_id":            sku.SkuKey,
			"amount":            priceFloat,
			"price_display":     sku.PriceDisplay,
			"delivered_yuan":    deliveredFloat,
			"delivered_display": sku.DeliveredDisplay,
			"payment_method":    payMethod,
			"status":            orderData.Status,
			"expire_time":       orderData.ExpireTime,
			"qr_code_image_url": qrURL,
			"qr_code_data_uri":  qrDataURI,
			"direct_pay_url":    resolveKPayURL(orderData.DirectPayUrl),
			"warning":           orderData.Warning,
		},
	})
}

// ListActivePromotions — GET /api/user/promotions/active
// 当前 enabled + 时间窗口内的活动 minimal payload；banner / 仪表盘卡片用。
func ListActivePromotions(c *gin.Context) {
	type item struct {
		Slug              string `json:"slug"`
		Title             string `json:"title"`
		Subtitle          string `json:"subtitle"`
		Emoji             string `json:"emoji"`
		ThemeColor        string `json:"theme_color"`
		EndsAt            int64  `json:"ends_at"`
		ShowTopupBanner   bool   `json:"show_topup_banner"`
		ShowDashboardCard bool   `json:"show_dashboard_card"`
	}
	out := make([]item, 0)
	active, err := model.ListActiveCampaigns()
	if err == nil {
		for _, p := range active {
			out = append(out, item{
				Slug:              p.Slug,
				Title:             p.Title,
				Subtitle:          p.Subtitle,
				Emoji:             p.Emoji,
				ThemeColor:        p.ThemeColor,
				EndsAt:            p.EndsAt,
				ShowTopupBanner:   p.ShowTopupBanner,
				ShowDashboardCard: p.ShowDashboardCard,
			})
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// decimalToFloat — DB 里是 decimal.Decimal，对外 JSON 仍用 float（前端已经按
// float 处理；admin 内部值更高精度的运算继续用 decimal）。
func decimalToFloat(d decimal.Decimal) float64 {
	f, _ := d.Float64()
	return f
}

// 静默 unused-import lint：i18n 没在此文件直接用，但其它 controller 文件需要。
var _ = i18n.MsgInvalidParams
