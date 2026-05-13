package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	kpayDefaultApiBase     = "https://api.kpay.cc"
	kpayDirectMode         = "direct_qr"
	kpayStatusPaid         = "paid"
	kpayStatusSuccess      = "success"
	kpayStatusSucceeded    = "succeeded"
	kpayStatusTradeSuccess = "trade_success"
	kpayNotifyOK           = "ok"
	kpayNotifyFail         = "fail"
	kpayWebhookMaxSkew     = 10 * time.Minute
	kpayHTTPTimeout        = 15 * time.Second
	kpayQRCodeFetchTimeout = 8 * time.Second
	kpayQRCodeMaxBytes     = 1024 * 1024
	kpayFallbackExpire     = 15 * time.Minute
)

type KPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

type KPayCheckRequest struct {
	TradeNo         string `json:"trade_no"`
	ProviderOrderNo string `json:"provider_order_no"`
}

type kpayCreateOrderRequest struct {
	MerchantOrderNo    string  `json:"merchantOrderNo"`
	Amount             float64 `json:"amount"`
	PaymentMode        string  `json:"paymentMode"`
	PayMethod          string  `json:"payMethod,omitempty"`
	ProductName        string  `json:"productName,omitempty"`
	ProductDesc        string  `json:"productDesc,omitempty"`
	NotifyUrl          string  `json:"notifyUrl,omitempty"`
	ReturnUrl          string  `json:"returnUrl,omitempty"`
	SelectStrategy     string  `json:"selectStrategy,omitempty"`
	SelectedMerchantId *int    `json:"selectedMerchantId,omitempty"`
}

type kpayAPIResponse struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

type kpayAPIError struct {
	Code int
	Msg  string
	Body string
}

func (e *kpayAPIError) Error() string {
	msg := strings.TrimSpace(e.Msg)
	if msg == "" {
		msg = "KPay API returned non-zero code"
	}
	return fmt.Sprintf("KPay code=%d msg=%s", e.Code, msg)
}

type kpayOrderData struct {
	OrderNo              string            `json:"orderNo"`
	MerchantOrderNo      string            `json:"merchantOrderNo"`
	Amount               float64           `json:"amount"`
	ActualAmount         float64           `json:"actualAmount"`
	OwnerShouldGet       float64           `json:"ownerShouldGet"`
	Status               string            `json:"status"`
	PayMethod            string            `json:"payMethod"`
	PaymentMode          string            `json:"paymentMode"`
	PaymentModeOptions   []string          `json:"paymentModeOptions"`
	AvailablePayMethods  []string          `json:"availablePayMethods"`
	CheckoutReady        bool              `json:"checkoutReady"`
	CheckoutSessionId    string            `json:"checkoutSessionId"`
	CheckoutUrl          string            `json:"checkoutUrl"`
	QRCodeImageUrl       string            `json:"qrCodeImageUrl"`
	DirectQRCodeImageUrl string            `json:"directQrCodeImageUrl"`
	DirectQrReady        bool              `json:"directQrReady"`
	DirectPayUrl         string            `json:"directPayUrl"`
	DirectPayReady       bool              `json:"directPayReady"`
	DirectPayMethod      string            `json:"directPayMethod"`
	ExpireTime           string            `json:"expireTime"`
	NotifyUrl            string            `json:"notifyUrl"`
	NotifyUrls           []string          `json:"notifyUrls"`
	ReturnUrl            string            `json:"returnUrl"`
	Warning              string            `json:"warning"`
	Channels             []kpayChannelData `json:"channels"`
}

type kpayChannelData struct {
	OrderNo        string  `json:"orderNo"`
	PayMethod      string  `json:"payMethod"`
	Provider       string  `json:"provider"`
	Status         string  `json:"status"`
	ProviderStatus string  `json:"providerStatus"`
	PayTime        string  `json:"payTime"`
	ReceivedAmount float64 `json:"receivedAmount"`
}

