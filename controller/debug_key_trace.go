package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const debugConnectivityModelName = "debug-connectivity"
const debugConnectivityCompletionMessage = "连通性检测已完成，请联系管理员并提供 Request ID。"

var (
	debugConnectivityStreamProbeDurationOverride    time.Duration
	debugConnectivityStreamProbeIntervalOverride    time.Duration
	debugConnectivityNonStreamProbeDurationOverride time.Duration
)

type debugConnectivityResponse struct {
	Object          string                       `json:"object"`
	OK              bool                         `json:"ok"`
	Message         string                       `json:"message"`
	RequestId       string                       `json:"request_id"`
	ServerTimestamp int64                        `json:"server_timestamp"`
	ServerTime      string                       `json:"server_time"`
	ProcessingMs    int64                        `json:"processing_ms"`
	Request         debugConnectivityRequestInfo `json:"request"`
	Token           debugConnectivityTokenInfo   `json:"token"`
	TraceHint       string                       `json:"trace_hint"`
}

type debugConnectivityRequestInfo struct {
	Method        string `json:"method"`
	Path          string `json:"path"`
	Host          string `json:"host"`
	Scheme        string `json:"scheme"`
	Protocol      string `json:"protocol"`
	ClientIP      string `json:"client_ip"`
	RemoteAddr    string `json:"remote_addr"`
	UserAgent     string `json:"user_agent"`
	ContentType   string `json:"content_type"`
	ContentLength int64  `json:"content_length"`
}

type debugConnectivityTokenInfo struct {
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	TokenId      int    `json:"token_id"`
	TokenName    string `json:"token_name"`
	Group        string `json:"group"`
	DebugEnabled bool   `json:"debug_enabled"`
}

type debugConnectivityRequestOptions struct {
	Model  string
	Stream bool
}

type debugConnectivityChatCompletion struct {
	Id                string                     `json:"id"`
	Object            string                     `json:"object"`
	Created           int64                      `json:"created"`
	Model             string                     `json:"model"`
	Choices           []debugConnectivityChoice  `json:"choices"`
	Usage             debugConnectivityUsage     `json:"usage"`
	DebugConnectivity *debugConnectivityResponse `json:"debug_connectivity,omitempty"`
}

type debugConnectivityChoice struct {
	Index        int                      `json:"index"`
	Message      debugConnectivityMessage `json:"message"`
	FinishReason string                   `json:"finish_reason"`
}

type debugConnectivityMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type debugConnectivityUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type debugConnectivitySettingResponse struct {
	StreamProbeSeconds            int `json:"stream_probe_seconds"`
	StreamProbeIntervalSeconds    int `json:"stream_probe_interval_seconds"`
	NonStreamProbeSeconds         int `json:"non_stream_probe_seconds"`
	MaxProbeSeconds               int `json:"max_probe_seconds"`
	MaxStreamProbeIntervalSeconds int `json:"max_stream_probe_interval_seconds"`
}

func DebugKeyConnectivityProbe() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.GetContextKeyBool(c, constant.ContextKeyTokenDebugConnectivity) {
			c.Next()
			return
		}
		respondDebugKeyConnectivity(c, true)
		c.Abort()
	}
}

func DebugKeyConnectivity(c *gin.Context) {
	respondDebugKeyConnectivity(c, false)
}

