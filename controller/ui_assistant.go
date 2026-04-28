package controller

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	uiAssistantMaxScreenshots    = 2
	uiAssistantMaxKnowledgeChars = 6000
	uiAssistantFreeLimitCode     = "assistant_free_limit_exceeded"
)

type uiAssistantConfigPayload struct {
	Enabled          *bool  `json:"enabled"`
	AssistantName    string `json:"assistant_name"`
	WelcomeMessage   string `json:"welcome_message"`
	ProviderType     string `json:"provider_type"`
	BaseURL          string `json:"base_url"`
	APIKey           string `json:"api_key"`
	ClearAPIKey      bool   `json:"clear_api_key"`
	ModelName        string `json:"model_name"`
	SystemPrompt     string `json:"system_prompt"`
	AllowScreenshot  *bool  `json:"allow_screenshot"`
	KnowledgeEnabled *bool  `json:"knowledge_enabled"`
	StoreSessions    *bool  `json:"store_sessions"`
	DailyLimit       int    `json:"daily_limit"`
	MaxImageBytes    int    `json:"max_image_bytes"`
}

type uiAssistantDocumentPayload struct {
	Title     string `json:"title"`
	Content   string `json:"content"`
	Enabled   *bool  `json:"enabled"`
	SortOrder int    `json:"sort_order"`
}

type uiAssistantScreenshotPayload struct {
	DataURL string `json:"data_url"`
}

type uiAssistantAnalyzePayload struct {
	Question    string                         `json:"question"`
	PagePath    string                         `json:"page_path"`
	Screenshots []uiAssistantScreenshotPayload `json:"screenshots"`
}

type uiAssistantChatMessagePayload struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type uiAssistantChatPayload struct {
	Messages    []uiAssistantChatMessagePayload `json:"messages"`
	PagePath    string                          `json:"page_path"`
	Screenshots []uiAssistantScreenshotPayload  `json:"screenshots"`
	UseBalance  bool                            `json:"use_balance"`
}

type uiAssistantModelResult struct {
	Decision string `json:"decision"`
	Summary  string `json:"summary"`
	Answer   string `json:"answer"`
}

type openAIChatRequest struct {
	Model       string              `json:"model"`
	Group       string              `json:"group,omitempty"`
	Messages    []openAIChatMessage `json:"messages"`
	Temperature float64             `json:"temperature,omitempty"`
	MaxTokens   int                 `json:"max_tokens,omitempty"`
	Stream      bool                `json:"stream,omitempty"`
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type openAITextPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type openAIImagePart struct {
	Type     string             `json:"type"`
	ImageURL openAIImageURLPart `json:"image_url"`
}

type openAIImageURLPart struct {
	URL string `json:"url"`
}

type openAIChatResponse struct {
	Message string `json:"message,omitempty"`
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

type openAIChatStreamResponse struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func assistantConfigAdminResponse(config *model.UIAssistantConfig) gin.H {
	return gin.H{
		"id":                config.Id,
		"enabled":           config.Enabled,
		"assistant_name":    config.AssistantName,
		"welcome_message":   config.WelcomeMessage,
		"provider_type":     config.ProviderType,
		"base_url":          config.BaseURL,
		"has_api_key":       config.APIKey != "",
		"api_key_masked":    maskSecret(config.APIKey),
		"model_name":        config.ModelName,
		"system_prompt":     config.SystemPrompt,
		"allow_screenshot":  config.AllowScreenshot,
		"knowledge_enabled": config.KnowledgeEnabled,
		"store_sessions":    config.StoreSessions,
		"daily_limit":       assistantDailyLimit(config),
		"max_image_bytes":   config.MaxImageBytes,
		"created_at":        config.CreatedAt,
		"updated_at":        config.UpdatedAt,
	}
}

func assistantConfigClientResponse(config *model.UIAssistantConfig) gin.H {
	return gin.H{
		"enabled":          config.Enabled,
		"assistant_name":   config.AssistantName,
		"welcome_message":  config.WelcomeMessage,
		"allow_screenshot": config.AllowScreenshot,
		"daily_limit":      assistantDailyLimit(config),
		"max_image_bytes":  config.MaxImageBytes,
	}
}

func maskSecret(secret string) string {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return ""
	}
	if len(secret) <= 8 {
		return "****"
	}
	return secret[:4] + "****" + secret[len(secret)-4:]
}

func boolPayload(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func assistantDailyLimit(config *model.UIAssistantConfig) int {
	if config == nil || config.DailyLimit <= 0 {
		return 8
	}
	if config.DailyLimit > 8 {
		return 8
	}
	return config.DailyLimit
}

func assistantDailyLimitReached(c *gin.Context, config *model.UIAssistantConfig) (bool, int64, int, error) {
	limit := assistantDailyLimit(config)
	if limit <= 0 {
		return false, 0, limit, nil
	}
	total, err := model.CountUIAssistantSessions(c.GetInt("id"), common.GetTimestamp()-86400)
	if err != nil {
		return false, 0, limit, err
	}
	return total >= int64(limit), total, limit, nil
}

func assistantFreeLimitExceeded(c *gin.Context, used int64, limit int) {
	c.JSON(http.StatusPaymentRequired, gin.H{
		"success": false,
		"code":    uiAssistantFreeLimitCode,
		"message": "今天的免费 AI 助手次数已经用完了，是否使用账户余额继续对话？继续后会按当前用户可用模型正常扣费。",
		"data": gin.H{
			"used":             used,
			"free_daily_limit": limit,
		},
	})
}

func assistantChatError(c *gin.Context, status int, msg string) {
	if status < 400 {
		status = http.StatusBadGateway
	}
	c.JSON(status, gin.H{
		"success": false,
		"message": msg,
	})
}

func GetUIAssistantClientConfig(c *gin.Context) {
	config, err := model.GetUIAssistantConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, assistantConfigClientResponse(config))
}

func AdminGetUIAssistantConfig(c *gin.Context) {
	config, err := model.GetUIAssistantConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, assistantConfigAdminResponse(config))
}