type kpayWebhookPayload struct {
	OrderNo            string   `json:"orderNo"`
	MerchantOrderNo    string   `json:"merchantOrderNo"`
	Amount             float64  `json:"amount"`
	ActualAmount       float64  `json:"actualAmount"`
	OwnerShouldGet     float64  `json:"ownerShouldGet"`
	Status             string   `json:"status"`
	PayMethod          string   `json:"payMethod"`
	PayTime            string   `json:"payTime"`
	NotifyUrl          string   `json:"notifyUrl"`
	NotifyUrls         []string `json:"notifyUrls"`
	ReturnUrl          string   `json:"returnUrl"`
	SelectedMerchantId int      `json:"selectedMerchantId"`
}

var kpayHTTPClient = &http.Client{Timeout: kpayHTTPTimeout}

func getKPayBaseURL() string {
	base := strings.TrimSpace(setting.KPayApiBase)
	if base == "" {
		base = kpayDefaultApiBase
	}
	return strings.TrimRight(base, "/")
}

func normalizeKPayMethod(method string) string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "alipay", "kpay_alipay":
		return "alipay"
	case "wechat", "wxpay", "weixin", "kpay_wechat", "kpay_wxpay":
		return "wechat"
	default:
		return ""
	}
}

func normalizeKPayStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	status = strings.ReplaceAll(status, "-", "_")
	status = strings.ReplaceAll(status, " ", "_")
	return status
}

func isKPayPaidStatus(status string) bool {
	switch normalizeKPayStatus(status) {
	case kpayStatusPaid, kpayStatusSuccess, kpayStatusSucceeded, kpayStatusTradeSuccess:
		return true
	default:
		return false
	}
}

func isKPayFailedStatus(status string) bool {
	switch normalizeKPayStatus(status) {
	case "failed", "fail", "failure", "error", "pay_failed", "payment_failed", "pay_cancel", "cancel", "canceled", "cancelled", "closed", "order_closed":
		return true
	default:
		return false
	}
}

func isKPayExpiredStatus(status string) bool {
	switch normalizeKPayStatus(status) {
	case "expired", "expire", "timeout", "timed_out", "order_expired":
		return true
	default:
		return false
	}
}

func parseKPayTime(value string) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}, false
	}
	if ts, err := strconv.ParseInt(value, 10, 64); err == nil {
		if ts > 1_000_000_000_000 {
			return time.UnixMilli(ts), true
		}
		if ts > 0 {
			return time.Unix(ts, 0), true
		}
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006/01/02 15:04:05",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func mapKPayOrderStatus(order kpayOrderData) string {
	if isKPayPaidStatus(order.Status) {
		return common.TopUpStatusSuccess
	}
	if isKPayExpiredStatus(order.Status) {
		return common.TopUpStatusExpired
	}
	if isKPayFailedStatus(order.Status) {
		return common.TopUpStatusFailed
	}
	for _, channel := range order.Channels {
		if isKPayPaidStatus(channel.Status) || isKPayPaidStatus(channel.ProviderStatus) {
			return common.TopUpStatusSuccess
		}
	}
	if len(order.Channels) > 0 {
		allExpired := true
		allFailed := true
		for _, channel := range order.Channels {
			expired := isKPayExpiredStatus(channel.Status) || isKPayExpiredStatus(channel.ProviderStatus)
			failed := isKPayFailedStatus(channel.Status) || isKPayFailedStatus(channel.ProviderStatus)
			allExpired = allExpired && expired
			allFailed = allFailed && failed
		}
		if allExpired {
			return common.TopUpStatusExpired
		}
		if allFailed {
			return common.TopUpStatusFailed
		}
	}
	if expireTime, ok := parseKPayTime(order.ExpireTime); ok && !expireTime.After(time.Now()) {
		return common.TopUpStatusExpired
	}
	return common.TopUpStatusPending
}

func isKPayLocalFallbackExpired(topUp *model.TopUp) bool {
	if topUp == nil || topUp.Status != common.TopUpStatusPending {
		return false
	}
	if strings.TrimSpace(topUp.ProviderOrderNo) != "" {
		return false
	}
	if topUp.CreateTime <= 0 {
		return false
	}
	return time.Since(time.Unix(topUp.CreateTime, 0)) >= kpayFallbackExpire
}

