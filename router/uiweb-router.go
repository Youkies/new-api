package router

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// SetUIWebRouter mounts the Clay Edition frontend (uiweb/dist) under /u/*.
// Coexists with SetWebRouter which serves the original web/dist at root.
// Must be registered before SetWebRouter so its concrete route wins over the
// engine-wide static.Serve("/") middleware.
func SetUIWebRouter(router *gin.Engine, uiwebFS embed.FS) {
	distFS, err := fs.Sub(uiwebFS, "uiweb/dist")
	if err != nil {
		common.SysLog("uiweb: fs.Sub failed: " + err.Error())
		return
	}
	indexBytes, err := fs.ReadFile(distFS, "index.html")
	if err != nil {
		common.SysLog("uiweb: dist/index.html missing — /u routes disabled (run `cd uiweb && npm run build`)")
		return
	}

	serve := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "uiweb")
		rel := strings.TrimPrefix(c.Param("filepath"), "/")

		if rel == "" {
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
			return
		}

		f, err := distFS.Open(rel)
		if err == nil {
			defer f.Close()
			if stat, serr := f.Stat(); serr == nil && !stat.IsDir() {
				if rs, ok := f.(io.ReadSeeker); ok {
					http.ServeContent(c.Writer, c.Request, rel, stat.ModTime(), rs)
					return
				}
			}
		}

		// Obvious asset miss → 404, do not mask with index.html
		if strings.HasPrefix(rel, "assets/") ||
			strings.HasSuffix(rel, ".js") ||
			strings.HasSuffix(rel, ".css") ||
			strings.HasSuffix(rel, ".map") ||
			strings.HasSuffix(rel, ".png") ||
			strings.HasSuffix(rel, ".svg") ||
			strings.HasSuffix(rel, ".ico") ||
			strings.HasSuffix(rel, ".woff") ||
			strings.HasSuffix(rel, ".woff2") {
			c.Status(http.StatusNotFound)
			return
		}

		// SPA fallback: any non-asset path serves index.html
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexBytes)
	}

	gz := gzip.Gzip(gzip.DefaultCompression)
	router.GET("/u/*filepath", gz, serve)
}
