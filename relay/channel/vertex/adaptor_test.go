package vertex

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestVertexGeminiRequestURLUsesStreamEndpointForForcedUpstreamStream(t *testing.T) {
	info := &relaycommon.RelayInfo{
		UpstreamForceStream: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiVersion:        "us-central1",
			ApiKey:            "test-key",
			UpstreamModelName: "gemini-2.5-flash",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}
	adaptor := &Adaptor{RequestMode: RequestModeGemini}

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Contains(t, requestURL, ":streamGenerateContent?alt=sse")
}
