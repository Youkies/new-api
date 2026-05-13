package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func signKPayTestPayload(secret string, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyKPaySignature(t *testing.T) {
	originalSecret := setting.KPayApiSecret
	t.Cleanup(func() {
		setting.KPayApiSecret = originalSecret
	})
	setting.KPayApiSecret = "test-secret"

	body := []byte(`{"orderNo":"C2C1","merchantOrderNo":"KPAY1","amount":7.3,"actualAmount":7.3,"status":"paid"}`)
	sum := sha256.Sum256(body)
	bodyHash := hex.EncodeToString(sum[:])
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce := "nonce-1"
	event := "payment.order.paid"
	payload := strings.Join([]string{event, timestamp, nonce, bodyHash}, "\n")

	headers := http.Header{}
	headers.Set("X-KPay-Event", event)
	headers.Set("X-KPay-Timestamp", timestamp)
	headers.Set("X-KPay-Nonce", nonce)
	headers.Set("X-KPay-Body-SHA256", bodyHash)
	headers.Set("X-KPay-Signature-Method", "HMAC-SHA256")
	headers.Set("X-KPay-Signature", signKPayTestPayload(setting.KPayApiSecret, payload))

	require.NoError(t, verifyKPaySignature(headers, body))

	headers.Set("X-KPay-Body-SHA256", strings.Repeat("0", 64))
	require.Error(t, verifyKPaySignature(headers, body))
}

func TestResolveKPayURL(t *testing.T) {
	originalBase := setting.KPayApiBase
	t.Cleanup(func() {
		setting.KPayApiBase = originalBase
	})
	setting.KPayApiBase = "https://api.kpay.cc"

	require.Equal(t, "https://api.kpay.cc/qrcode/1.png", resolveKPayURL("/qrcode/1.png"))
	require.Equal(t, "https://cdn.kpay.cc/qrcode/1.png", resolveKPayURL("//cdn.kpay.cc/qrcode/1.png"))
	require.Equal(t, "alipays://platformapi/startapp", resolveKPayURL("alipays://platformapi/startapp"))
}

func TestBuildKPayReturnURLUsesUIWebTopUp(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
	})

	system_setting.ServerAddress = "https://newapi-test.youkies.space/"
	require.Equal(t, "https://newapi-test.youkies.space/topup?show_history=true", buildKPayReturnURL("https://callback.example"))

	system_setting.ServerAddress = ""
	require.Equal(t, "https://callback.example/topup?show_history=true", buildKPayReturnURL("https://callback.example/"))
}

func TestKPayNotifyAlwaysReturnsOKForRejectedWebhook(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalEnabled := setting.KPayEnabled
	originalApiBase := setting.KPayApiBase
	originalApiKey := setting.KPayApiKey
	originalApiSecret := setting.KPayApiSecret
	t.Cleanup(func() {
		setting.KPayEnabled = originalEnabled
		setting.KPayApiBase = originalApiBase
		setting.KPayApiKey = originalApiKey
		setting.KPayApiSecret = originalApiSecret
	})

	router := gin.New()
	router.POST("/api/kpay/notify", KPayNotify)

	setting.KPayEnabled = false
	req := httptest.NewRequest(http.MethodPost, "/api/kpay/notify", bytes.NewBufferString(`{"orderNo":"test","status":"paid"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, kpayNotifyFail, rec.Body.String())

	setting.KPayEnabled = true
	setting.KPayApiBase = "https://api.kpay.cc"
	setting.KPayApiKey = "test-key"
	setting.KPayApiSecret = "test-secret"
	req = httptest.NewRequest(http.MethodPost, "/api/kpay/notify", bytes.NewBufferString(`{"orderNo":"test","status":"paid"}`))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, kpayNotifyFail, rec.Body.String())
}