func AdminSaveUIAssistantConfig(c *gin.Context) {
	var payload uiAssistantConfigPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	config, err := model.GetUIAssistantConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	config.Enabled = boolPayload(payload.Enabled, config.Enabled)
	config.AssistantName = payload.AssistantName
	config.WelcomeMessage = payload.WelcomeMessage
	config.ProviderType = payload.ProviderType
	config.BaseURL = payload.BaseURL
	if payload.ClearAPIKey {
		config.APIKey = ""
	} else if strings.TrimSpace(payload.APIKey) != "" {
		config.APIKey = payload.APIKey
	}
	config.ModelName = payload.ModelName
	config.SystemPrompt = payload.SystemPrompt
	config.AllowScreenshot = boolPayload(payload.AllowScreenshot, config.AllowScreenshot)
	config.KnowledgeEnabled = boolPayload(payload.KnowledgeEnabled, config.KnowledgeEnabled)
	config.StoreSessions = boolPayload(payload.StoreSessions, config.StoreSessions)
	config.DailyLimit = payload.DailyLimit
	config.MaxImageBytes = payload.MaxImageBytes
	if err = model.SaveUIAssistantConfig(config); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, assistantConfigAdminResponse(config))
}

func AdminListUIAssistantDocuments(c *gin.Context) {
	docs, err := model.GetAdminUIAssistantDocuments()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": docs})
}

func AdminCreateUIAssistantDocument(c *gin.Context) {
	var payload uiAssistantDocumentPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	doc := &model.UIAssistantDocument{
		Title:     payload.Title,
		Content:   payload.Content,
		Enabled:   boolPayload(payload.Enabled, true),
		SortOrder: payload.SortOrder,
		CreatedBy: c.GetInt("id"),
		UpdatedBy: c.GetInt("id"),
	}
	if err := model.CreateUIAssistantDocument(doc); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, doc)
}

func AdminUpdateUIAssistantDocument(c *gin.Context) {
	id, err := parseInt64Param(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiAssistantDocumentPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	doc, err := model.GetUIAssistantDocumentById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	doc.Title = payload.Title
	doc.Content = payload.Content
	doc.Enabled = boolPayload(payload.Enabled, doc.Enabled)
	doc.SortOrder = payload.SortOrder
	doc.UpdatedBy = c.GetInt("id")
	if err = model.UpdateUIAssistantDocument(doc); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, doc)
}