func respondDebugKeyConnectivity(c *gin.Context, completionMode bool) {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenDebugEnabled) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"message": "该接口仅允许管理员调试 Key 使用",
				"type":    "new_api_error",
				"code":    "debug_key_required",
			},
		})
		return
	}

	startedAt := time.Now()
	requestOptions := detectDebugConnectivityRequestOptions(c)
	requestedModel := requestOptions.Model
	group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	}
	c.Set("original_model", debugConnectivityModelName)
	c.Set("group", group)
	common.SetContextKey(c, constant.ContextKeyIsStream, completionMode && requestOptions.Stream)

	finishDebugTrace := service.StartDebugKeyTrace(c, nil)
	var finalErr *types.NewAPIError
	if finishDebugTrace != nil {
		defer func() {
			finishDebugTrace(finalErr)
		}()
	}

	requestInfo := buildDebugConnectivityRequestInfo(c)
	tokenInfo := debugConnectivityTokenInfo{
		UserId:       c.GetInt("id"),
		Username:     common.GetContextKeyString(c, constant.ContextKeyUserName),
		TokenId:      c.GetInt("token_id"),
		TokenName:    c.GetString("token_name"),
		Group:        group,
		DebugEnabled: true,
	}
	now := time.Now()
	response := debugConnectivityResponse{
		Object:          "debug.connectivity",
		OK:              true,
		Message:         debugConnectivityMessageText(completionMode),
		RequestId:       c.GetString(common.RequestIdKey),
		ServerTimestamp: now.Unix(),
		ServerTime:      now.Format(time.RFC3339),
		ProcessingMs:    time.Since(startedAt).Milliseconds(),
		Request:         requestInfo,
		Token:           tokenInfo,
		TraceHint:       "在 /admin/debug-traces 使用 request_id 精确查询本次探测记录",
	}

	probeMode := "direct_endpoint"
	if completionMode {
		probeMode = "transparent_key"
	}
	service.AppendDebugKeyTraceAdminInfo(c, map[string]interface{}{
		"diagnostic":      "client_connectivity",
		"client_ip":       requestInfo.ClientIP,
		"host":            requestInfo.Host,
		"scheme":          requestInfo.Scheme,
		"user_agent":      requestInfo.UserAgent,
		"content_length":  requestInfo.ContentLength,
		"processing_ms":   response.ProcessingMs,
		"debug_endpoint":  requestInfo.Path,
		"debug_key_probe": true,
		"probe_mode":      probeMode,
		"requested_model": requestedModel,
		"stream":          completionMode && requestOptions.Stream,
	})
	if completionMode {
		if requestOptions.Stream {
			finalErr = writeDebugConnectivityChatCompletionStream(c, response, requestedModel)
			return
		}
		if finalErr = waitDebugConnectivityNonStreamProbe(c, startedAt, &response); finalErr != nil {
			return
		}
		c.JSON(http.StatusOK, buildDebugConnectivityChatCompletion(response, requestedModel))
		return
	}
	c.JSON(http.StatusOK, response)
}

func debugConnectivityMessageText(completionMode bool) string {
	if completionMode {
		return debugConnectivityCompletionMessage
	}
	return "client_to_server_ok"
}

func buildDebugConnectivityChatCompletion(response debugConnectivityResponse, requestedModel string) debugConnectivityChatCompletion {
	modelName := common.GetStringIfEmpty(requestedModel, debugConnectivityModelName)
	message := fmt.Sprintf("%s Request ID: %s", debugConnectivityCompletionMessage, response.RequestId)
	return debugConnectivityChatCompletion{
		Id:      "debug-connectivity-" + common.GetStringIfEmpty(response.RequestId, fmt.Sprintf("%d", response.ServerTimestamp)),
		Object:  "chat.completion",
		Created: response.ServerTimestamp,
		Model:   modelName,
		Choices: []debugConnectivityChoice{
			{
				Index: 0,
				Message: debugConnectivityMessage{
					Role:    "assistant",
					Content: message,
				},
				FinishReason: "stop",
			},
		},
		Usage: debugConnectivityUsage{
			PromptTokens:     0,
			CompletionTokens: 0,
			TotalTokens:      0,
		},
		DebugConnectivity: &response,
	}
}

