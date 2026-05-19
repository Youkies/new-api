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
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// 活动 SKU 卡片在前端的展示态。
const (
	skuStatePurchasable     = "purchasable"      // 可购买
	skuStateSoldOut         = "sold_out"         // 全部售罄
	skuStateUserLimit       = "user_limit"       // 该用户已达个人上限
	skuStateUserHasPending  = "user_has_pending" // 该用户在该 SKU 上有未支付订单
	skuStateActivityClosed  = "activity_closed"  // 活动未开始或已结束
	skuStateActivityDisabled = "disabled"        // 活动 SKU 被禁用
)

type promotionSkuView struct {
	Id            string  `json:"id"`
	Label         string  `json:"label"`
	Subtitle      string  `json:"subtitle"`
	Emoji         string  `json:"emoji"`
	PriceYuan     float64 `json:"price_yuan"`
	DeliveredYuan float64 `json:"delivered_yuan"`
	Highlight     bool    `json:"highlight"`
	TotalLimit    int     `json:"total_limit"`
	PerUserLimit  int     `json:"per_user_limit"`
	SoldCount     int64   `json:"sold_count"`
	UserBoughtN   int64   `json:"user_bought_n"`
	State         string  `json:"state"`
	UserCanBuyN   int     `json:"user_can_buy_n"` // 该用户在此 SKU 还能买多少次（per_user_limit - 已买；0 = 不限）
}

type promotionView struct {
	Slug                 string             `json:"slug"`
	Title                string             `json:"title"`
	Subtitle             string             `json:"subtitle"`
	Emoji                string             `json:"emoji"`
	ThemeColor           string             `json:"theme_color"`
	StartsAt             int64              `json:"starts_at"`
	EndsAt               int64              `json:"ends_at"`
	Now                  int64              `json:"now"`
	Active               bool               `json:"active"`
	Skus                 []promotionSkuView `json:"skus"`
	RequireEmailVerified bool               `json:"require_email_verified"`
	MinAccountAgeDays    int                `json:"min_account_age_days"`
}

