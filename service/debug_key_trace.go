package service

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const (
	debugTraceContextKey = "debug_key_trace_state"
	debugTraceBodyLimit  = 256 * 1024
)

var debugBodySecretPattern = regexp.MustCompile(`(?i)("(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret|cookie)"\s*:\s*)"[^"]*"`)

type debugTraceState struct {
	mu              sync.Mutex
	trace           *model.DebugKeyTrace
	responseCapture *debugBodyCapture
	upstreamCapture *debugBodyCapture
	startedAt       time.Time
}

type debugBodyCapture struct {
	mu        sync.Mutex
	buf       bytes.Buffer
	limit     int
	total     int64
	truncated bool
}

func newDebugBodyCapture(limit int) *debugBodyCapture {
	return &debugBodyCapture{limit: limit}
}

func (c *debugBodyCapture) Write(data []byte) (int, error) {
	if c == nil {
		return len(data), nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.total += int64(len(data))
	remaining := c.limit - c.buf.Len()
	if remaining <= 0 {
		if len(data) > 0 {
			c.truncated = true
		}
		return len(data), nil
	}
	if len(data) > remaining {
		c.buf.Write(data[:remaining])
		c.truncated = true
		return len(data), nil
	}
	c.buf.Write(data)
	return len(data), nil
}

func (c *debugBodyCapture) snapshot() ([]byte, bool, int64) {
	if c == nil {
		return nil, false, 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	data := append([]byte(nil), c.buf.Bytes()...)
	return data, c.truncated, c.total
}

type debugTraceResponseWriter struct {
	gin.ResponseWriter
	capture *debugBodyCapture
}

func (w *debugTraceResponseWriter) Write(data []byte) (int, error) {
	if w.capture != nil {
		_, _ = w.capture.Write(data)
	}
	return w.ResponseWriter.Write(data)
}

func (w *debugTraceResponseWriter) WriteString(data string) (int, error) {
	if w.capture != nil {
		_, _ = w.capture.Write([]byte(data))
	}
	return w.ResponseWriter.WriteString(data)
}

type debugCaptureReadCloser struct {
	io.ReadCloser
	capture *debugBodyCapture
}

func (r *debugCaptureReadCloser) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if n > 0 && r.capture != nil {
		_, _ = r.capture.Write(p[:n])
	}
	return n, err
}

func StartDebugKeyTrace(c *gin.Context, info *relaycommon.RelayInfo) func(*types.NewAPIError) {
	if c == nil || !common.GetContextKeyBool(c, constant.ContextKeyTokenDebugEnabled) {
		return nil
	}

	trace := &model.DebugKeyTrace{
		CreatedAt:     common.GetTimestamp(),
		RequestId:     c.GetString(common.RequestIdKey),
		UserId:        c.GetInt("id"),
		Username:      c.GetString("username"),
		TokenId:       c.GetInt("token_id"),
		TokenName:     c.GetString("token_name"),
		RequestMethod: "",
		RequestPath:   "",
		Status:        model.DebugKeyTraceStatusSuccess,
	}
	if c.Request != nil {
		trace.RequestMethod = c.Request.Method
		if c.Request.URL != nil {
			trace.RequestPath = c.Request.URL.Path
		}
		trace.RequestHeaders = model.DebugTraceText(debugTraceJSON(sanitizeDebugHeaders(c.Request.Header)))
		if storage, err := common.GetBodyStorage(c); err == nil {
			if data, truncated, readErr := readDebugBodyStorage(storage); readErr == nil {
				trace.RequestBody = model.DebugTraceText(sanitizeDebugBody(data, c.Request.Header.Get("Content-Type")))
				trace.RequestBodyTruncated = truncated
			} else {
				trace.RequestBody = model.DebugTraceText(fmt.Sprintf("[failed to read request body: %s]", readErr.Error()))
			}
			_, _ = storage.Seek(0, io.SeekStart)
			c.Request.Body = io.NopCloser(storage)
		}
	}

	capture := newDebugBodyCapture(debugTraceBodyLimit)
	state := &debugTraceState{
		trace:           trace,
		responseCapture: capture,
		startedAt:       time.Now(),
	}
	c.Set(debugTraceContextKey, state)
	c.Writer = &debugTraceResponseWriter{ResponseWriter: c.Writer, capture: capture}
	UpdateDebugKeyTraceRelayInfo(c, info)

	return func(finalErr *types.NewAPIError) {
		FinishDebugKeyTrace(c, finalErr)
	}
}

func UpdateDebugKeyTraceRelayInfo(c *gin.Context, info *relaycommon.RelayInfo) {
	state := getDebugTraceState(c)
	if state == nil || info == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	trace := state.trace
	trace.UserId = info.UserId
	trace.TokenId = info.TokenId
	trace.TokenName = c.GetString("token_name")
	trace.ModelName = info.OriginModelName
	trace.Group = info.TokenGroup
	trace.RelayFormat = string(info.RelayFormat)
	trace.FinalRelayFormat = string(info.GetFinalRequestRelayFormat())
	trace.RelayMode = info.RelayMode
	trace.IsStream = info.IsStream
}

func WrapDebugTraceUpstreamRequest(c *gin.Context, req *http.Request) {
	state := getDebugTraceState(c)
	if state == nil || req == nil {
		return
	}
	capture := newDebugBodyCapture(debugTraceBodyLimit)
	state.mu.Lock()
	state.upstreamCapture = capture
	state.trace.UpstreamUrl = model.DebugTraceText(sanitizeDebugURL(req.URL))
	state.trace.UpstreamHeaders = model.DebugTraceText(debugTraceJSON(sanitizeDebugHeaders(req.Header)))
	state.mu.Unlock()
	if req.Body != nil {
		req.Body = &debugCaptureReadCloser{ReadCloser: req.Body, capture: capture}
	}
}

func RecordDebugTraceUpstreamResponse(c *gin.Context, resp *http.Response) {
	state := getDebugTraceState(c)
	if state == nil || resp == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	state.trace.UpstreamStatus = resp.StatusCode
}

func FinishDebugKeyTrace(c *gin.Context, finalErr *types.NewAPIError) {
	state := getDebugTraceState(c)
	if state == nil || state.trace == nil {
		return
	}

	state.mu.Lock()
	trace := *state.trace
	upstreamCapture := state.upstreamCapture
	responseCapture := state.responseCapture
	startedAt := state.startedAt
	state.mu.Unlock()

	trace.ChannelId = c.GetInt("channel_id")
	trace.ChannelName = c.GetString("channel_name")
	trace.ChannelType = c.GetInt("channel_type")
	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 0 {
		trace.UseChannel = model.DebugTraceText(strings.Join(useChannel, "->"))
	}
	if trace.Username == "" {
		trace.Username = c.GetString("username")
	}
	if trace.TokenName == "" {
		trace.TokenName = c.GetString("token_name")
	}
	if trace.HttpStatus == 0 && c.Writer != nil {
		trace.HttpStatus = c.Writer.Status()
		trace.ResponseHeaders = model.DebugTraceText(debugTraceJSON(sanitizeDebugHeaders(c.Writer.Header())))
	}
	if trace.HttpStatus == 0 {
		trace.HttpStatus = http.StatusOK
	}
	if !startedAt.IsZero() {
		trace.UseTime = int(time.Since(startedAt).Milliseconds())
	}
	if finalErr != nil {
		if IsClientCanceledError(c.Request.Context(), finalErr) {
			trace.Status = model.DebugKeyTraceStatusClientCanceled
		} else {
			trace.Status = model.DebugKeyTraceStatusError
		}
		trace.ErrorType = string(finalErr.GetErrorType())
		trace.ErrorCode = string(finalErr.GetErrorCode())
		trace.ErrorMessage = model.DebugTraceText(finalErr.MaskSensitiveErrorWithStatusCode())
		if finalErr.StatusCode > 0 {
			trace.HttpStatus = finalErr.StatusCode
		}
	}
	if trace.RequestId == "" {
		trace.RequestId = c.GetString(common.RequestIdKey)
	}
	if trace.ModelName == "" {
		trace.ModelName = c.GetString("original_model")
	}
	if trace.Group == "" {
		trace.Group = c.GetString("group")
	}
	adminInfo := map[string]interface{}{
		"use_channel": useChannel,
	}
	if common.GetContextKeyBool(c, constant.ContextKeyChannelIsMultiKey) {
		adminInfo["is_multi_key"] = true
		adminInfo["multi_key_index"] = common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
	}
	AppendChannelAffinityAdminInfo(c, adminInfo)
	trace.AdminInfo = model.DebugTraceText(debugTraceJSON(adminInfo))

	if upstreamData, truncated, _ := upstreamCapture.snapshot(); len(upstreamData) > 0 || truncated {
		trace.UpstreamBody = model.DebugTraceText(sanitizeDebugBody(upstreamData, ""))
		trace.UpstreamBodyTruncated = truncated
	}
	if responseData, truncated, total := responseCapture.snapshot(); len(responseData) > 0 || truncated {
		trace.ResponseBody = model.DebugTraceText(sanitizeDebugBody(responseData, string(trace.ResponseHeaders)))
		trace.ResponseBodyTruncated = truncated
		trace.ResponseSize = total
	}

	gopool.Go(func() {
		if err := model.CreateDebugKeyTrace(&trace); err != nil {
			common.SysLog("failed to record debug key trace: " + err.Error())
		}
	})
}

func getDebugTraceState(c *gin.Context) *debugTraceState {
	if c == nil {
		return nil
	}
	value, ok := c.Get(debugTraceContextKey)
	if !ok || value == nil {
		return nil
	}
	state, ok := value.(*debugTraceState)
	if !ok {
		return nil
	}
	return state
}

func readDebugBodyStorage(storage common.BodyStorage) ([]byte, bool, error) {
	if storage == nil {
		return nil, false, nil
	}
	current, err := storage.Seek(0, io.SeekCurrent)
	if err != nil {
		return nil, false, err
	}
	defer func() {
		_, _ = storage.Seek(current, io.SeekStart)
	}()
	if _, err = storage.Seek(0, io.SeekStart); err != nil {
		return nil, false, err
	}
	var buf bytes.Buffer
	n, err := io.Copy(&buf, io.LimitReader(storage, int64(debugTraceBodyLimit)+1))
	if err != nil {
		return nil, false, err
	}
	data := buf.Bytes()
	truncated := n > int64(debugTraceBodyLimit) || storage.Size() > int64(debugTraceBodyLimit)
	if len(data) > debugTraceBodyLimit {
		data = data[:debugTraceBodyLimit]
	}
	return append([]byte(nil), data...), truncated, nil
}

func sanitizeDebugHeaders(headers http.Header) map[string][]string {
	result := make(map[string][]string)
	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		values := headers.Values(key)
		if isSensitiveHeader(key) {
			result[key] = []string{"[redacted]"}
			continue
		}
		copied := make([]string, len(values))
		copy(copied, values)
		result[key] = copied
	}
	return result
}

