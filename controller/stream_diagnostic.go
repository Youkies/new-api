package controller

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	defaultStreamDiagSeconds    = 900
	defaultStreamDiagInterval   = 5
	defaultStreamDiagMaxSeconds = 3600
)

func streamDiagEnabled() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("STREAM_DIAG_ENABLED")), "true")
}

func streamDiagIntFromEnv(name string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func streamDiagIntFromQuery(c *gin.Context, name string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(c.Query(name)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func streamDiagTokenMatches(c *gin.Context, expected string) bool {
	provided := strings.TrimSpace(c.Query("token"))
	if provided == "" {
		provided = strings.TrimSpace(c.GetHeader("X-Stream-Diag-Token"))
	}
	if provided == "" || expected == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func StreamDiagnosticLongStream(c *gin.Context) {
	if !streamDiagEnabled() {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	token := strings.TrimSpace(os.Getenv("STREAM_DIAG_TOKEN"))
	if !streamDiagTokenMatches(c, token) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming is not supported"})
		return
	}

	maxSeconds := streamDiagIntFromEnv("STREAM_DIAG_MAX_SECONDS", defaultStreamDiagMaxSeconds)
	seconds := streamDiagIntFromQuery(c, "seconds", defaultStreamDiagSeconds)
	if seconds > maxSeconds {
		seconds = maxSeconds
	}

	intervalSeconds := streamDiagIntFromQuery(c, "interval", defaultStreamDiagInterval)
	if intervalSeconds > 60 {
		intervalSeconds = 60
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")

	start := time.Now()
	writeDiagEvent := func(event string, elapsed int) bool {
		_, err := fmt.Fprintf(
			c.Writer,
			"event: %s\ndata: elapsed=%d server_time=%s\n\n",
			event,
			elapsed,
			time.Now().Format(time.RFC3339),
		)
		if err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	if !writeDiagEvent("start", 0) {
		return
	}

	ticker := time.NewTicker(time.Duration(intervalSeconds) * time.Second)
	defer ticker.Stop()

	deadline := time.NewTimer(time.Duration(seconds) * time.Second)
	defer deadline.Stop()

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-deadline.C:
			writeDiagEvent("done", int(time.Since(start).Seconds()))
			return
		case <-ticker.C:
			if !writeDiagEvent("ping", int(time.Since(start).Seconds())) {
				return
			}
		}
	}
}