func AdminDeleteUIAssistantDocument(c *gin.Context) {
	id, err := parseInt64Param(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteUIAssistantDocumentById(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListUIAssistantSessions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	sessions, total, err := model.GetAdminUIAssistantSessions(pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(sessions)
	common.ApiSuccess(c, pageInfo)
}

func AnalyzeUIAssistant(c *gin.Context) {
	config, err := model.GetUIAssistantConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !config.Enabled {
		common.ApiErrorMsg(c, "AI 助手暂未启用")
		return
	}
	if config.APIKey == "" || config.ModelName == "" {
		common.ApiErrorMsg(c, "AI 助手尚未完成模型配置")
		return
	}
	var payload uiAssistantAnalyzePayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	payload.Question = strings.TrimSpace(payload.Question)
	payload.PagePath = strings.TrimSpace(payload.PagePath)
	if payload.Question == "" && len(payload.Screenshots) == 0 {
		common.ApiErrorMsg(c, "请描述问题或上传截图")
		return
	}
	if len([]rune(payload.Question)) > 2000 {
		common.ApiErrorMsg(c, "问题描述不能超过 2000 个字符")
		return
	}
	if len(payload.Screenshots) > uiAssistantMaxScreenshots {
		common.ApiErrorMsg(c, fmt.Sprintf("最多上传 %d 张截图", uiAssistantMaxScreenshots))
		return
	}
	if !config.AllowScreenshot && len(payload.Screenshots) > 0 {
		common.ApiErrorMsg(c, "当前未开启截图分析")
		return
	}
	limitReached, used, limit, err := assistantDailyLimitReached(c, config)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if limitReached {
		assistantFreeLimitExceeded(c, used, limit)
		return
	}
	if err = validateAssistantScreenshots(payload.Screenshots, config.MaxImageBytes); err != nil {
		common.ApiError(c, err)
		return
	}

	knowledge := ""
	if config.KnowledgeEnabled {
		knowledge, err = buildAssistantKnowledge(payload.Question)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	result, rawAnswer, err := callAssistantModel(c, config, payload, knowledge)
	session := &model.UIAssistantSession{
		UserId:          c.GetInt("id"),
		ScreenshotCount: len(payload.Screenshots),
		ProviderType:    config.ProviderType,
		ModelName:       config.ModelName,
	}
	if config.StoreSessions {
		session.PagePath = payload.PagePath
		session.Question = payload.Question
	}
	if err != nil {
		if config.StoreSessions {
			session.Decision = model.UIAssistantDecisionManualReview
			session.ErrorMessage = err.Error()
		}
		_ = model.CreateUIAssistantSession(session)
		common.ApiError(c, err)
		return
	}
	if result.Decision == "" {
		result.Decision = model.UIAssistantDecisionInsufficientInfo
	}
	if result.Answer == "" {
		result.Answer = rawAnswer
	}
	if result.Summary == "" {
		result.Summary = result.Answer
	}
	if config.StoreSessions {
		session.Decision = result.Decision
		session.AnswerSummary = trimRunes(result.Summary, 1000)
	}
	_ = model.CreateUIAssistantSession(session)
	common.ApiSuccess(c, gin.H{
		"decision":   result.Decision,
		"summary":    result.Summary,
		"answer":     result.Answer,
		"session_id": session.Id,
	})
}

func ChatUIAssistant(c *gin.Context) {
	config, err := model.GetUIAssistantConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !config.Enabled {
		common.ApiErrorMsg(c, "AI 助手暂未启用")
		return
	}
	if config.APIKey == "" || config.ModelName == "" {
		common.ApiErrorMsg(c, "AI 助手尚未完成模型配置")
		return
	}
	var payload uiAssistantChatPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	payload.PagePath = strings.TrimSpace(payload.PagePath)
	payload.Messages = normalizeAssistantChatMessages(payload.Messages)
	if len(payload.Messages) == 0 && len(payload.Screenshots) == 0 {
		common.ApiErrorMsg(c, "请先描述问题或上传截图")
		return
	}
	if len(payload.Screenshots) > uiAssistantMaxScreenshots {
		common.ApiErrorMsg(c, fmt.Sprintf("最多上传 %d 张截图", uiAssistantMaxScreenshots))
		return
	}
	if !config.AllowScreenshot && len(payload.Screenshots) > 0 {
		common.ApiErrorMsg(c, "当前未开启截图分析")
		return
	}
	if err = validateAssistantScreenshots(payload.Screenshots, config.MaxImageBytes); err != nil {
		common.ApiError(c, err)
		return
	}
	limitReached, used, limit, err := assistantDailyLimitReached(c, config)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	useBalance := payload.UseBalance && limitReached
	if limitReached && !payload.UseBalance {
		assistantFreeLimitExceeded(c, used, limit)
		return
	}
	latestQuestion := latestAssistantUserMessage(payload.Messages)
	knowledge := ""
	if config.KnowledgeEnabled {
		knowledge, err = buildAssistantKnowledge(latestQuestion)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	reqBody, err := buildAssistantStreamRequest(c, config, payload, knowledge)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	endpoint := assistantEndpoint(c, config)
	if useBalance {
		endpoint = assistantPlaygroundEndpoint(c)
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	if useBalance {
		httpReq.Header.Set("New-Api-User", strconv.Itoa(c.GetInt("id")))
		for _, cookie := range c.Request.Cookies() {
			httpReq.AddCookie(cookie)
		}
	} else {
		httpReq.Header.Set("Authorization", "Bearer "+config.APIKey)
	}
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		limited := io.LimitReader(resp.Body, 2*1024*1024)
		var chatResp openAIChatResponse
		if decodeErr := common.DecodeJson(limited, &chatResp); decodeErr == nil {
			if chatResp.Error != nil && chatResp.Error.Message != "" {
				assistantChatError(c, resp.StatusCode, chatResp.Error.Message)
				return
			}
			if chatResp.Message != "" {
				assistantChatError(c, resp.StatusCode, chatResp.Message)
				return
			}
		}
		assistantChatError(c, resp.StatusCode, fmt.Sprintf("AI 助手模型请求失败：HTTP %d", resp.StatusCode))
		return
	}

	c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)
	flusher, _ := c.Writer.(http.Flusher)
	answer, streamErr := streamAssistantResponse(resp.Body, c.Writer, flusher)
	if streamErr != nil {
		_, _ = c.Writer.Write([]byte("\n\n[AI 助手连接中断，请稍后重试]"))
		if flusher != nil {
			flusher.Flush()
		}
	}
	session := &model.UIAssistantSession{
		UserId:          c.GetInt("id"),
		ScreenshotCount: len(payload.Screenshots),
		ProviderType:    config.ProviderType,
		ModelName:       config.ModelName,
	}
	if useBalance {
		session.ProviderType = model.UIAssistantProviderBalance
	}
	if config.StoreSessions {
		session.PagePath = payload.PagePath
		session.Question = latestQuestion
		session.Decision = inferAssistantDecision(answer)
		session.AnswerSummary = trimRunes(answer, 1000)
		if streamErr != nil {
			session.ErrorMessage = streamErr.Error()
		}
	}
	_ = model.CreateUIAssistantSession(session)
}

func parseInt64Param(c *gin.Context, key string) (int64, error) {
	raw := strings.TrimSpace(c.Param(key))
	if raw == "" {
		return 0, errors.New("缺少 ID")
	}
	var id int64
	_, err := fmt.Sscan(raw, &id)
	if err != nil || id <= 0 {
		return 0, errors.New("无效的 ID")
	}
	return id, nil
}

func validateAssistantScreenshots(screenshots []uiAssistantScreenshotPayload, maxBytes int) error {
	for _, shot := range screenshots {
		dataURL := strings.TrimSpace(shot.DataURL)
		if dataURL == "" {
			continue
		}
		if !strings.HasPrefix(dataURL, "data:image/") {
			return errors.New("截图格式仅支持图片 data URL")
		}
		comma := strings.Index(dataURL, ",")
		if comma < 0 {
			return errors.New("截图数据格式错误")
		}
		meta := dataURL[:comma]
		if !strings.Contains(meta, ";base64") {
			return errors.New("截图必须为 base64 编码")
		}
		if !strings.Contains(meta, "image/png") &&
			!strings.Contains(meta, "image/jpeg") &&
			!strings.Contains(meta, "image/webp") {
			return errors.New("截图仅支持 PNG、JPEG 或 WebP")
		}
		raw := strings.TrimSpace(dataURL[comma+1:])
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return errors.New("截图 base64 解析失败")
		}
		if maxBytes > 0 && len(decoded) > maxBytes {
			return fmt.Errorf("截图不能超过 %.1fMB", float64(maxBytes)/1024/1024)
		}
	}
	return nil
}

func buildAssistantKnowledge(question string) (string, error) {
	docs, err := model.GetEnabledUIAssistantDocuments()
	if err != nil {
		return "", err
	}
	if len(docs) == 0 {
		return "", nil
	}
	var builder strings.Builder
	written := 0
	for _, doc := range docs {
		if doc == nil {
			continue
		}
		chunk := fmt.Sprintf("## %s\n%s\n\n", doc.Title, doc.Content)
		if written+len([]rune(chunk)) > uiAssistantMaxKnowledgeChars {
			remaining := uiAssistantMaxKnowledgeChars - written
			if remaining <= 0 {
				break
			}
			chunk = trimRunes(chunk, remaining)
		}
		builder.WriteString(chunk)
		written += len([]rune(chunk))
		if written >= uiAssistantMaxKnowledgeChars {
			break
		}
	}
	return strings.TrimSpace(builder.String()), nil
}

func normalizeAssistantChatMessages(messages []uiAssistantChatMessagePayload) []uiAssistantChatMessagePayload {
	normalized := make([]uiAssistantChatMessagePayload, 0, len(messages))
	for _, message := range messages {
		role := strings.TrimSpace(message.Role)
		content := strings.TrimSpace(message.Content)
		if role != "user" && role != "assistant" {
			continue
		}
		if content == "" {
			continue
		}
		if len([]rune(content)) > 2000 {
			content = trimRunes(content, 2000)
		}
		normalized = append(normalized, uiAssistantChatMessagePayload{
			Role:    role,
			Content: content,
		})
	}
	if len(normalized) > 8 {
		normalized = normalized[len(normalized)-8:]
	}
	return normalized
}

func latestAssistantUserMessage(messages []uiAssistantChatMessagePayload) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" {
			return messages[i].Content
		}
	}
	return ""
}