func isSensitiveHeader(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	switch normalized {
	case "authorization", "proxy-authorization", "x-api-key", "x-goog-api-key", "api-key", "cookie", "set-cookie", "x-kpay-signature":
		return true
	default:
		return strings.Contains(normalized, "token") || strings.Contains(normalized, "secret")
	}
}

func sanitizeDebugURL(u *url.URL) string {
	if u == nil {
		return ""
	}
	copied := *u
	values := copied.Query()
	for key := range values {
		if isSensitiveQueryKey(key) {
			values.Set(key, "[redacted]")
		}
	}
	copied.RawQuery = values.Encode()
	return copied.String()
}

func isSensitiveQueryKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	return normalized == "key" ||
		strings.Contains(normalized, "api_key") ||
		strings.Contains(normalized, "apikey") ||
		strings.Contains(normalized, "token") ||
		strings.Contains(normalized, "secret") ||
		strings.Contains(normalized, "password")
}

func sanitizeDebugBody(data []byte, contentType string) string {
	_ = contentType
	if len(data) == 0 {
		return ""
	}
	text := string(data)
	var parsed any
	if err := common.Unmarshal(data, &parsed); err == nil {
		sanitized := sanitizeDebugJSONValue(parsed, "")
		if out, marshalErr := common.Marshal(sanitized); marshalErr == nil {
			text = string(out)
		}
	}
	text = debugBodySecretPattern.ReplaceAllString(text, `${1}"[redacted]"`)
	if len(text) > debugTraceBodyLimit {
		text = text[:debugTraceBodyLimit] + "\n[truncated]"
	}
	return text
}