func kpayPayMethods() []map[string]string {
	return []map[string]string{
		{
			"name": "支付宝",
			"type": "kpay_alipay",
		},
		{
			"name": "微信支付",
			"type": "kpay_wechat",
		},
	}
}

func doKPayAPI(ctx context.Context, method string, path string, body any, out any) error {
	var bodyReader io.Reader
	if body != nil {
		raw, err := common.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(raw)
	}

	target := getKPayBaseURL() + path
	req, err := http.NewRequestWithContext(ctx, method, target, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", setting.KPayApiKey)
	req.Header.Set("X-API-Secret", setting.KPayApiSecret)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := kpayHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("KPay HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var apiResp kpayAPIResponse
	if err := common.Unmarshal(respBody, &apiResp); err != nil {
		return err
	}
	if apiResp.Code != 0 {
		return &kpayAPIError{
			Code: apiResp.Code,
			Msg:  apiResp.Msg,
			Body: string(respBody),
		}
	}
	if out != nil && len(apiResp.Data) > 0 {
		if err := common.Unmarshal(apiResp.Data, out); err != nil {
			return err
		}
	}
	return nil
}

func createKPayOrder(ctx context.Context, req *kpayCreateOrderRequest) (*kpayOrderData, error) {
	var data kpayOrderData
	err := doKPayAPI(ctx, http.MethodPost, "/pay/api/order/create", req, &data)
	if err != nil {
		return nil, err
	}
	return &data, nil
}

func queryKPayOrder(ctx context.Context, orderNo string) (*kpayOrderData, error) {
	orderNo = strings.TrimSpace(orderNo)
	if orderNo == "" {
		return nil, errors.New("KPay orderNo is empty")
	}
	path := "/pay/api/order/query?orderNo=" + url.QueryEscape(orderNo)
	var data kpayOrderData
	err := doKPayAPI(ctx, http.MethodGet, path, nil, &data)
	if err != nil {
		return nil, err
	}
	return &data, nil
}

func getKPaySelectedMerchantID() *int {
	if setting.KPaySelectedMerchantId <= 0 {
		return nil
	}
	id := setting.KPaySelectedMerchantId
	return &id
}

func formatKPaySelectedMerchantID(id *int) int {
	if id == nil {
		return 0
	}
	return *id
}

func getKPaySelectStrategy() string {
	strategy := strings.TrimSpace(setting.KPaySelectStrategy)
	if strategy == "" {
		return "lowest_fee"
	}
	return strategy
}

func getKPayPaidAmount(data *kpayOrderData) float64 {
	if data == nil {
		return 0
	}
	if data.ActualAmount > 0 {
		return data.ActualAmount
	}
	return data.Amount
}

func resolveKPayURL(rawURL string) string {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return ""
	}
	if strings.HasPrefix(rawURL, "//") {
		return "https:" + rawURL
	}
	parsed, err := url.Parse(rawURL)
	if err == nil && parsed.IsAbs() {
		return rawURL
	}
	base, err := url.Parse(getKPayBaseURL())
	if err != nil {
		return rawURL
	}
	ref, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	return base.ResolveReference(ref).String()
}

func getKPayQRCodeURL(data *kpayOrderData) string {
	if data == nil {
		return ""
	}
	if strings.TrimSpace(data.DirectQRCodeImageUrl) != "" {
		return resolveKPayURL(data.DirectQRCodeImageUrl)
	}
	return resolveKPayURL(data.QRCodeImageUrl)
}

func isTrustedKPayQRCodeHost(hostname string) bool {
	host := strings.ToLower(strings.TrimSpace(hostname))
	return host == "kpay.cc" ||
		host == "api.kpay.cc" ||
		host == "app.kpay.cc" ||
		strings.HasSuffix(host, ".kpay.cc")
}

func fetchKPayQRCodeDataURI(ctx context.Context, qrURL string) string {
	qrURL = strings.TrimSpace(qrURL)
	if qrURL == "" {
		return ""
	}
	parsed, err := url.Parse(qrURL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return ""
	}
	if !isTrustedKPayQRCodeHost(parsed.Hostname()) {
		return ""
	}

	fetchCtx, cancel := context.WithTimeout(ctx, kpayQRCodeFetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(fetchCtx, http.MethodGet, qrURL, nil)
	if err != nil {
		return ""
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ""
	}
	contentType := resp.Header.Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || !strings.HasPrefix(mediaType, "image/") {
		return ""
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, kpayQRCodeMaxBytes+1))
	if err != nil || len(raw) == 0 || len(raw) > kpayQRCodeMaxBytes {
		return ""
	}
	return "data:" + mediaType + ";base64," + base64.StdEncoding.EncodeToString(raw)
}

func buildKPayReturnURL(callbackAddress string) string {
	base := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	if base == "" {
		base = strings.TrimRight(strings.TrimSpace(callbackAddress), "/")
	}
	if base == "" {
		return "/topup?show_history=true"
	}
	return base + "/topup?show_history=true"
}

func RequestKPay(c *gin.Context) {
	if !isKPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "KPay 支付未启用"})
		return
	}

	var req KPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	payMethod := normalizeKPayMethod(req.PaymentMethod)
	if payMethod == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	tradeNo := fmt.Sprintf("KPAYUSR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   payMethod,
		PaymentProvider: model.PaymentProviderKPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("KPay 创建充值订单失败 user_id=%d trade_no=%s payment_method=%s amount=%d error=%q", id, tradeNo, payMethod, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	callbackAddress := service.GetCallbackAddress()
	notifyURL := callbackAddress + "/api/kpay/notify"
	returnURL := buildKPayReturnURL(callbackAddress)
	selectedMerchantID := getKPaySelectedMerchantID()

	orderReq := &kpayCreateOrderRequest{
		MerchantOrderNo:    tradeNo,
		Amount:             payMoney,
		PaymentMode:        kpayDirectMode,
		PayMethod:          payMethod,
		ProductName:        "额度充值",
		ProductDesc:        "账户额度充值",
		NotifyUrl:          notifyURL,
		ReturnUrl:          returnURL,
		SelectStrategy:     getKPaySelectStrategy(),
		SelectedMerchantId: selectedMerchantID,
	}
	orderData, err := createKPayOrder(c.Request.Context(), orderReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("KPay 创建平台订单失败 user_id=%d trade_no=%s payment_method=%s amount=%d money=%.2f notify_url=%q return_url=%q select_strategy=%q selected_merchant_id=%d error=%q", id, tradeNo, payMethod, req.Amount, payMoney, notifyURL, returnURL, getKPaySelectStrategy(), formatKPaySelectedMerchantID(selectedMerchantID), err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败：" + err.Error()})
		return
	}

	providerOrderNo := strings.TrimSpace(orderData.OrderNo)
	if providerOrderNo != "" {
		topUp.ProviderOrderNo = providerOrderNo
		if err := topUp.Update(); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay 保存平台订单号失败 user_id=%d trade_no=%s provider_order_no=%s error=%q", id, tradeNo, providerOrderNo, err.Error()))
		}
	}

	qrURL := getKPayQRCodeURL(orderData)
	qrDataURI := fetchKPayQRCodeDataURI(c.Request.Context(), qrURL)
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("KPay 充值订单创建成功 user_id=%d trade_no=%s provider_order_no=%s payment_method=%s amount=%d money=%.2f qr_ready=%v direct_pay_ready=%v", id, tradeNo, orderData.OrderNo, payMethod, req.Amount, payMoney, orderData.DirectQrReady, orderData.DirectPayReady))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"trade_no":          tradeNo,
			"provider_order_no": orderData.OrderNo,
			"amount":            payMoney,
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

func CheckKPayTopUp(c *gin.Context) {
	if !isKPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "KPay 支付未启用"})
		return
	}

	var req KPayCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	req.TradeNo = strings.TrimSpace(req.TradeNo)
	if req.TradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单号不能为空"})
		return
	}

	topUp := model.GetTopUpByTradeNo(req.TradeNo)
	if topUp == nil || topUp.UserId != c.GetInt("id") || topUp.PaymentProvider != model.PaymentProviderKPay {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusSuccess}})
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": topUp.Status}})
		return
	}

	providerOrderNo := strings.TrimSpace(req.ProviderOrderNo)
	if providerOrderNo == "" {
		providerOrderNo = strings.TrimSpace(topUp.ProviderOrderNo)
	}
	if providerOrderNo == "" {
		if isKPayLocalFallbackExpired(topUp) {
			if err := model.UpdatePendingTopUpStatus(req.TradeNo, model.PaymentProviderKPay, common.TopUpStatusExpired); err != nil && err != model.ErrTopUpStatusInvalid {
				logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay 无平台订单号过期兜底失败 trade_no=%s user_id=%d create_time=%d error=%q", req.TradeNo, c.GetInt("id"), topUp.CreateTime, err.Error()))
				c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending, "reason": "missing_provider_order_no"}})
				return
			}
			logger.LogInfo(c.Request.Context(), fmt.Sprintf("KPay 无平台订单号过期兜底 trade_no=%s user_id=%d create_time=%d", req.TradeNo, c.GetInt("id"), topUp.CreateTime))
			c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusExpired, "reason": "missing_provider_order_no"}})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending}})
		return
	}
	orderData, err := queryKPayOrder(c.Request.Context(), providerOrderNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay 查单失败 trade_no=%s provider_order_no=%s user_id=%d error=%q", req.TradeNo, providerOrderNo, c.GetInt("id"), err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending}})
		return
	}
	if orderData.MerchantOrderNo != req.TradeNo {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay 查单订单号不匹配 trade_no=%s provider_order_no=%s response_merchant_order_no=%s user_id=%d", req.TradeNo, providerOrderNo, orderData.MerchantOrderNo, c.GetInt("id")))
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending}})
		return
	}
	nextStatus := mapKPayOrderStatus(*orderData)
	if nextStatus == common.TopUpStatusSuccess {
		if err := model.RechargeKPay(orderData.MerchantOrderNo, normalizeKPayMethod(orderData.PayMethod), c.ClientIP(), getKPayPaidAmount(orderData)); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("KPay 查单补偿入账失败 trade_no=%s provider_order_no=%s error=%q", req.TradeNo, providerOrderNo, err.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单入账失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusSuccess}})
		return
	}
	if nextStatus == common.TopUpStatusFailed || nextStatus == common.TopUpStatusExpired {
		if err := model.UpdatePendingTopUpStatus(req.TradeNo, model.PaymentProviderKPay, nextStatus); err != nil && err != model.ErrTopUpStatusInvalid {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay 查单更新终态失败 trade_no=%s provider_order_no=%s provider_status=%s target_status=%s error=%q", req.TradeNo, providerOrderNo, orderData.Status, nextStatus, err.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending, "provider_status": orderData.Status}})
			return
		}
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("KPay 查单确认订单终态 trade_no=%s provider_order_no=%s provider_status=%s local_status=%s", req.TradeNo, providerOrderNo, orderData.Status, nextStatus))
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": nextStatus, "provider_status": orderData.Status}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{"status": common.TopUpStatusPending, "provider_status": orderData.Status}})
}

