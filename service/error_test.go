package service

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestResetStatusCode(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name             string
		statusCode       int
		statusCodeConfig string
		expectedCode     int
	}{
		{
			name:             "map string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"503"}`,
			expectedCode:     503,
		},
		{
			name:             "map int value",
			statusCode:       429,
			statusCodeConfig: `{"429":503}`,
			expectedCode:     503,
		},
		{
			name:             "skip invalid string value",
			statusCode:       429,
			statusCodeConfig: `{"429":"bad-code"}`,
			expectedCode:     429,
		},
		{
			name:             "skip status code 200",
			statusCode:       200,
			statusCodeConfig: `{"200":503}`,
			expectedCode:     200,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			newAPIError := &types.NewAPIError{
				StatusCode: tc.statusCode,
			}
			ResetStatusCode(newAPIError, tc.statusCodeConfig)
			require.Equal(t, tc.expectedCode, newAPIError.StatusCode)
		})
	}
}

func TestNormalizeClientCanceledErrorMarksAsClientClosed(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	newAPIError := types.NewOpenAIError(context.Canceled, types.ErrorCodeBadResponse, http.StatusInternalServerError)
	normalized := NormalizeClientCanceledError(ctx, newAPIError)

	require.Equal(t, StatusClientClosedRequest, normalized.StatusCode)
	require.True(t, types.IsSkipRetryError(normalized))
	require.False(t, types.IsRecordErrorLog(normalized))
}

func TestNormalizeClientCanceledErrorLeavesUpstreamErrorAlone(t *testing.T) {
	t.Parallel()

	newAPIError := types.NewOpenAIError(errors.New("upstream exploded"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	normalized := NormalizeClientCanceledError(context.Background(), newAPIError)

	require.Equal(t, http.StatusInternalServerError, normalized.StatusCode)
	require.False(t, types.IsSkipRetryError(normalized))
	require.True(t, types.IsRecordErrorLog(normalized))
}
