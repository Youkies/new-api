package openai

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/openrouter"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"

	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func sendStreamData(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	if data == "" {
		return nil
	}

	if !forceFormat && !thinkToContent {
		return helper.StringData(c, data)
	}

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &lastStreamResponse); err != nil {
		return err
	}

	if !thinkToContent {
		return helper.ObjectData(c, lastStreamResponse)
	}

	hasThinkingContent := false
	hasContent := false
	var thinkingContent strings.Builder
	for _, choice := range lastStreamResponse.Choices {
		if len(choice.Delta.GetReasoningContent()) > 0 {
			hasThinkingContent = true
			thinkingContent.WriteString(choice.Delta.GetReasoningContent())
		}
		if len(choice.Delta.GetContentString()) > 0 {
			hasContent = true
		}
	}

	// Handle think to content conversion
	if info.ThinkingContentInfo.IsFirstThinkingContent {
		if hasThinkingContent {
			response := lastStreamResponse.Copy()
			for i := range response.Choices {
				// send `think` tag with thinking content
				response.Choices[i].Delta.SetContentString("<think>\n" + thinkingContent.String())
				response.Choices[i].Delta.ReasoningContent = nil
				response.Choices[i].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.IsFirstThinkingContent = false
			info.ThinkingContentInfo.HasSentThinkingContent = true
			return helper.ObjectData(c, response)
		}
	}

	if lastStreamResponse.Choices == nil || len(lastStreamResponse.Choices) == 0 {
		return helper.ObjectData(c, lastStreamResponse)
	}

	// Process each choice
	for i, choice := range lastStreamResponse.Choices {
		// Handle transition from thinking to content
		// only send `</think>` tag when previous thinking content has been sent
		if hasContent && !info.ThinkingContentInfo.SendLastThinkingContent && info.ThinkingContentInfo.HasSentThinkingContent {
			response := lastStreamResponse.Copy()
			for j := range response.Choices {
				response.Choices[j].Delta.SetContentString("\n</think>\n")
				response.Choices[j].Delta.ReasoningContent = nil
				response.Choices[j].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.SendLastThinkingContent = true
			helper.ObjectData(c, response)
		}

		// Convert reasoning content to regular content if any
		if len(choice.Delta.GetReasoningContent()) > 0 {
			lastStreamResponse.Choices[i].Delta.SetContentString(choice.Delta.GetReasoningContent())
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		} else if !hasThinkingContent && !hasContent {
			// flush thinking content
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		}
	}

	return helper.ObjectData(c, lastStreamResponse)
}

func OaiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	model := info.UpstreamModelName
	var responseId string
	var createAt int64 = 0
	var systemFingerprint string
	var containStreamUsage bool
	var responseTextBuilder strings.Builder
	var toolCount int
	var usage = &dto.Usage{}
	var streamItems []string // store stream items
	var lastStreamData string
	var secondLastStreamData string // 存储倒数第二个stream data，用于音频模型

	// 检查是否为音频模型
	isAudioModel := strings.Contains(strings.ToLower(model), "audio")

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if lastStreamData != "" {
			if err := HandleStreamFormat(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent); err != nil {
				common.SysLog("error handling stream format: " + err.Error())
				sr.Error(err)
			}
		}
		if len(data) > 0 {
			// 对音频模型，保存倒数第二个stream data
			if isAudioModel && lastStreamData != "" {
				secondLastStreamData = lastStreamData
			}

			lastStreamData = data
			streamItems = append(streamItems, data)
		}
	})
	clientGone := info.StreamStatus != nil && info.StreamStatus.IsClientGone()

	// 对音频模型，从倒数第二个stream data中提取usage信息
	if isAudioModel && secondLastStreamData != "" {
		var streamResp struct {
			Usage *dto.Usage `json:"usage"`
		}
		err := common.Unmarshal([]byte(secondLastStreamData), &streamResp)
		if err == nil && streamResp.Usage != nil && service.ValidUsage(streamResp.Usage) {
			usage = streamResp.Usage
			containStreamUsage = true

			if common.DebugEnabled {
				logger.LogDebug(c, fmt.Sprintf("Audio model usage extracted from second last SSE: PromptTokens=%d, CompletionTokens=%d, TotalTokens=%d, InputTokens=%d, OutputTokens=%d",
					usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens,
					usage.InputTokens, usage.OutputTokens))
			}
		}
	}

	// 处理最后的响应
	shouldSendLastResp := true
	if err := handleLastResponse(lastStreamData, &responseId, &createAt, &systemFingerprint, &model, &usage,
		&containStreamUsage, info, &shouldSendLastResp); err != nil {
		logger.LogError(c, fmt.Sprintf("error handling last response: %s, lastStreamData: [%s]", err.Error(), lastStreamData))
	}

	if info.RelayFormat == types.RelayFormatOpenAI && !clientGone {
		if shouldSendLastResp {
			_ = sendStreamData(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent)
		}
	}

	// 处理token计算
	if err := processTokens(info.RelayMode, streamItems, &responseTextBuilder, &toolCount); err != nil {
		logger.LogError(c, "error processing tokens: "+err.Error())
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastStreamData))

	if !clientGone {
		HandleFinalResponse(c, info, lastStreamData, responseId, createAt, model, systemFingerprint, usage, containStreamUsage)
	}

	return usage, nil
}

