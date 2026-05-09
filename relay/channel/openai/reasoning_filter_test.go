package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func stringPtr(value string) *string {
	return &value
}

func TestApplyReasoningOutputPolicyToTextResponseStripsNativeReasoningOnly(t *testing.T) {
	reasoning := "native reasoning"
	response := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message: dto.Message{
					Role:             "assistant",
					Content:          "<think>preset</think>visible",
					ReasoningContent: &reasoning,
				},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{StripNativeReasoning: true},
		},
	}

	modified := applyReasoningOutputPolicyToTextResponse(info, response)

	if !modified {
		t.Fatal("expected response to be modified")
	}
	if response.Choices[0].Message.ReasoningContent != nil {
		t.Fatal("expected reasoning_content to be stripped")
	}
	if got := response.Choices[0].Message.Content; got != "<think>preset</think>visible" {
		t.Fatalf("expected content think tags to be preserved, got %v", got)
	}
}

func TestApplyReasoningOutputPolicyToTextResponseStripsContentThinkTags(t *testing.T) {
	response := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message: dto.Message{
					Role:    "assistant",
					Content: "before <think>hidden</think> after",
				},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{StripContentThinkTags: true},
		},
	}

	modified := applyReasoningOutputPolicyToTextResponse(info, response)

	if !modified {
		t.Fatal("expected response to be modified")
	}
	if got := response.Choices[0].Message.Content; got != "before  after" {
		t.Fatalf("unexpected cleaned content: %v", got)
	}
}

func TestStripContentThinkTagsFromStreamResponseHandlesSplitTags(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{StripContentThinkTags: true},
		},
	}

	chunks := []dto.ChatCompletionsStreamResponse{
		{Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: stringPtr("hello <thi")}}}},
		{Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: stringPtr("nk>hidden</thi")}}}},
		{Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: stringPtr("nk>world")}}}},
		{Choices: []dto.ChatCompletionsStreamResponseChoice{{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{}, FinishReason: stringPtr("stop")}}},
	}

	for i := range chunks {
		stripContentThinkTagsFromStreamResponse(info, &chunks[i])
	}

	if got := chunks[0].Choices[0].Delta.GetContentString(); got != "hello " {
		t.Fatalf("unexpected first chunk: %q", got)
	}
	if chunks[1].Choices[0].Delta.Content != nil {
		t.Fatalf("expected second chunk content to be stripped, got %q", chunks[1].Choices[0].Delta.GetContentString())
	}
	if got := chunks[2].Choices[0].Delta.GetContentString(); got != "world" {
		t.Fatalf("unexpected third chunk: %q", got)
	}
	if got := chunks[3].Choices[0].Delta.GetContentString(); got != "" {
		t.Fatalf("unexpected finish chunk flush: %q", got)
	}
}

func TestStripNativeReasoningFromStreamResponse(t *testing.T) {
	response := &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Index: 0,
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content:          stringPtr("visible"),
					ReasoningContent: stringPtr("native"),
				},
			},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{StripNativeReasoning: true},
		},
	}

	modified := stripNativeReasoningFromStreamResponse(info, response)

	if !modified {
		t.Fatal("expected response to be modified")
	}
	if response.Choices[0].Delta.ReasoningContent != nil {
		t.Fatal("expected reasoning_content to be stripped")
	}
	if got := response.Choices[0].Delta.GetContentString(); got != "visible" {
		t.Fatalf("expected visible content to remain, got %q", got)
	}
}
