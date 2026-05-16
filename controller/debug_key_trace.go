package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

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