func buildAssistantStreamRequest(c *gin.Context, config *model.UIAssistantConfig, payload uiAssistantChatPayload, knowledge string) ([]byte, error) {
	messages := []openAIChatMessage{
		{
			Role:    "system",
			Content: strings.TrimSpace(config.SystemPrompt + "\n\n你现在以对话形式回复用户。你是热心、善良、体贴的小助手：先理解和安抚用户，再给出清楚步骤。不要返回 JSON，不要使用代码块包裹整段回复。回答要自然、简洁、可执行；必要时用编号步骤。"),
		},
	}
	for i, message := range payload.Messages {
		isLast := i == len(payload.Messages)-1
		if !isLast || message.Role != "user" {
			messages = append(messages, openAIChatMessage{Role: message.Role, Content: message.Content})
			continue
		}
		text := buildAssistantChatUserText(payload, message.Content, knowledge)
		content := []any{openAITextPart{Type: "text", Text: text}}
		for _, shot := range payload.Screenshots {
			if strings.TrimSpace(shot.DataURL) == "" {
				continue
			}
			content = append(content, openAIImagePart{
				Type: "image_url",
				ImageURL: openAIImageURLPart{
					URL: shot.DataURL,
				},
			})
		}
		messages = append(messages, openAIChatMessage{Role: "user", Content: content})
	}
	if len(payload.Messages) == 0 && len(payload.Screenshots) > 0 {
		content := []any{openAITextPart{Type: "text", Text: buildAssistantChatUserText(payload, "用户仅提供了截图。", knowledge)}}
		for _, shot := range payload.Screenshots {
			content = append(content, openAIImagePart{
				Type: "image_url",
				ImageURL: openAIImageURLPart{
					URL: shot.DataURL,
				},
			})
		}
		messages = append(messages, openAIChatMessage{Role: "user", Content: content})
	}
	reqBody := openAIChatRequest{
		Model:       config.ModelName,
		Messages:    messages,
		Temperature: 0.2,
		MaxTokens:   1000,
		Stream:      true,
	}
	return common.Marshal(reqBody)
}

