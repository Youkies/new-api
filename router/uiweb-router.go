package router

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// SetUIWebRouter redirects legacy /u/* paths to root equivalents.
func SetUIWebRouter(router *gin.Engine, uiwebFS embed.FS) {
	router.GET("/u/*filepath", func(c *gin.Context) {
		rel := strings.TrimPrefix(c.Param("filepath"), "/")
		target := "/" + rel
		c.Redirect(http.StatusMovedPermanently, target)
	})
}

// SetUIWebRootRouter serves uiweb (Clay Edition) as the root frontend at "/".
// API routes (/v1, /api, /dashboard) are unaffected since they are registered
// before this function is called.
func SetUIWebRootRouter(router *gin.Engine, uiwebFS embed.FS) {
	distFS, err := fs.Sub(uiwebFS, "uiweb/dist")
	if err != nil {
		common.SysLog("uiweb-root: fs.Sub failed: " + err.Error())
		return
	}
	indexBytes, err := fs.ReadFile(distFS, "index.html")
	if err != nil {
		common.SysLog("uiweb-root: dist/index.html missing — root routes disabled")
		return
	}

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.Use(static.Serve("/", common.EmbedFolder(uiwebFS, "uiweb/dist")))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "uiweb")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
	})
}