func sanitizeDebugJSONValue(value any, key string) any {
	if isSensitiveJSONKey(key) {
		return "[redacted]"
	}
	switch v := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(v))
		for childKey, childValue := range v {
			out[childKey] = sanitizeDebugJSONValue(childValue, childKey)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, child := range v {
			out[i] = sanitizeDebugJSONValue(child, key)
		}
		return out
	case string:
		if isLargePayloadKey(key) && len(v) > 512 {
			return fmt.Sprintf("[omitted large field, bytes=%d]", len(v))
		}
		if len(v) > 16384 {
			return v[:16384] + "\n[truncated string]"
		}
		return v
	default:
		return value
	}
}

func isSensitiveJSONKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	return normalized == "authorization" ||
		normalized == "api_key" ||
		normalized == "apikey" ||
		normalized == "access_token" ||
		normalized == "refresh_token" ||
		normalized == "password" ||
		normalized == "secret" ||
		strings.Contains(normalized, "api-key")
}

func isLargePayloadKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	return strings.Contains(normalized, "image") ||
		strings.Contains(normalized, "audio") ||
		strings.Contains(normalized, "file") ||
		strings.Contains(normalized, "data") ||
		strings.Contains(normalized, "base64")
}

func debugTraceJSON(value any) string {
	data, err := common.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(data)
}