func buildAssistantChatUserText(payload uiAssistantChatPayload, latestQuestion string, knowledge string) string {
	var builder strings.Builder
	builder.WriteString("请以 Youkies 控制台 AI 助手的身份回复用户。语气要温柔、耐心、体贴，像认真陪用户排查问题的小助手。\n\n当前页面：")
	if payload.PagePath == "" {
		builder.WriteString("未知")
	} else {
		builder.WriteString(payload.PagePath)
	}
	builder.WriteString("\n用户最新问题：\n")
	builder.WriteString(latestQuestion)
	if knowledge != "" {
		builder.WriteString("\n\n站点知识文档：\n")
		builder.WriteString(knowledge)
	}
	builder.WriteString("\n\n请先判断是否能自助解决；如果疑似空回、扣费争议、充值不到账或余额异常，建议提交申诉或联系人工。不要承诺退款或补偿。")
	return builder.String()
}

func streamAssistantResponse(reader io.Reader, writer io.Writer, flusher http.Flusher) (string, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var answer strings.Builder
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk openAIChatStreamResponse
		if err := common.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			return answer.String(), errors.New(chunk.Error.Message)
		}
		for _, choice := range chunk.Choices {
			if choice.Delta.Content == "" {
				continue
			}
			answer.WriteString(choice.Delta.Content)
			if _, err := writer.Write([]byte(choice.Delta.Content)); err != nil {
				return answer.String(), err
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return answer.String(), err
	}
	return answer.String(), nil
}