func KPayNotify(c *gin.Context) {
	if !isKPayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, kpayNotifyFail)
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2*1024*1024))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("KPay webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, kpayNotifyFail)
		return
	}
	if err := verifyKPaySignature(c.Request.Header, body); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay webhook 验签失败 path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), string(body)))
		c.String(http.StatusOK, kpayNotifyFail)
		return
	}

	var payload kpayWebhookPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("KPay webhook 解析失败 path=%q client_ip=%s error=%q body=%q", c.Request.RequestURI, c.ClientIP(), err.Error(), string(body)))
		c.String(http.StatusOK, kpayNotifyFail)
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("KPay webhook 验签成功 trade_no=%s provider_order_no=%s status=%s pay_method=%s amount=%.2f actual_amount=%.2f client_ip=%s", payload.MerchantOrderNo, payload.OrderNo, payload.Status, payload.PayMethod, payload.Amount, payload.ActualAmount, c.ClientIP()))

	payloadStatus := mapKPayOrderStatus(kpayOrderData{Status: payload.Status})
	if payloadStatus == common.TopUpStatusFailed || payloadStatus == common.TopUpStatusExpired {
		if err := model.UpdatePendingTopUpStatus(payload.MerchantOrderNo, model.PaymentProviderKPay, payloadStatus); err != nil && err != model.ErrTopUpStatusInvalid && err != model.ErrTopUpNotFound {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay webhook 更新终态失败 trade_no=%s provider_order_no=%s provider_status=%s target_status=%s error=%q", payload.MerchantOrderNo, payload.OrderNo, payload.Status, payloadStatus, err.Error()))
			c.String(http.StatusOK, kpayNotifyFail)
			return
		}
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("KPay webhook 确认订单终态 trade_no=%s provider_order_no=%s provider_status=%s local_status=%s", payload.MerchantOrderNo, payload.OrderNo, payload.Status, payloadStatus))
		c.String(http.StatusOK, kpayNotifyOK)
		return
	}
	if payloadStatus != common.TopUpStatusSuccess {
		c.String(http.StatusOK, kpayNotifyOK)
		return
	}

	paidAmount := payload.ActualAmount
	if paidAmount <= 0 {
		paidAmount = payload.Amount
	}
	if err := model.RechargeKPay(payload.MerchantOrderNo, normalizeKPayMethod(payload.PayMethod), c.ClientIP(), paidAmount); err != nil {
		if errors.Is(err, model.ErrTopUpNotFound) {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("KPay webhook 订单不存在 trade_no=%s provider_order_no=%s client_ip=%s", payload.MerchantOrderNo, payload.OrderNo, c.ClientIP()))
		} else {
			logger.LogError(c.Request.Context(), fmt.Sprintf("KPay webhook 入账失败 trade_no=%s provider_order_no=%s client_ip=%s error=%q", payload.MerchantOrderNo, payload.OrderNo, c.ClientIP(), err.Error()))
		}
		c.String(http.StatusOK, kpayNotifyFail)
		return
	}
	c.String(http.StatusOK, kpayNotifyOK)
}

