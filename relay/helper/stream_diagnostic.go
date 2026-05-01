package helper

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func LogEmptyStreamDiagnostic(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, source string) {
	if info == nil {
		logger.LogError(c, fmt.Sprintf("empty_stream_diagnostic source=%s relay_info=nil", source))
		return
	}

	statusCode := 0
	contentType := ""
	if resp != nil {
		statusCode = resp.StatusCode
		contentType = resp.Header.Get("Content-Type")
	}

	endReason := ""
	endError := ""
	errorCount := 0
	if info.StreamStatus != nil {
		endReason = string(info.StreamStatus.EndReason)
		if info.StreamStatus.EndError != nil {
			endError = info.StreamStatus.EndError.Error()
		}
		errorCount = info.StreamStatus.TotalErrorCount()
	}

	method := ""
	path := ""
	clientIP := ""
	requestID := ""
	if c != nil && c.Request != nil {
		method = c.Request.Method
		path = c.Request.URL.String()
		clientIP = c.ClientIP()
		requestID = c.GetString(common.RequestIdKey)
	}

	logger.LogError(c, fmt.Sprintf(
		"empty_stream_diagnostic source=%s request_id=%s method=%s path=%q client_ip=%s channel_id=%d channel_type=%d api_type=%d relay_mode=%d relay_format=%s final_request_format=%s origin_model=%q upstream_model=%q is_stream=%t upstream_force_stream=%t is_upstream_stream=%t support_stream_options=%t should_include_usage=%t received=%d upstream_status=%d upstream_content_type=%q end_reason=%s end_error=%q stream_error_count=%d conversion_chain=%s",
		source,
		requestID,
		method,
		path,
		clientIP,
		info.ChannelId,
		info.ChannelType,
		info.ApiType,
		info.RelayMode,
		info.RelayFormat,
		info.GetFinalRequestRelayFormat(),
		info.OriginModelName,
		info.UpstreamModelName,
		info.IsStream,
		info.UpstreamForceStream,
		info.IsUpstreamStream(),
		info.SupportStreamOptions,
		info.ShouldIncludeUsage,
		info.ReceivedResponseCount,
		statusCode,
		contentType,
		endReason,
		endError,
		errorCount,
		formatRelayFormatChain(info.RequestConversionChain),
	))
}

func formatRelayFormatChain(chain []types.RelayFormat) string {
	if len(chain) == 0 {
		return ""
	}
	items := make([]string, 0, len(chain))
	for _, item := range chain {
		items = append(items, string(item))
	}
	return strings.Join(items, "->")
}