func writeDebugConnectivityChatCompletionStream(c *gin.Context, response debugConnectivityResponse, requestedModel string) *types.NewAPIError {
	modelName := common.GetStringIfEmpty(requestedModel, debugConnectivityModelName)
	id := "debug-connectivity-" + common.GetStringIfEmpty(response.RequestId, fmt.Sprintf("%d", response.ServerTimestamp))
	probeDuration, probeInterval, probeSeconds, intervalSeconds := debugConnectivityStreamProbeConfig()
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	service.AppendDebugKeyTraceAdminInfo(c, map[string]interface{}{
		"stream_probe_duration_seconds": probeSeconds,
		"stream_probe_interval_seconds": intervalSeconds,
	})

	writeSSEData := func(value any) error {
		data, err := common.Marshal(value)
		if err != nil {
			return err
		}
		if _, err = c.Writer.Write([]byte("data: ")); err != nil {
			return err
		}
		if _, err = c.Writer.Write(data); err != nil {
			return err
		}
		if _, err = c.Writer.Write([]byte("\n\n")); err != nil {
			return err
		}
		if flusher, ok := c.Writer.(http.Flusher); ok {
			flusher.Flush()
		}
		return nil
	}

	writeContentChunk := func(content string, includeRole bool) error {
		delta := gin.H{"content": content}
		if includeRole {
			delta["role"] = "assistant"
		}
		return writeSSEData(gin.H{
			"id":      id,
			"object":  "chat.completion.chunk",
			"created": response.ServerTimestamp,
			"model":   modelName,
			"choices": []gin.H{{
				"index":         0,
				"delta":         delta,
				"finish_reason": nil,
			}},
		})
	}

	startedAt := time.Now()
	if err := writeContentChunk(fmt.Sprintf("连通性长流测试已开始，将持续约 %d 秒。Request ID: %s", probeSeconds, response.RequestId), true); err != nil {
		return debugConnectivityProbeError(c, err)
	}

	ticker := time.NewTicker(probeInterval)
	defer ticker.Stop()
	deadline := time.NewTimer(probeDuration)
	defer deadline.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return debugConnectivityProbeError(c, c.Request.Context().Err())
		case <-deadline.C:
			elapsed := time.Since(startedAt)
			response.ProcessingMs = elapsed.Milliseconds()
			service.AppendDebugKeyTraceAdminInfo(c, map[string]interface{}{
				"stream_probe_completed":          true,
				"stream_probe_actual_duration_ms": response.ProcessingMs,
			})
			if err := writeContentChunk(fmt.Sprintf("%s Request ID: %s", debugConnectivityCompletionMessage, response.RequestId), false); err != nil {
				return debugConnectivityProbeError(c, err)
			}
			if err := writeSSEData(buildDebugConnectivityStreamStopChunk(response, id, modelName)); err != nil {
				return debugConnectivityProbeError(c, err)
			}
			if _, err := c.Writer.Write([]byte("data: [DONE]\n\n")); err != nil {
				return debugConnectivityProbeError(c, err)
			}
			if flusher, ok := c.Writer.(http.Flusher); ok {
				flusher.Flush()
			}
			return nil
		case <-ticker.C:
			elapsedSeconds := int(time.Since(startedAt).Seconds())
			if elapsedSeconds < 1 {
				elapsedSeconds = 1
			}
			if elapsedSeconds > probeSeconds {
				elapsedSeconds = probeSeconds
			}
			if err := writeContentChunk(fmt.Sprintf("连通性检测进行中：已保持约 %d/%d 秒。", elapsedSeconds, probeSeconds), false); err != nil {
				return debugConnectivityProbeError(c, err)
			}
		}
	}
}

func waitDebugConnectivityNonStreamProbe(c *gin.Context, startedAt time.Time, response *debugConnectivityResponse) *types.NewAPIError {
	probeDuration, probeSeconds := debugConnectivityNonStreamProbeConfig()
	if probeDuration <= 0 {
		if response != nil {
			response.ProcessingMs = time.Since(startedAt).Milliseconds()
		}
		return nil
	}
	service.AppendDebugKeyTraceAdminInfo(c, map[string]interface{}{
		"non_stream_probe_seconds": probeSeconds,
	})
	timer := time.NewTimer(probeDuration)
	defer timer.Stop()
	select {
	case <-c.Request.Context().Done():
		return debugConnectivityProbeError(c, c.Request.Context().Err())
	case <-timer.C:
		actualMs := time.Since(startedAt).Milliseconds()
		if response != nil {
			response.ProcessingMs = actualMs
		}
		service.AppendDebugKeyTraceAdminInfo(c, map[string]interface{}{
			"non_stream_probe_completed":          true,
			"non_stream_probe_actual_duration_ms": actualMs,
		})
		return nil
	}
}

