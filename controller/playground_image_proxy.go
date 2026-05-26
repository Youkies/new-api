package controller

import (
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const (
	maxProxyImageBytes = 8 * 1024 * 1024 // 8MB upper bound (per fetch)
	proxyImageTimeout  = 30 * time.Second
)

// ProxyPlaygroundImage downloads a remote image URL on behalf of the logged-in
// user and streams the bytes back. Lets the playground UI store images in
// IndexedDB without hitting CORS on every upstream provider.
//
// Security:
//   - http/https only
//   - reject literal IPs that point at internal/loopback/link-local space
//   - cap response size at maxProxyImageBytes
//   - require image/* response Content-Type
func ProxyPlaygroundImage(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("url"))
	if raw == "" {
		common.ApiErrorMsg(c, "missing url")
		return
	}
	u, err := url.Parse(raw)
	if err != nil {
		common.ApiErrorMsg(c, "invalid url")
		return
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		common.ApiErrorMsg(c, "unsupported scheme")
		return
	}
	host := u.Hostname()
	if host == "" {
		common.ApiErrorMsg(c, "invalid host")
		return
	}
	if ip := net.ParseIP(host); ip != nil && !isPublicUnicastIP(ip) {
		common.ApiErrorMsg(c, "forbidden host")
		return
	}

	client := &http.Client{
		Timeout: proxyImageTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			h := req.URL.Hostname()
			if ip := net.ParseIP(h); ip != nil && !isPublicUnicastIP(ip) {
				return errors.New("redirect to forbidden host")
			}
			return nil
		},
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, raw, nil)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	resp, err := client.Do(req)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		c.AbortWithStatus(http.StatusBadGateway)
		return
	}
	ct := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if !strings.HasPrefix(ct, "image/") {
		common.ApiErrorMsg(c, "upstream is not image")
		return
	}
	bs, err := io.ReadAll(io.LimitReader(resp.Body, maxProxyImageBytes+1))
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if len(bs) > maxProxyImageBytes {
		common.ApiErrorMsg(c, "image too large")
		return
	}
	c.Header("Cache-Control", "private, max-age=300")
	c.Header("Content-Type", ct)
	c.Header("Content-Length", strconv.Itoa(len(bs)))
	_, _ = c.Writer.Write(bs)
}

func isPublicUnicastIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsPrivate() {
		return false
	}
	// extra checks: 169.254/16 already covered by IsLinkLocalUnicast for IPv4;
	// IsPrivate covers RFC1918 + RFC4193. nothing else to block.
	return true
}
