package controller

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestDebugKeyConnectivityRecordsTrace(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.DebugKeyTrace{}); err != nil {
		t.Fatalf("failed to migrate debug trace table: %v", err)
	}

	body := map[string]any{
		"probe":   "client-connectivity",
		"sent_at": "2026-05-17T12:00:00Z",
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/v1/debug/connectivity", body, 1)
	ctx.Request.Header.Set("User-Agent", "connectivity-test-client/1.0")
	ctx.Request.Host = "api.example.test"
	ctx.Request.RemoteAddr = "203.0.113.10:56789"
	ctx.Set(common.RequestIdKey, "debug-connectivity-test")
	ctx.Set("token_id", 101)
	ctx.Set("token_name", "debug-probe-token")
	ctx.Set("username", "admin")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenDebugEnabled, true)

	DebugKeyConnectivity(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response debugConnectivityResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode connectivity response: %v", err)
	}
	if !response.OK || response.Message != "client_to_server_ok" {
		t.Fatalf("unexpected connectivity response: %+v", response)
	}
	if response.RequestId != "debug-connectivity-test" {
		t.Fatalf("expected request id to round trip, got %q", response.RequestId)
	}
	if response.Token.TokenId != 101 || !response.Token.DebugEnabled {
		t.Fatalf("unexpected token info: %+v", response.Token)
	}

	trace := waitForDebugTrace(t, "debug-connectivity-test")
	if trace.ModelName != debugConnectivityModelName {
		t.Fatalf("expected model name %q, got %q", debugConnectivityModelName, trace.ModelName)
	}
	if trace.RequestPath != "/v1/debug/connectivity" {
		t.Fatalf("expected request path to be recorded, got %q", trace.RequestPath)
	}
	if trace.UpstreamStatus != 0 || trace.UpstreamUrl != "" {
		t.Fatalf("connectivity probe should not call upstream, got status=%d url=%q", trace.UpstreamStatus, trace.UpstreamUrl)
	}
	if !strings.Contains(string(trace.RequestBody), "client-connectivity") {
		t.Fatalf("expected request body to be captured, got %q", trace.RequestBody)
	}
	if !strings.Contains(string(trace.ResponseBody), "client_to_server_ok") {
		t.Fatalf("expected response body to be captured, got %q", trace.ResponseBody)
	}
	if !strings.Contains(string(trace.AdminInfo), "client_connectivity") {
		t.Fatalf("expected diagnostic admin info, got %q", trace.AdminInfo)
	}
}

func TestDebugKeyConnectivityRequiresDebugKey(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.DebugKeyTrace{}); err != nil {
		t.Fatalf("failed to migrate debug trace table: %v", err)
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/v1/debug/connectivity", nil, 1)
	ctx.Set(common.RequestIdKey, "debug-connectivity-denied")
	ctx.Set("token_id", 102)
	ctx.Set("token_name", "normal-token")

	DebugKeyConnectivity(ctx)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403 response, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var count int64
	if err := db.Model(&model.DebugKeyTrace{}).Where("request_id = ?", "debug-connectivity-denied").Count(&count).Error; err != nil {
		t.Fatalf("failed to count debug traces: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no trace for non-debug token, got %d", count)
	}
}

func TestDebugKeyConnectivityProbeShortCircuitsRelayRequest(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.DebugKeyTrace{}); err != nil {
		t.Fatalf("failed to migrate debug trace table: %v", err)
	}

	body := map[string]any{
		"model":    "any-model-user-filled",
		"messages": []map[string]string{{"role": "user", "content": "ping"}},
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/v1/chat/completions", body, 1)
	ctx.Set(common.RequestIdKey, "debug-connectivity-transparent")
	ctx.Set("token_id", 201)
	ctx.Set("token_name", "transparent-connectivity-token")
	ctx.Set("username", "admin")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenDebugEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenDebugConnectivity, true)

	DebugKeyConnectivityProbe()(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var response debugConnectivityChatCompletion
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode chat completion response: %v", err)
	}
	if response.Object != "chat.completion" {
		t.Fatalf("expected chat completion object, got %q", response.Object)
	}
	if response.Model != "any-model-user-filled" {
		t.Fatalf("expected requested model in response, got %q", response.Model)
	}
	if len(response.Choices) != 1 || !strings.Contains(response.Choices[0].Message.Content, "连通性检测已完成") {
		t.Fatalf("expected connectivity completion message, got %+v", response.Choices)
	}
	if !ctx.IsAborted() {
		t.Fatalf("expected connectivity probe middleware to abort relay chain")
	}

	trace := waitForDebugTrace(t, "debug-connectivity-transparent")
	if trace.ModelName != debugConnectivityModelName {
		t.Fatalf("expected trace model name %q, got %q", debugConnectivityModelName, trace.ModelName)
	}
	if trace.UpstreamStatus != 0 || trace.ChannelId != 0 {
		t.Fatalf("connectivity probe should not select upstream channel, got upstream=%d channel=%d", trace.UpstreamStatus, trace.ChannelId)
	}
	if !strings.Contains(string(trace.AdminInfo), "transparent_key") || !strings.Contains(string(trace.AdminInfo), "any-model-user-filled") {
		t.Fatalf("expected transparent probe admin info, got %q", trace.AdminInfo)
	}
}

func TestDebugKeyConnectivityProbeSupportsStreamingRequest(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.DebugKeyTrace{}); err != nil {
		t.Fatalf("failed to migrate debug trace table: %v", err)
	}

	body := map[string]any{
		"model":    "stream-any-model",
		"stream":   true,
		"messages": []map[string]string{{"role": "user", "content": "ping"}},
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/v1/chat/completions", body, 1)
	ctx.Set(common.RequestIdKey, "debug-connectivity-stream")
	ctx.Set("token_id", 202)
	ctx.Set("token_name", "stream-connectivity-token")
	common.SetContextKey(ctx, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenDebugEnabled, true)
	common.SetContextKey(ctx, constant.ContextKeyTokenDebugConnectivity, true)

	DebugKeyConnectivityProbe()(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 response, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "text/event-stream") {
		t.Fatalf("expected SSE content type, got %q", contentType)
	}
	bodyText := recorder.Body.String()
	if !strings.Contains(bodyText, "连通性检测已完成") || !strings.Contains(bodyText, "data: [DONE]") {
		t.Fatalf("expected streaming connectivity response, got %q", bodyText)
	}

	trace := waitForDebugTrace(t, "debug-connectivity-stream")
	if !trace.IsStream {
		t.Fatalf("expected streaming probe trace")
	}
	if !strings.Contains(string(trace.AdminInfo), `"stream":true`) {
		t.Fatalf("expected stream admin info, got %q", trace.AdminInfo)
	}
}

func waitForDebugTrace(t *testing.T, requestID string) model.DebugKeyTrace {
	t.Helper()

	deadline := time.Now().Add(2 * time.Second)
	var trace model.DebugKeyTrace
	for time.Now().Before(deadline) {
		err := model.LOG_DB.First(&trace, "request_id = ?", requestID).Error
		if err == nil {
			return trace
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("debug trace %q was not recorded", requestID)
	return trace
}