func debugConnectivityStreamProbeConfig() (time.Duration, time.Duration, int, int) {
	probeDuration := debugConnectivityStreamProbeDurationOverride
	if probeDuration <= 0 {
		setting := operation_setting.GetDebugConnectivitySetting()
		probeDuration = time.Duration(setting.StreamProbeSeconds) * time.Second
	}

	probeInterval := debugConnectivityStreamProbeIntervalOverride
	if probeInterval <= 0 {
		setting := operation_setting.GetDebugConnectivitySetting()
		probeInterval = time.Duration(setting.StreamProbeIntervalSeconds) * time.Second
	}
	if probeInterval > probeDuration {
		probeInterval = probeDuration
	}
	return probeDuration, probeInterval, ceilDurationSeconds(probeDuration), ceilDurationSeconds(probeInterval)
}

func debugConnectivityNonStreamProbeConfig() (time.Duration, int) {
	probeDuration := debugConnectivityNonStreamProbeDurationOverride
	if probeDuration <= 0 {
		setting := operation_setting.GetDebugConnectivitySetting()
		probeDuration = time.Duration(setting.NonStreamProbeSeconds) * time.Second
	}
	return probeDuration, ceilDurationSeconds(probeDuration)
}

func ceilDurationSeconds(duration time.Duration) int {
	if duration <= 0 {
		return 1
	}
	seconds := int(duration / time.Second)
	if duration%time.Second != 0 {
		seconds++
	}
	if seconds <= 0 {
		return 1
	}
	return seconds
}

func debugConnectivityProbeError(c *gin.Context, err error) *types.NewAPIError {
	if err == nil {
		return nil
	}
	statusCode := http.StatusInternalServerError
	if c != nil && c.Request != nil && service.IsClientCanceledError(c.Request.Context(), err) {
		statusCode = service.StatusClientClosedRequest
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		statusCode = service.StatusClientClosedRequest
	}
	return types.NewOpenAIError(err, types.ErrorCodeBadResponse, statusCode)
}

func buildDebugConnectivityStreamStopChunk(response debugConnectivityResponse, id string, modelName string) gin.H {
	return gin.H{
		"id":      id,
		"object":  "chat.completion.chunk",
		"created": response.ServerTimestamp,
		"model":   modelName,
		"choices": []gin.H{{
			"index":         0,
			"delta":         gin.H{},
			"finish_reason": "stop",
		}},
		"debug_connectivity": response,
	}
}

func buildDebugConnectivityRequestInfo(c *gin.Context) debugConnectivityRequestInfo {
	info := debugConnectivityRequestInfo{}
	if c == nil {
		return info
	}
	info.ClientIP = c.ClientIP()
	info.Scheme = debugConnectivityRequestScheme(c)
	if c.Request == nil {
		return info
	}
	req := c.Request
	info.Method = req.Method
	if req.URL != nil {
		info.Path = req.URL.Path
	}
	info.Host = req.Host
	info.Protocol = req.Proto
	info.RemoteAddr = req.RemoteAddr
	info.UserAgent = req.UserAgent()
	info.ContentType = req.Header.Get("Content-Type")
	if req.ContentLength > 0 {
		info.ContentLength = req.ContentLength
	}
	return info
}

func debugConnectivityRequestScheme(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	if proto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); proto != "" {
		if comma := strings.Index(proto, ","); comma >= 0 {
			proto = proto[:comma]
		}
		return strings.TrimSpace(proto)
	}
	if c.Request.TLS != nil {
		return "https"
	}
	return "http"
}