func inferAssistantDecision(answer string) string {
	answer = strings.TrimSpace(answer)
	if answer == "" {
		return model.UIAssistantDecisionInsufficientInfo
	}
	if strings.Contains(answer, "信息不足") || strings.Contains(answer, "需要补充") {
		return model.UIAssistantDecisionInsufficientInfo
	}
	if strings.Contains(answer, "申诉") || strings.Contains(answer, "空回") || strings.Contains(answer, "扣费") || strings.Contains(answer, "充值不到账") {
		return model.UIAssistantDecisionSubmitAppeal
	}
	if strings.Contains(answer, "人工") || strings.Contains(answer, "管理员") {
		return model.UIAssistantDecisionManualReview
	}
	return model.UIAssistantDecisionSelfSolve
}

func callAssistantModel(c *gin.Context, config *model.UIAssistantConfig, payload uiAssistantAnalyzePayload, knowledge string) (uiAssistantModelResult, string, error) {
	endpoint := assistantEndpoint(c, config)
	text := buildAssistantUserText(payload, knowledge)
	content := []any{openAITextPart{Type: "text", Text: text}}
	for _, shot := range payload.Screenshots {
		if strings.TrimSpace(shot.DataURL) == "" {
			continue
		}
		content = append(content, openAIImagePart{
			Type: "image_url",
			ImageURL: openAIImageURLPart{
				URL: shot.DataURL,
			},
		})
	}
	reqBody := openAIChatRequest{
		Model: config.ModelName,
		Messages: []openAIChatMessage{
			{Role: "system", Content: config.SystemPrompt},
			{Role: "user", Content: content},
		},
		Temperature: 0.2,
		MaxTokens:   900,
	}
	bodyBytes, err := common.Marshal(reqBody)
	if err != nil {
		return uiAssistantModelResult{}, "", err
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 45*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return uiAssistantModelResult{}, "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+config.APIKey)
	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return uiAssistantModelResult{}, "", err
	}
	defer resp.Body.Close()
	limited := io.LimitReader(resp.Body, 2*1024*1024)
	var chatResp openAIChatResponse
	if err = common.DecodeJson(limited, &chatResp); err != nil {
		return uiAssistantModelResult{}, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if chatResp.Error != nil && chatResp.Error.Message != "" {
			return uiAssistantModelResult{}, "", errors.New(chatResp.Error.Message)
		}
		return uiAssistantModelResult{}, "", fmt.Errorf("AI 助手模型请求失败：HTTP %d", resp.StatusCode)
	}
	if len(chatResp.Choices) == 0 {
		return uiAssistantModelResult{}, "", errors.New("AI 助手模型没有返回内容")
	}
	rawAnswer := normalizeAssistantContent(chatResp.Choices[0].Message.Content)
	result := parseAssistantJSON(rawAnswer)
	return result, rawAnswer, nil
}

