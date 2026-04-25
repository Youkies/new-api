package router

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

func SetWebRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	distFS, err := fs.Sub(buildFS, "web/dist")
	if err != nil {
		return
	}

	serve := func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		rel := strings.TrimPrefix(c.Param("filepath"), "/")

		if rel == "" {
			c.Header("Cache-Control", "no-cache")
			c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
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

		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
	}

	gz := gzip.Gzip(gzip.DefaultCompression)
	router.GET("/legacy", gz, func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/legacy/")
	})
	router.GET("/legacy/*filepath", gz, serve)
}