func detectDebugConnectivityRequestOptions(c *gin.Context) debugConnectivityRequestOptions {
	options := debugConnectivityRequestOptions{}
	if c == nil || c.Request == nil {
		return options
	}
	if modelName := strings.TrimSpace(c.Query("model")); modelName != "" {
		options.Model = modelName
	}
	if stream := strings.TrimSpace(c.Query("stream")); strings.EqualFold(stream, "true") || stream == "1" {
		options.Stream = true
	}
	if options.Model == "" && c.Param("model") != "" {
		options.Model = strings.TrimSpace(c.Param("model"))
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil || storage == nil {
		return options
	}
	defer func() {
		_, _ = storage.Seek(0, io.SeekStart)
		c.Request.Body = io.NopCloser(storage)
	}()
	data, err := storage.Bytes()
	if err != nil || len(data) == 0 {
		return options
	}
	var payload map[string]interface{}
	if err = common.Unmarshal(data, &payload); err != nil {
		return options
	}
	if options.Model == "" {
		if modelName, ok := payload["model"].(string); ok {
			options.Model = strings.TrimSpace(modelName)
		}
	}
	if stream, ok := payload["stream"].(bool); ok {
		options.Stream = stream
	} else if stream, ok := payload["stream"].(string); ok {
		options.Stream = strings.EqualFold(strings.TrimSpace(stream), "true") || strings.TrimSpace(stream) == "1"
	}
	return options
}

func AdminGetDebugConnectivitySetting(c *gin.Context) {
	common.ApiSuccess(c, buildDebugConnectivitySettingResponse(operation_setting.GetDebugConnectivitySetting()))
}

func AdminSaveDebugConnectivitySetting(c *gin.Context) {
	var request operation_setting.DebugConnectivitySetting
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	setting := operation_setting.NormalizeDebugConnectivitySetting(request)
	updates := map[string]int{
		"debug_connectivity_setting.stream_probe_seconds":          setting.StreamProbeSeconds,
		"debug_connectivity_setting.stream_probe_interval_seconds": setting.StreamProbeIntervalSeconds,
		"debug_connectivity_setting.non_stream_probe_seconds":      setting.NonStreamProbeSeconds,
	}
	for key, value := range updates {
		if err := model.UpdateOption(key, strconv.Itoa(value)); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, buildDebugConnectivitySettingResponse(operation_setting.GetDebugConnectivitySetting()))
}

func buildDebugConnectivitySettingResponse(setting operation_setting.DebugConnectivitySetting) debugConnectivitySettingResponse {
	setting = operation_setting.NormalizeDebugConnectivitySetting(setting)
	return debugConnectivitySettingResponse{
		StreamProbeSeconds:            setting.StreamProbeSeconds,
		StreamProbeIntervalSeconds:    setting.StreamProbeIntervalSeconds,
		NonStreamProbeSeconds:         setting.NonStreamProbeSeconds,
		MaxProbeSeconds:               operation_setting.MaxDebugConnectivityProbeSeconds,
		MaxStreamProbeIntervalSeconds: operation_setting.MaxDebugConnectivityStreamProbeIntervalSeconds,
	}
}

func AdminListDebugKeyTraces(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	query := model.DebugKeyTraceQuery{
		Status:    strings.TrimSpace(c.Query("status")),
		RequestId: strings.TrimSpace(c.Query("request_id")),
		Keyword:   strings.TrimSpace(c.Query("keyword")),
	}
	if tokenId, err := strconv.Atoi(c.Query("token_id")); err == nil {
		query.TokenId = tokenId
	}
	if userId, err := strconv.Atoi(c.Query("user_id")); err == nil {
		query.UserId = userId
	}
	if start, err := strconv.ParseInt(c.Query("start_timestamp"), 10, 64); err == nil {
		query.StartTime = start
	}
	if end, err := strconv.ParseInt(c.Query("end_timestamp"), 10, 64); err == nil {
		query.EndTime = end
	}
	traces, total, err := model.GetAdminDebugKeyTraces(pageInfo, query)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(traces)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetDebugKeyTrace(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	trace, err := model.GetDebugKeyTraceById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, trace)
}

func AdminDeleteDebugKeyTrace(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteDebugKeyTraceById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminDownloadDebugKeyTrace(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	trace, err := model.GetDebugKeyTraceById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	filename := fmt.Sprintf("debug-trace-%d.log", trace.Id)
	if trace.RequestId != "" {
		filename = fmt.Sprintf("debug-trace-%s.log", sanitizeDownloadFilename(trace.RequestId))
	}
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(formatDebugKeyTraceLog(trace)))
}

func formatDebugKeyTraceLog(trace *model.DebugKeyTrace) string {
	if trace == nil {
		return ""
	}
	var b strings.Builder
	b.WriteString("Youkies API Debug Trace\n")
	b.WriteString("=======================\n\n")
	writeTraceLine(&b, "ID", fmt.Sprintf("%d", trace.Id))
	writeTraceLine(&b, "Request ID", trace.RequestId)
	writeTraceLine(&b, "Created At", formatTraceTime(trace.CreatedAt))
	writeTraceLine(&b, "Status", trace.Status)
	writeTraceLine(&b, "HTTP Status", fmt.Sprintf("%d", trace.HttpStatus))
	writeTraceLine(&b, "Upstream Status", fmt.Sprintf("%d", trace.UpstreamStatus))
	writeTraceLine(&b, "User", fmt.Sprintf("%s (#%d)", trace.Username, trace.UserId))
	writeTraceLine(&b, "Token", fmt.Sprintf("%s (#%d)", trace.TokenName, trace.TokenId))
	writeTraceLine(&b, "Model", trace.ModelName)
	writeTraceLine(&b, "Group", trace.Group)
	writeTraceLine(&b, "Request", strings.TrimSpace(trace.RequestMethod+" "+trace.RequestPath))
	writeTraceLine(&b, "Relay Format", trace.RelayFormat+" -> "+trace.FinalRelayFormat)
	writeTraceLine(&b, "Relay Mode", fmt.Sprintf("%d", trace.RelayMode))
	writeTraceLine(&b, "Stream", fmt.Sprintf("%t", trace.IsStream))
	writeTraceLine(&b, "Channel", fmt.Sprintf("%s (#%d, type=%d)", trace.ChannelName, trace.ChannelId, trace.ChannelType))
	writeTraceLine(&b, "Use Channel", string(trace.UseChannel))
	writeTraceLine(&b, "Use Time", fmt.Sprintf("%d ms", trace.UseTime))
	b.WriteString("\n")

	writeTraceSection(&b, "Original Request Headers", string(trace.RequestHeaders))
	writeTraceSection(&b, "Original Request Body", string(trace.RequestBody))
	if trace.RequestBodyTruncated {
		b.WriteString("[original request body truncated]\n\n")
	}
	writeTraceSection(&b, "Upstream URL", string(trace.UpstreamUrl))
	writeTraceSection(&b, "Upstream Headers", string(trace.UpstreamHeaders))
	writeTraceSection(&b, "Upstream Body", string(trace.UpstreamBody))
	if trace.UpstreamBodyTruncated {
		b.WriteString("[upstream body truncated]\n\n")
	}
	writeTraceSection(&b, "Response Headers", string(trace.ResponseHeaders))
	writeTraceSection(&b, "Response Body", string(trace.ResponseBody))
	if trace.ResponseBodyTruncated {
		b.WriteString("[response body truncated]\n\n")
	}
	writeTraceSection(&b, "Error Type", trace.ErrorType)
	writeTraceSection(&b, "Error Code", trace.ErrorCode)
	writeTraceSection(&b, "Error Message", string(trace.ErrorMessage))
	writeTraceSection(&b, "Admin Info", string(trace.AdminInfo))
	return b.String()
}

func writeTraceLine(b *strings.Builder, label string, value string) {
	if strings.TrimSpace(value) == "" {
		value = "-"
	}
	b.WriteString(label)
	b.WriteString(": ")
	b.WriteString(value)
	b.WriteString("\n")
}

func writeTraceSection(b *strings.Builder, title string, value string) {
	b.WriteString("## ")
	b.WriteString(title)
	b.WriteString("\n")
	if strings.TrimSpace(value) == "" {
		b.WriteString("无\n\n")
		return
	}
	b.WriteString(value)
	b.WriteString("\n\n")
}

func formatTraceTime(ts int64) string {
	if ts <= 0 {
		return "-"
	}
	return time.Unix(ts, 0).Format(time.RFC3339)
}

func sanitizeDownloadFilename(name string) string {
	replacer := strings.NewReplacer("\\", "_", "/", "_", ":", "_", "*", "_", "?", "_", `"`, "_", "<", "_", ">", "_", "|", "_")
	name = strings.TrimSpace(replacer.Replace(name))
	if name == "" {
		return "unknown"
	}
	if len(name) > 120 {
		return name[:120]
	}
	return name
}