type openAIStreamScanEvent struct {
	data string
	err  error
	done bool
}

type chatChoiceStreamAccumulator struct {
	role         string
	content      strings.Builder
	reasoning    strings.Builder
	toolCalls    map[int]*dto.ToolCallResponse
	toolCallKeys []int
	finishReason string
}

func OaiStreamToNonStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if info == nil {
		logger.LogError(c, "invalid relay info")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid relay info"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	streamItems, streamErr := collectOpenAIStreamDataNoWrite(c, info, resp)
	if streamErr != nil {
		return nil, streamErr
	}
	if len(streamItems) == 0 {
		helper.LogEmptyStreamDiagnostic(c, info, resp, "openai_stream_to_nonstream")
		return nil, types.NewOpenAIError(fmt.Errorf("empty upstream stream response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	response, usage, responseErr := BuildOpenAITextResponseFromStream(c, info, streamItems)
	if responseErr != nil {
		return nil, responseErr
	}

	responseBody, err := common.Marshal(response)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}

	downstreamResp := *resp
	downstreamResp.Header = resp.Header.Clone()
	downstreamResp.Header.Set("Content-Type", "application/json")
	downstreamResp.Header.Del("Cache-Control")
	downstreamResp.Header.Del("Content-Encoding")
	downstreamResp.Header.Del("Transfer-Encoding")
	downstreamResp.ContentLength = int64(len(responseBody))
	service.IOCopyBytesGracefully(c, &downstreamResp, responseBody)

	return usage, nil
}

func collectOpenAIStreamDataNoWrite(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) ([]string, *types.NewAPIError) {
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024), openAIStreamScannerBufferSize())

	requestCtx := c.Request.Context()
	scanCtx, cancel := context.WithCancel(requestCtx)
	defer cancel()

	events := make(chan openAIStreamScanEvent, 16)
	go func() {
		defer close(events)

		send := func(event openAIStreamScanEvent) bool {
			select {
			case events <- event:
				return true
			case <-scanCtx.Done():
				return false
			}
		}

		for scanner.Scan() {
			line := scanner.Text()
			if common.DebugEnabled {
				println(line)
			}
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if data == "" {
				continue
			}
			if strings.HasPrefix(data, "[DONE]") {
				_ = send(openAIStreamScanEvent{done: true})
				return
			}
			if !send(openAIStreamScanEvent{data: data}) {
				return
			}
		}

		if err := scanner.Err(); err != nil && err != io.EOF {
			_ = send(openAIStreamScanEvent{err: err})
			return
		}
		_ = send(openAIStreamScanEvent{done: true})
	}()

	streamingTimeout := time.Duration(constant.StreamingTimeout) * time.Second
	if streamingTimeout <= 0 {
		streamingTimeout = 300 * time.Second
	}
	timer := time.NewTimer(streamingTimeout)
	defer timer.Stop()

	streamItems := make([]string, 0)
	for {
		select {
		case event, ok := <-events:
			if !ok {
				return streamItems, nil
			}
			if event.err != nil {
				return nil, types.NewOpenAIError(event.err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
			}
			if event.done {
				return streamItems, nil
			}
			if event.data == "" {
				continue
			}
			if info != nil {
				info.SetFirstResponseTime()
				info.ReceivedResponseCount++
			}
			streamItems = append(streamItems, event.data)
			resetOpenAIStreamTimer(timer, streamingTimeout)
		case <-timer.C:
			cancel()
			return nil, types.NewOpenAIError(fmt.Errorf("upstream stream timeout"), types.ErrorCodeBadResponse, http.StatusGatewayTimeout)
		case <-requestCtx.Done():
			cancel()
			return nil, types.NewOpenAIError(requestCtx.Err(), types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}
}

func openAIStreamScannerBufferSize() int {
	if constant.StreamScannerMaxBufferMB > 0 {
		return constant.StreamScannerMaxBufferMB << 20
	}
	return 128 << 20
}

func resetOpenAIStreamTimer(timer *time.Timer, timeout time.Duration) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(timeout)
}

func BuildOpenAITextResponseFromStream(c *gin.Context, info *relaycommon.RelayInfo, streamItems []string) (*dto.OpenAITextResponse, *dto.Usage, *types.NewAPIError) {
	choiceMap := make(map[int]*chatChoiceStreamAccumulator)
	choiceOrder := make([]int, 0)
	usage := &dto.Usage{}
	containStreamUsage := false
	var responseId string
	var created int64
	model := info.UpstreamModelName
	var lastStreamData string

	for _, data := range streamItems {
		lastStreamData = data

		var errorResponse dto.OpenAITextResponse
		if err := common.UnmarshalJsonStr(data, &errorResponse); err == nil {
			if oaiError := errorResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
				return nil, nil, types.WithOpenAIError(*oaiError, http.StatusInternalServerError)
			}
		}

		var streamResponse dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &streamResponse); err != nil {
			return nil, nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}

		if responseId == "" {
			responseId = streamResponse.Id
		}
		if created == 0 {
			created = streamResponse.Created
		}
		if streamResponse.Model != "" {
			model = streamResponse.Model
		}
		if service.ValidUsage(streamResponse.Usage) {
			usage = streamResponse.Usage
			containStreamUsage = true
		}

		for _, choice := range streamResponse.Choices {
			accumulator, ok := choiceMap[choice.Index]
			if !ok {
				accumulator = &chatChoiceStreamAccumulator{}
				choiceMap[choice.Index] = accumulator
				choiceOrder = append(choiceOrder, choice.Index)
			}
			accumulator.append(choice)
		}
	}

	if len(choiceOrder) == 0 {
		return nil, nil, types.NewOpenAIError(fmt.Errorf("stream response has no choices"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if !containStreamUsage {
		var responseTextBuilder strings.Builder
		var toolCount int
		if err := processTokens(info.RelayMode, streamItems, &responseTextBuilder, &toolCount); err != nil {
			logger.LogError(c, "error processing forced upstream stream tokens: "+err.Error())
		}
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastStreamData))

	if responseId == "" {
		responseId = "chatcmpl-" + common.GetRandomString(24)
	}
	if created == 0 {
		created = time.Now().Unix()
	}
	if model == "" {
		model = info.UpstreamModelName
	}

	choices := make([]dto.OpenAITextResponseChoice, 0, len(choiceOrder))
	for _, index := range choiceOrder {
		choices = append(choices, choiceMap[index].toTextResponseChoice(index))
	}

	response := &dto.OpenAITextResponse{
		Id:      responseId,
		Model:   model,
		Object:  "chat.completion",
		Created: created,
		Choices: choices,
		Usage:   *usage,
	}
	return response, usage, nil
}

func (accumulator *chatChoiceStreamAccumulator) append(choice dto.ChatCompletionsStreamResponseChoice) {
	if choice.Delta.Role != "" {
		accumulator.role = choice.Delta.Role
	}
	accumulator.content.WriteString(choice.Delta.GetContentString())
	accumulator.reasoning.WriteString(choice.Delta.GetReasoningContent())
	if choice.FinishReason != nil && *choice.FinishReason != "" {
		accumulator.finishReason = *choice.FinishReason
	}
	for _, toolCall := range choice.Delta.ToolCalls {
		accumulator.appendToolCall(toolCall)
	}
}

func (accumulator *chatChoiceStreamAccumulator) appendToolCall(toolCall dto.ToolCallResponse) {
	index := len(accumulator.toolCallKeys)
	if toolCall.Index != nil {
		index = *toolCall.Index
	}
	if accumulator.toolCalls == nil {
		accumulator.toolCalls = make(map[int]*dto.ToolCallResponse)
	}
	existing, ok := accumulator.toolCalls[index]
	if !ok {
		existing = &dto.ToolCallResponse{}
		accumulator.toolCalls[index] = existing
		accumulator.toolCallKeys = append(accumulator.toolCallKeys, index)
	}
	if toolCall.ID != "" {
		existing.ID = toolCall.ID
	}
	if toolCall.Type != nil {
		existing.Type = toolCall.Type
	}
	if toolCall.Function.Name != "" {
		existing.Function.Name = toolCall.Function.Name
	}
	existing.Function.Arguments += toolCall.Function.Arguments
}

func (accumulator *chatChoiceStreamAccumulator) toTextResponseChoice(index int) dto.OpenAITextResponseChoice {
	role := accumulator.role
	if role == "" {
		role = "assistant"
	}
	finishReason := accumulator.finishReason
	if finishReason == "" {
		finishReason = constant.FinishReasonStop
	}

	content := accumulator.content.String()
	message := dto.Message{
		Role:             role,
		Content:          content,
		ReasoningContent: accumulator.reasoning.String(),
	}
	toolCalls := accumulator.finalToolCalls()
	if len(toolCalls) > 0 {
		if content == "" {
			message.Content = nil
		}
		message.SetToolCalls(toolCalls)
	}

	return dto.OpenAITextResponseChoice{
		Index:        index,
		Message:      message,
		FinishReason: finishReason,
	}
}

func (accumulator *chatChoiceStreamAccumulator) finalToolCalls() []dto.ToolCallResponse {
	if len(accumulator.toolCallKeys) == 0 {
		return nil
	}
	toolCalls := make([]dto.ToolCallResponse, 0, len(accumulator.toolCallKeys))
	for _, index := range accumulator.toolCallKeys {
		toolCall := *accumulator.toolCalls[index]
		toolCall.Index = nil
		if toolCall.Type == nil {
			toolCall.Type = "function"
		}
		toolCalls = append(toolCalls, toolCall)
	}
	return toolCalls
}

func OpenaiHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	var simpleResponse dto.OpenAITextResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	if common.DebugEnabled {
		println("upstream response body:", string(responseBody))
	}
	// Unmarshal to simpleResponse
	if info.ChannelType == constant.ChannelTypeOpenRouter && info.ChannelOtherSettings.IsOpenRouterEnterprise() {
		// 尝试解析为 openrouter enterprise
		var enterpriseResponse openrouter.OpenRouterEnterpriseResponse
		err = common.Unmarshal(responseBody, &enterpriseResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if enterpriseResponse.Success {
			responseBody = enterpriseResponse.Data
		} else {
			logger.LogError(c, fmt.Sprintf("openrouter enterprise response success=false, data: %s", enterpriseResponse.Data))
			return nil, types.NewOpenAIError(fmt.Errorf("openrouter response success=false"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	err = common.Unmarshal(responseBody, &simpleResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := simpleResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	for _, choice := range simpleResponse.Choices {
		if choice.FinishReason == constant.FinishReasonContentFilter {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "openai_finish_reason=content_filter")
			break
		}
	}

	forceFormat := false
	if info.ChannelSetting.ForceFormat {
		forceFormat = true
	}

	usageModified := false
	if simpleResponse.Usage.PromptTokens == 0 {
		completionTokens := simpleResponse.Usage.CompletionTokens
		if completionTokens == 0 {
			for _, choice := range simpleResponse.Choices {
				ctkm := service.CountTextToken(choice.Message.StringContent()+choice.Message.ReasoningContent+choice.Message.Reasoning, info.UpstreamModelName)
				completionTokens += ctkm
			}
		}
		simpleResponse.Usage = dto.Usage{
			PromptTokens:     info.GetEstimatePromptTokens(),
			CompletionTokens: completionTokens,
			TotalTokens:      info.GetEstimatePromptTokens() + completionTokens,
		}
		usageModified = true
	}

	applyUsagePostProcessing(info, &simpleResponse.Usage, responseBody)

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		if usageModified {
			var bodyMap map[string]interface{}
			err = common.Unmarshal(responseBody, &bodyMap)
			if err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			bodyMap["usage"] = simpleResponse.Usage
			responseBody, _ = common.Marshal(bodyMap)
		}
		if forceFormat {
			responseBody, err = common.Marshal(simpleResponse)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
			}
		} else {
			break
		}
	case types.RelayFormatClaude:
		claudeResp := service.ResponseOpenAI2Claude(&simpleResponse, info)
		claudeRespStr, err := common.Marshal(claudeResp)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = claudeRespStr
	case types.RelayFormatGemini:
		geminiResp := service.ResponseOpenAI2Gemini(&simpleResponse, info)
		geminiRespStr, err := common.Marshal(geminiResp)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = geminiRespStr
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &simpleResponse.Usage, nil
}

func streamTTSResponse(c *gin.Context, resp *http.Response) {
	c.Writer.WriteHeaderNow()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		logger.LogWarn(c, "streaming not supported")
		_, err := io.Copy(c.Writer, resp.Body)
		if err != nil {
			logger.LogWarn(c, err.Error())
		}
		return
	}

	buffer := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buffer)
		//logger.LogInfo(c, fmt.Sprintf("streamTTSResponse read %d bytes", n))
		if n > 0 {
			if _, writeErr := c.Writer.Write(buffer[:n]); writeErr != nil {
				logger.LogError(c, writeErr.Error())
				break
			}
			flusher.Flush()
		}
		if err != nil {
			if err != io.EOF {
				logger.LogError(c, err.Error())
			}
			break
		}
	}
}

func OpenaiRealtimeHandler(c *gin.Context, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.RealtimeUsage) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return types.NewError(fmt.Errorf("invalid websocket connection"), types.ErrorCodeBadResponse), nil
	}

	info.IsStream = true
	clientConn := info.ClientWs
	targetConn := info.TargetWs

	clientClosed := make(chan struct{})
	targetClosed := make(chan struct{})
	sendChan := make(chan []byte, 100)
	receiveChan := make(chan []byte, 100)
	errChan := make(chan error, 2)

	usage := &dto.RealtimeUsage{}
	localUsage := &dto.RealtimeUsage{}
	sumUsage := &dto.RealtimeUsage{}

	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				errChan <- fmt.Errorf("panic in client reader: %v", r)
			}
		}()
		for {
			select {
			case <-c.Done():
				return
			default:
				_, message, err := clientConn.ReadMessage()
				if err != nil {
					if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
						errChan <- fmt.Errorf("error reading from client: %v", err)
					}
					close(clientClosed)
					return
				}

				realtimeEvent := &dto.RealtimeEvent{}
				err = common.Unmarshal(message, realtimeEvent)
				if err != nil {
					errChan <- fmt.Errorf("error unmarshalling message: %v", err)
					return
				}

				if realtimeEvent.Type == dto.RealtimeEventTypeSessionUpdate {
					if realtimeEvent.Session != nil {
						if realtimeEvent.Session.Tools != nil {
							info.RealtimeTools = realtimeEvent.Session.Tools
						}
					}
				}

				textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
				if err != nil {
					errChan <- fmt.Errorf("error counting text token: %v", err)
					return
				}
				logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
				localUsage.TotalTokens += textToken + audioToken
				localUsage.InputTokens += textToken + audioToken
				localUsage.InputTokenDetails.TextTokens += textToken
				localUsage.InputTokenDetails.AudioTokens += audioToken

				err = helper.WssString(c, targetConn, string(message))
				if err != nil {
					errChan <- fmt.Errorf("error writing to target: %v", err)
					return
				}

				select {
				case sendChan <- message:
				default:
				}
			}
		}
	})

	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				errChan <- fmt.Errorf("panic in target reader: %v", r)
			}
		}()
		for {
			select {
			case <-c.Done():
				return
			default:
				_, message, err := targetConn.ReadMessage()
				if err != nil {
					if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
						errChan <- fmt.Errorf("error reading from target: %v", err)
					}
					close(targetClosed)
					return
				}
				info.SetFirstResponseTime()
				realtimeEvent := &dto.RealtimeEvent{}
				err = common.Unmarshal(message, realtimeEvent)
				if err != nil {
					errChan <- fmt.Errorf("error unmarshalling message: %v", err)
					return
				}

				if realtimeEvent.Type == dto.RealtimeEventTypeResponseDone {
					realtimeUsage := realtimeEvent.Response.Usage
					if realtimeUsage != nil {
						usage.TotalTokens += realtimeUsage.TotalTokens
						usage.InputTokens += realtimeUsage.InputTokens
						usage.OutputTokens += realtimeUsage.OutputTokens
						usage.InputTokenDetails.AudioTokens += realtimeUsage.InputTokenDetails.AudioTokens
						usage.InputTokenDetails.CachedTokens += realtimeUsage.InputTokenDetails.CachedTokens
						usage.InputTokenDetails.TextTokens += realtimeUsage.InputTokenDetails.TextTokens
						usage.OutputTokenDetails.AudioTokens += realtimeUsage.OutputTokenDetails.AudioTokens
						usage.OutputTokenDetails.TextTokens += realtimeUsage.OutputTokenDetails.TextTokens
						err := preConsumeUsage(c, info, usage, sumUsage)
						if err != nil {
							errChan <- fmt.Errorf("error consume usage: %v", err)
							return
						}
						// 本次计费完成，清除
						usage = &dto.RealtimeUsage{}

						localUsage = &dto.RealtimeUsage{}
					} else {
						textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
						if err != nil {
							errChan <- fmt.Errorf("error counting text token: %v", err)
							return
						}
						logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
						localUsage.TotalTokens += textToken + audioToken
						info.IsFirstRequest = false
						localUsage.InputTokens += textToken + audioToken
						localUsage.InputTokenDetails.TextTokens += textToken
						localUsage.InputTokenDetails.AudioTokens += audioToken
						err = preConsumeUsage(c, info, localUsage, sumUsage)
						if err != nil {
							errChan <- fmt.Errorf("error consume usage: %v", err)
							return
						}
						// 本次计费完成，清除
						localUsage = &dto.RealtimeUsage{}
						// print now usage
					}
					logger.LogInfo(c, fmt.Sprintf("realtime streaming sumUsage: %v", sumUsage))
					logger.LogInfo(c, fmt.Sprintf("realtime streaming localUsage: %v", localUsage))
					logger.LogInfo(c, fmt.Sprintf("realtime streaming localUsage: %v", localUsage))

				} else if realtimeEvent.Type == dto.RealtimeEventTypeSessionUpdated || realtimeEvent.Type == dto.RealtimeEventTypeSessionCreated {
					realtimeSession := realtimeEvent.Session
					if realtimeSession != nil {
						// update audio format
						info.InputAudioFormat = common.GetStringIfEmpty(realtimeSession.InputAudioFormat, info.InputAudioFormat)
						info.OutputAudioFormat = common.GetStringIfEmpty(realtimeSession.OutputAudioFormat, info.OutputAudioFormat)
					}
				} else {
					textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
					if err != nil {
						errChan <- fmt.Errorf("error counting text token: %v", err)
						return
					}
					logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
					localUsage.TotalTokens += textToken + audioToken
					localUsage.OutputTokens += textToken + audioToken
					localUsage.OutputTokenDetails.TextTokens += textToken
					localUsage.OutputTokenDetails.AudioTokens += audioToken
				}

				err = helper.WssString(c, clientConn, string(message))
				if err != nil {
					errChan <- fmt.Errorf("error writing to client: %v", err)
					return
				}

				select {
				case receiveChan <- message:
				default:
				}
			}
		}
	})

	select {
	case <-clientClosed:
	case <-targetClosed:
	case err := <-errChan:
		//return service.OpenAIErrorWrapper(err, "realtime_error", http.StatusInternalServerError), nil
		logger.LogError(c, "realtime error: "+err.Error())
	case <-c.Done():
	}

	if usage.TotalTokens != 0 {
		_ = preConsumeUsage(c, info, usage, sumUsage)
	}

	if localUsage.TotalTokens != 0 {
		_ = preConsumeUsage(c, info, localUsage, sumUsage)
	}

	// check usage total tokens, if 0, use local usage

	return nil, sumUsage
}