func verifyKPaySignature(headers http.Header, body []byte) error {
	signature := strings.TrimSpace(headers.Get("X-KPay-Signature"))
	if signature == "" {
		return errors.New("missing X-KPay-Signature")
	}
	signatureMethod := strings.TrimSpace(headers.Get("X-KPay-Signature-Method"))
	if signatureMethod != "" && !strings.EqualFold(signatureMethod, "HMAC-SHA256") {
		return errors.New("unsupported signature method")
	}
	timestamp := strings.TrimSpace(headers.Get("X-KPay-Timestamp"))
	if timestamp == "" {
		return errors.New("missing X-KPay-Timestamp")
	}
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return errors.New("invalid X-KPay-Timestamp")
	}
	now := time.Now()
	eventTime := time.Unix(ts, 0)
	if eventTime.After(now.Add(kpayWebhookMaxSkew)) || eventTime.Before(now.Add(-kpayWebhookMaxSkew)) {
		return errors.New("X-KPay-Timestamp outside allowed window")
	}

	sum := sha256.Sum256(body)
	bodyHash := hex.EncodeToString(sum[:])
	headerBodyHash := strings.ToLower(strings.TrimSpace(headers.Get("X-KPay-Body-SHA256")))
	if headerBodyHash == "" {
		return errors.New("missing X-KPay-Body-SHA256")
	}
	if !hmac.Equal([]byte(headerBodyHash), []byte(bodyHash)) {
		return errors.New("body hash mismatch")
	}

	event := strings.TrimSpace(headers.Get("X-KPay-Event"))
	nonce := strings.TrimSpace(headers.Get("X-KPay-Nonce"))
	candidates := []string{
		strings.Join([]string{event, timestamp, nonce, bodyHash}, "\n"),
		strings.Join([]string{timestamp, nonce, bodyHash}, "\n"),
		timestamp + "." + nonce + "." + bodyHash,
		timestamp + "." + string(body),
		string(body),
	}
	for _, candidate := range candidates {
		if verifyKPayHMAC(candidate, signature) {
			return nil
		}
	}
	return errors.New("signature mismatch")
}

func verifyKPayHMAC(payload string, signature string) bool {
	mac := hmac.New(sha256.New, []byte(setting.KPayApiSecret))
	_, _ = mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(signature)), []byte(expected))
}
