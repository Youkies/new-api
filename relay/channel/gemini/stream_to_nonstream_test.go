package gemini

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

func TestGeminiChatStreamToNonStreamHandlerAggregatesOpenAIResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() {
		constant.StreamingTimeout = oldStreamingTimeout
	})

	body := strings.Join([]string{
		`data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"hello "}]}}]}`,
		`data: {"candidates":[{"index":0,"content":{"role":"model","parts":[{"text":"world"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":3,"candidatesTokenCount":2,"totalTokenCount":5}}`,
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
			ChannelType:       constant.ChannelTypeGemini,
			UpstreamModelName: "gemini-test",
		},
	}

	usage, err := GeminiChatStreamToNonStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.Equal(t, 3, usage.PromptTokens)
	require.Equal(t, 2, usage.CompletionTokens)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
	require.NotContains(t, recorder.Body.String(), "data:")

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "chat.completion", parsed.Object)
	require.Equal(t, "gemini-test", parsed.Model)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "hello world", parsed.Choices[0].Message.StringContent())
	require.Equal(t, constant.FinishReasonStop, parsed.Choices[0].FinishReason)
	require.Equal(t, 3, parsed.Usage.PromptTokens)
	require.Equal(t, 2, parsed.Usage.CompletionTokens)
}

func TestGeminiRequestURLUsesStreamEndpointForForcedUpstreamStream(t *testing.T) {
	info := &relaycommon.RelayInfo{
		UpstreamForceStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://generativelanguage.googleapis.com",
			UpstreamModelName: "gemini-test",
		},
	}

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	require.Contains(t, requestURL, ":streamGenerateContent?alt=sse")
}