func preConsumeUsage(ctx *gin.Context, info *relaycommon.RelayInfo, usage *dto.RealtimeUsage, totalUsage *dto.RealtimeUsage) error {
	if usage == nil || totalUsage == nil {
		return fmt.Errorf("invalid usage pointer")
	}

	totalUsage.TotalTokens += usage.TotalTokens
	totalUsage.InputTokens += usage.InputTokens
	totalUsage.OutputTokens += usage.OutputTokens
	totalUsage.InputTokenDetails.CachedTokens += usage.InputTokenDetails.CachedTokens
	totalUsage.InputTokenDetails.TextTokens += usage.InputTokenDetails.TextTokens
	totalUsage.InputTokenDetails.AudioTokens += usage.InputTokenDetails.AudioTokens
	totalUsage.OutputTokenDetails.TextTokens += usage.OutputTokenDetails.TextTokens
	totalUsage.OutputTokenDetails.AudioTokens += usage.OutputTokenDetails.AudioTokens
	// clear usage
	err := service.PreWssConsumeQuota(ctx, info, usage)
	return err
}

func OpenaiHandlerWithUsage(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var usageResp dto.SimpleResponse
	err = common.Unmarshal(responseBody, &usageResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// Once we've written to the client, we should not return errors anymore
	// because the upstream has already consumed resources and returned content
	// We should still perform billing even if parsing fails
	// format
	if usageResp.InputTokens > 0 {
		usageResp.PromptTokens += usageResp.InputTokens
	}
	if usageResp.OutputTokens > 0 {
		usageResp.CompletionTokens += usageResp.OutputTokens
	}
	if usageResp.InputTokensDetails != nil {
		usageResp.PromptTokensDetails.ImageTokens += usageResp.InputTokensDetails.ImageTokens
		usageResp.PromptTokensDetails.TextTokens += usageResp.InputTokensDetails.TextTokens
	}
	applyUsagePostProcessing(info, &usageResp.Usage, responseBody)
	return &usageResp.Usage, nil
}

func applyUsagePostProcessing(info *relaycommon.RelayInfo, usage *dto.Usage, responseBody []byte) {
	if info == nil || usage == nil {
		return
	}

	switch info.ChannelType {
	case constant.ChannelTypeDeepSeek:
		if usage.PromptTokensDetails.CachedTokens == 0 && usage.PromptCacheHitTokens != 0 {
			usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
		}
	case constant.ChannelTypeZhipu_v4:
		// 智普的cached_tokens在标准位置: usage.prompt_tokens_details.cached_tokens
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if usage.InputTokensDetails != nil && usage.InputTokensDetails.CachedTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
			} else if cachedTokens, ok := extractCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if usage.PromptCacheHitTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
			}
		}
	case constant.ChannelTypeMoonshot:
		// Moonshot的cached_tokens在非标准位置: choices[].usage.cached_tokens
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if usage.InputTokensDetails != nil && usage.InputTokensDetails.CachedTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
			} else if cachedTokens, ok := extractMoonshotCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if cachedTokens, ok := extractCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if usage.PromptCacheHitTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
			}
		}
	case constant.ChannelTypeOpenAI:
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if cachedTokens, ok := extractLlamaCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			}
		}
	}
}

func extractCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Usage struct {
			PromptTokensDetails struct {
				CachedTokens *int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
			CachedTokens         *int `json:"cached_tokens"`
			PromptCacheHitTokens *int `json:"prompt_cache_hit_tokens"`
		} `json:"usage"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Usage.PromptTokensDetails.CachedTokens != nil {
		return *payload.Usage.PromptTokensDetails.CachedTokens, true
	}
	if payload.Usage.CachedTokens != nil {
		return *payload.Usage.CachedTokens, true
	}
	if payload.Usage.PromptCacheHitTokens != nil {
		return *payload.Usage.PromptCacheHitTokens, true
	}
	return 0, false
}

// extractMoonshotCachedTokensFromBody 从Moonshot的非标准位置提取cached_tokens
// Moonshot的流式响应格式: {"choices":[{"usage":{"cached_tokens":111}}]}
func extractMoonshotCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Choices []struct {
			Usage struct {
				CachedTokens *int `json:"cached_tokens"`
			} `json:"usage"`
		} `json:"choices"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	// 遍历choices查找cached_tokens
	for _, choice := range payload.Choices {
		if choice.Usage.CachedTokens != nil && *choice.Usage.CachedTokens > 0 {
			return *choice.Usage.CachedTokens, true
		}
	}

	return 0, false
}

// extractLlamaCachedTokensFromBody 从llama.cpp的非标准位置提取cache_n
func extractLlamaCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Timings struct {
			CachedTokens *int `json:"cache_n"`
		} `json:"timings"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Timings.CachedTokens == nil {
		return 0, false
	}
	return *payload.Timings.CachedTokens, true
}
