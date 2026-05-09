package openai

import (
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

const (
	openThinkTag  = "<think>"
	closeThinkTag = "</think>"
)

func reasoningOutputPolicyEnabled(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	return info.ChannelSetting.StripNativeReasoning || info.ChannelSetting.StripContentThinkTags
}

func stripNativeReasoningFromStreamResponse(info *relaycommon.RelayInfo, response *dto.ChatCompletionsStreamResponse) bool {
	if info == nil || info.ChannelMeta == nil || response == nil || !info.ChannelSetting.StripNativeReasoning {
		return false
	}

	modified := false
	for i := range response.Choices {
		delta := &response.Choices[i].Delta
		if delta.ReasoningContent != nil || delta.Reasoning != nil {
			modified = true
		}
		delta.ReasoningContent = nil
		delta.Reasoning = nil
	}
	return modified
}

func stripContentThinkTagsFromStreamResponse(info *relaycommon.RelayInfo, response *dto.ChatCompletionsStreamResponse) bool {
	if info == nil || info.ChannelMeta == nil || response == nil || !info.ChannelSetting.StripContentThinkTags {
		return false
	}

	modified := false
	for i := range response.Choices {
		choice := &response.Choices[i]
		if choice.Delta.Content != nil {
			original := *choice.Delta.Content
			cleaned := stripThinkTagsFromStreamContent(info, choice.Index, original)
			if cleaned != original {
				modified = true
			}
			if cleaned == "" {
				choice.Delta.Content = nil
			} else {
				choice.Delta.SetContentString(cleaned)
			}
		}

		if choice.FinishReason != nil {
			if pending := flushThinkTagFilterState(info, choice.Index); pending != "" {
				appendDeltaContent(&choice.Delta, pending)
				modified = true
			}
		}
	}
	return modified
}

func ApplyReasoningOutputPolicyToStreamResponse(info *relaycommon.RelayInfo, response *dto.ChatCompletionsStreamResponse) bool {
	nativeModified := stripNativeReasoningFromStreamResponse(info, response)
	contentModified := stripContentThinkTagsFromStreamResponse(info, response)
	return nativeModified || contentModified
}

func ApplyReasoningOutputPolicyToTextResponse(info *relaycommon.RelayInfo, response *dto.OpenAITextResponse) bool {
	return applyReasoningOutputPolicyToTextResponse(info, response)
}

func applyReasoningOutputPolicyToTextResponse(info *relaycommon.RelayInfo, response *dto.OpenAITextResponse) bool {
	if info == nil || response == nil || !reasoningOutputPolicyEnabled(info) {
		return false
	}

	modified := false
	for i := range response.Choices {
		message := &response.Choices[i].Message
		if info.ChannelSetting.StripNativeReasoning {
			if message.ReasoningContent != nil || message.Reasoning != nil {
				modified = true
			}
			message.ReasoningContent = nil
			message.Reasoning = nil
		}

		if info.ChannelSetting.StripContentThinkTags {
			cleaned, changed := stripThinkTagsFromMessageContent(message.Content)
			if changed {
				message.Content = cleaned
				modified = true
			}
		}
	}
	return modified
}

func applyReasoningOutputPolicyToOpenAIBodyMap(info *relaycommon.RelayInfo, bodyMap map[string]interface{}) bool {
	if info == nil || info.ChannelMeta == nil || bodyMap == nil || !reasoningOutputPolicyEnabled(info) {
		return false
	}

	choices, ok := bodyMap["choices"].([]interface{})
	if !ok {
		return false
	}

	modified := false
	for _, choiceAny := range choices {
		choice, ok := choiceAny.(map[string]interface{})
		if !ok {
			continue
		}
		message, ok := choice["message"].(map[string]interface{})
		if !ok {
			continue
		}
		if info.ChannelSetting.StripNativeReasoning {
			if _, ok := message["reasoning_content"]; ok {
				delete(message, "reasoning_content")
				modified = true
			}
			if _, ok := message["reasoning"]; ok {
				delete(message, "reasoning")
				modified = true
			}
		}
		if info.ChannelSetting.StripContentThinkTags {
			cleaned, changed := stripThinkTagsFromMessageContent(message["content"])
			if changed {
				message["content"] = cleaned
				modified = true
			}
		}
	}
	return modified
}

func appendDeltaContent(delta *dto.ChatCompletionsStreamResponseChoiceDelta, content string) {
	if content == "" {
		return
	}
	if delta.Content == nil {
		delta.SetContentString(content)
		return
	}
	merged := *delta.Content + content
	delta.SetContentString(merged)
}

func stripThinkTagsFromMessageContent(content any) (any, bool) {
	switch value := content.(type) {
	case string:
		cleaned := stripThinkTagsFromCompleteText(value)
		return cleaned, cleaned != value
	case []any:
		cleanedItems := make([]any, len(value))
		modified := false
		for i, item := range value {
			cleanedItem, changed := stripThinkTagsFromContentItem(item)
			cleanedItems[i] = cleanedItem
			modified = modified || changed
		}
		return cleanedItems, modified
	case []dto.MediaContent:
		cleanedItems := make([]dto.MediaContent, len(value))
		modified := false
		for i, item := range value {
			cleanedItems[i] = item
			if item.Type == dto.ContentTypeText {
				cleaned := stripThinkTagsFromCompleteText(item.Text)
				if cleaned != item.Text {
					cleanedItems[i].Text = cleaned
					modified = true
				}
			}
		}
		return cleanedItems, modified
	default:
		return content, false
	}
}

func stripThinkTagsFromContentItem(item any) (any, bool) {
	switch value := item.(type) {
	case map[string]any:
		if value["type"] != dto.ContentTypeText {
			return item, false
		}
		text, ok := value["text"].(string)
		if !ok {
			return item, false
		}
		cleaned := stripThinkTagsFromCompleteText(text)
		if cleaned == text {
			return item, false
		}
		copied := make(map[string]any, len(value))
		for k, v := range value {
			copied[k] = v
		}
		copied["text"] = cleaned
		return copied, true
	case dto.MediaContent:
		if value.Type != dto.ContentTypeText {
			return item, false
		}
		cleaned := stripThinkTagsFromCompleteText(value.Text)
		if cleaned == value.Text {
			return item, false
		}
		value.Text = cleaned
		return value, true
	default:
		return item, false
	}
}

func stripThinkTagsFromCompleteText(content string) string {
	state := &relaycommon.ThinkTagFilterState{}
	cleaned := stripThinkTagsChunk(state, content)
	if state.InThink {
		return cleaned
	}
	return cleaned + state.Pending
}

func stripThinkTagsFromStreamContent(info *relaycommon.RelayInfo, index int, content string) string {
	state := getThinkTagFilterState(info, index)
	return stripThinkTagsChunk(state, content)
}

func getThinkTagFilterState(info *relaycommon.RelayInfo, index int) *relaycommon.ThinkTagFilterState {
	if info.ContentThinkTagStates == nil {
		info.ContentThinkTagStates = make(map[int]*relaycommon.ThinkTagFilterState)
	}
	state := info.ContentThinkTagStates[index]
	if state == nil {
		state = &relaycommon.ThinkTagFilterState{}
		info.ContentThinkTagStates[index] = state
	}
	return state
}

func flushThinkTagFilterState(info *relaycommon.RelayInfo, index int) string {
	if info == nil || info.ContentThinkTagStates == nil {
		return ""
	}
	state := info.ContentThinkTagStates[index]
	if state == nil {
		return ""
	}
	defer delete(info.ContentThinkTagStates, index)
	if state.InThink {
		return ""
	}
	return state.Pending
}

func stripThinkTagsChunk(state *relaycommon.ThinkTagFilterState, chunk string) string {
	if state == nil || chunk == "" && state.Pending == "" {
		return ""
	}

	data := state.Pending + chunk
	state.Pending = ""

	var output strings.Builder
	for len(data) > 0 {
		lower := strings.ToLower(data)
		if state.InThink {
			closeIndex := strings.Index(lower, closeThinkTag)
			if closeIndex < 0 {
				if tailLen := partialTagSuffixLen(data, closeThinkTag); tailLen > 0 {
					state.Pending = data[len(data)-tailLen:]
				}
				return output.String()
			}
			data = data[closeIndex+len(closeThinkTag):]
			state.InThink = false
			continue
		}

		openIndex := strings.Index(lower, openThinkTag)
		if openIndex < 0 {
			if tailLen := partialTagSuffixLen(data, openThinkTag); tailLen > 0 {
				output.WriteString(data[:len(data)-tailLen])
				state.Pending = data[len(data)-tailLen:]
				return output.String()
			}
			output.WriteString(data)
			return output.String()
		}

		output.WriteString(data[:openIndex])
		data = data[openIndex+len(openThinkTag):]
		state.InThink = true
	}

	return output.String()
}

func partialTagSuffixLen(content string, tag string) int {
	maxLen := len(tag) - 1
	if len(content) < maxLen {
		maxLen = len(content)
	}
	for i := maxLen; i > 0; i-- {
		if strings.EqualFold(content[len(content)-i:], tag[:i]) {
			return i
		}
	}
	return 0
}
