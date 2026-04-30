package claude

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestClaudeStreamToNonStreamHandlerAggregatesOpenAIResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	body := strings.Join([]string{
		`data: {"type":"message_start","message":{"id":"msg-test","type":"message","role":"assistant","model":"claude-test","usage":{"input_tokens":4,"output_tokens":0}}}`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello "}}`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":4,"output_tokens":2}}`,
		`data: {"type":"message_stop"}`,
		`data: [DONE]`,
		"",
	}, "\n")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header: http.Header{
			"Content-Type": []string{"text/event-stream"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeChatCompletions,
		RelayFormat:         types.RelayFormatOpenAI,
		UpstreamForceStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeAnthropic,
			UpstreamModelName: "claude-test",
		},
	}

	usage, err := ClaudeStreamToNonStreamHandler(c, resp, info)
	require.Nil(t, err)
	require.Equal(t, 4, usage.PromptTokens)
	require.Equal(t, 2, usage.CompletionTokens)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
	require.NotContains(t, recorder.Body.String(), "data:")

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "msg-test", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "hello world", parsed.Choices[0].Message.StringContent())
	require.Equal(t, constant.FinishReasonStop, parsed.Choices[0].FinishReason)
	require.Equal(t, 4, parsed.Usage.PromptTokens)
	require.Equal(t, 2, parsed.Usage.CompletionTokens)
}