// GetPromotion — GET /api/promotion/:slug
// 任何登录用户可调；返回活动信息 + 每个 SKU 的销量/用户已购/卡片状态。
func GetPromotion(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	p := setting.GetPromotionByAnyStatus(slug)
	if p == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "活动不存在"})
		return
	}

	userID := c.GetInt("id")
	now := time.Now().Unix()
	active := p.IsActive()

	skuIDs := make([]string, 0, len(p.Skus))
	for _, s := range p.Skus {
		skuIDs = append(skuIDs, s.ID)
	}
	soldMap, _ := model.CountPromotionSkuSoldBatch(skuIDs)
	userMap, _ := model.CountUserPromotionSkuPurchasesBatch(userID, skuIDs)

	skuViews := make([]promotionSkuView, 0, len(p.Skus))
	for _, s := range p.Skus {
		sold := soldMap[s.ID]
		userBought := userMap[s.ID]
		state := skuStatePurchasable
		userCanBuy := 0
		switch {
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
			Id:            s.ID,
			Label:         s.Label,
			Subtitle:      s.Subtitle,
			Emoji:         s.Emoji,
			PriceYuan:     s.PriceYuan,
			DeliveredYuan: s.DeliveredYuan,
			Highlight:     s.Highlight,
			TotalLimit:    s.TotalLimit,
			PerUserLimit:  s.PerUserLimit,
			SoldCount:     sold,
			UserBoughtN:   userBought,
			State:         state,
			UserCanBuyN:   userCanBuy,
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

// OrderPromotionSku — POST /api/promotion/:slug/order  body: { sku_id }
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

	p, sku := setting.GetPromotionSku(req.SkuId)
	if p == nil || sku == nil || p.Slug != slug {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "套餐不存在"})
		return
	}
	if !p.IsActive() {
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
		sold, _ := model.CountPromotionSkuSold(sku.ID)
		if sold >= int64(sku.TotalLimit) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "该套餐已售罄"})
			return
		}
	}
	if sku.PerUserLimit > 0 {
		bought, _ := model.CountUserPromotionSkuPurchases(userID, sku.ID)
		if bought >= int64(sku.PerUserLimit) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "您已达该套餐购买上限"})
			return
		}
	}

	// 防止同 SKU 反复创建 pending 订单灌爆 KPay 平台。一个用户同 SKU 最多 1 个 pending。
	if pending, _ := model.CountUserPromotionPendingSkuPurchases(userID, sku.ID); pending > 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "您已有一笔该套餐的待支付订单，请先完成或等待过期"})
		return
	}

	payMethod := normalizeKPayMethod(req.PaymentMethod)
	if payMethod == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "支付方式不存在"})
		return
	}

	tradeNo := fmt.Sprintf("PROMO%sUSR%dNO%s%d", strings.ToUpper(p.Slug), userID, common.GetRandomString(6), time.Now().Unix())

	// 入账金额由 SKU.DeliveredYuan 决定，TopUp.Amount 保留为"按 SKU 表面金额"（用于日志展示）。
	// RechargeKPay 会按 promotion_sku_id 重新查 SKU 拿真正的 DeliveredYuan，绕开 Amount × QuotaPerUnit。
	topUp := &model.TopUp{
		UserId:          userID,
		Amount:          int64(sku.DeliveredYuan + 0.0001), // 表面值，向下取整；真正入账靠 SKU 配置
		Money:           sku.PriceYuan,
		TradeNo:         tradeNo,
		PaymentMethod:   payMethod,
		PaymentProvider: model.PaymentProviderKPay,
		PromotionSkuId:  sku.ID,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("promotion 创建订单失败 user_id=%d sku=%s trade_no=%s error=%q", userID, sku.ID, tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "创建订单失败"})
		return
	}

	callbackAddress := service.GetCallbackAddress()
	notifyURL := callbackAddress + "/api/kpay/notify"
	returnURL := buildKPayReturnURL(callbackAddress)
	selectedMerchantID := getKPaySelectedMerchantID()

	orderReq := &kpayCreateOrderRequest{
		MerchantOrderNo:    tradeNo,
		Amount:             sku.PriceYuan,
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
		logger.LogError(c.Request.Context(), fmt.Sprintf("promotion 调 KPay 失败 user_id=%d sku=%s trade_no=%s error=%q", userID, sku.ID, tradeNo, err.Error()))
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
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("promotion 订单创建成功 user_id=%d slug=%s sku=%s trade_no=%s provider_order_no=%s money=%.2f", userID, p.Slug, sku.ID, tradeNo, providerOrderNo, sku.PriceYuan))

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"trade_no":          tradeNo,
			"provider_order_no": orderData.OrderNo,
			"sku_id":            sku.ID,
			"amount":            sku.PriceYuan,
			"delivered_yuan":    sku.DeliveredYuan,
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

// unused — silence unused-import lint when i18n is not used elsewhere here
var _ = i18n.MsgInvalidParams

// ListActivePromotions — GET /api/promotions/active
// 任何登录用户可调；返回当前 enabled + 时间窗口内的活动列表（minimal payload）。
// 用于 /topup 等页面的入口横幅。
func ListActivePromotions(c *gin.Context) {
	type item struct {
		Slug       string `json:"slug"`
		Title      string `json:"title"`
		Subtitle   string `json:"subtitle"`
		Emoji      string `json:"emoji"`
		ThemeColor string `json:"theme_color"`
		EndsAt     int64  `json:"ends_at"`
	}
	out := make([]item, 0)
	for _, p := range setting.ListActivePromotions() {
		out = append(out, item{
			Slug:       p.Slug,
			Title:      p.Title,
			Subtitle:   p.Subtitle,
			Emoji:      p.Emoji,
			ThemeColor: p.ThemeColor,
			EndsAt:     p.EndsAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}
