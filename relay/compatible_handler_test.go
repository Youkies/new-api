package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestShouldForceUpstreamStreamForNonStreamAllowsPassThrough(t *testing.T) {
	stream := false
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
			ChannelSetting: dto.ChannelSettings{
				NonStreamToStreamEnabled: true,
				PassThroughBodyEnabled:   true,
			},
		},
	}
	request := &dto.GeneralOpenAIRequest{
		Stream: &stream,
	}

	require.True(t, shouldForceUpstreamStreamForNonStream(info, request))
}

func TestForceUpstreamStreamRequestBody(t *testing.T) {
	oldForceStreamOption := constant.ForceStreamOption
	constant.ForceStreamOption = true
	defer func() {
		constant.ForceStreamOption = oldForceStreamOption
	}()

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			SupportStreamOptions: true,
		},
	}

	body, err := forceUpstreamStreamRequestBody([]byte(`{"model":"gpt-test","stream":false,"messages":[]}`), info)
	require.NoError(t, err)
	require.True(t, gjson.GetBytes(body, "stream").Bool())
	require.True(t, gjson.GetBytes(body, "stream_options.include_usage").Bool())
	require.Equal(t, "gpt-test", gjson.GetBytes(body, "model").String())
}