func assistantEndpoint(c *gin.Context, config *model.UIAssistantConfig) string {
	baseURL := strings.TrimSpace(config.BaseURL)
	if baseURL == "" && config.ProviderType == model.UIAssistantProviderSite {
		scheme := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
		if scheme == "" {
			if c.Request.TLS != nil {
				scheme = "https"
			} else {
				scheme = "http"
			}
		}
		baseURL = scheme + "://" + c.Request.Host + "/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	if strings.HasSuffix(baseURL, "/chat/completions") {
		return baseURL
	}
	if strings.HasSuffix(baseURL, "/v1") {
		return baseURL + "/chat/completions"
	}
	return baseURL + "/v1/chat/completions"
}

func assistantPlaygroundEndpoint(c *gin.Context) string {
	scheme := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))
	if scheme == "" {
		if c.Request.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	return scheme + "://" + c.Request.Host + "/pg/chat/completions"
}

func buildAssistantUserText(payload uiAssistantAnalyzePayload, knowledge string) string {
	var builder strings.Builder
	builder.WriteString("请根据以下信息做预诊断。你是热心、善良、体贴的小助手，结论要温和、清楚、可执行。只返回 JSON，不要使用 Markdown 包裹：\n")
	builder.WriteString(`{"decision":"self_solve|submit_appeal|manual_review|insufficient_info","summary":"一句话结论","answer":"给用户看的中文说明和步骤"}`)
	builder.WriteString("\n\n当前页面：")
	if payload.PagePath == "" {
		builder.WriteString("未知")
	} else {
		builder.WriteString(payload.PagePath)
	}
	builder.WriteString("\n用户问题：\n")
	if payload.Question == "" {
		builder.WriteString("用户仅提供了截图。")
	} else {
		builder.WriteString(payload.Question)
	}
	if knowledge != "" {
		builder.WriteString("\n\n站点知识文档：\n")
		builder.WriteString(knowledge)
	}
	builder.WriteString("\n\n判断标准：能自助处理选 self_solve；疑似空回/扣费争议选 submit_appeal；需要管理员介入选 manual_review；信息不够选 insufficient_info。")
	return builder.String()
}

func normalizeAssistantContent(raw json.RawMessage) string {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" {
		return ""
	}
	var text string
	if err := common.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text)
	}
	return trimmed
}

func parseAssistantJSON(content string) uiAssistantModelResult {
	content = strings.TrimSpace(content)
	if content == "" {
		return uiAssistantModelResult{}
	}
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		content = content[start : end+1]
	}
	var result uiAssistantModelResult
	if err := common.Unmarshal([]byte(content), &result); err != nil {
		return uiAssistantModelResult{
			Decision: model.UIAssistantDecisionInsufficientInfo,
			Summary:  trimRunes(content, 200),
			Answer:   content,
		}
	}
	result.Decision = normalizeAssistantDecision(result.Decision)
	return result
}

func normalizeAssistantDecision(decision string) string {
	switch strings.TrimSpace(decision) {
	case model.UIAssistantDecisionSelfSolve,
		model.UIAssistantDecisionSubmitAppeal,
		model.UIAssistantDecisionManualReview,
		model.UIAssistantDecisionInsufficientInfo:
		return decision
	default:
		return model.UIAssistantDecisionInsufficientInfo
	}
}

func trimRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}
