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

// WebAssets holds all embedded frontend assets. Clay/uiweb is the primary UI;
// the official default and classic frontends are exposed on secondary paths.
type WebAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
	UIWebFS          embed.FS
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	defaultFS, defaultErr := fs.Sub(assets.DefaultBuildFS, "web/default/dist")
	if defaultErr != nil {
		common.SysLog("official default frontend disabled: " + defaultErr.Error())
	}
	classicFS, classicErr := fs.Sub(assets.ClassicBuildFS, "web/classic/dist")
	if classicErr != nil {
		common.SysLog("official classic frontend disabled: " + classicErr.Error())
	}

	webMiddlewares := []gin.HandlerFunc{
		gzip.Gzip(gzip.DefaultCompression),
		middleware.GlobalWebRateLimit(),
		middleware.Cache(),
	}

	router.GET("/default", append(webMiddlewares, redirectTo("/default/"))...)
	if defaultErr == nil {
		router.GET("/default/*filepath", append(webMiddlewares, serveEmbeddedSPA(defaultFS, assets.DefaultIndexPage, "web-default"))...)
	}

	router.GET("/legacy", append(webMiddlewares, redirectTo("/legacy/"))...)
	router.GET("/classic", append(webMiddlewares, redirectTo("/legacy/"))...)
	router.GET("/classic/*filepath", append(webMiddlewares, redirectPrefix("/classic", "/legacy"))...)
	if classicErr == nil {
		router.GET("/legacy/*filepath", append(webMiddlewares, serveEmbeddedSPA(classicFS, assets.ClassicIndexPage, "web-classic"))...)
	}
}

func redirectTo(target string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, target)
	}
}

func redirectPrefix(fromPrefix, toPrefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		target := toPrefix + strings.TrimPrefix(c.Request.URL.Path, fromPrefix)
		if c.Request.URL.RawQuery != "" {
			target += "?" + c.Request.URL.RawQuery
		}
		c.Redirect(http.StatusMovedPermanently, target)
	}
}

func serveEmbeddedSPA(distFS fs.FS, indexPage []byte, routeTag string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, routeTag)
		rel := strings.TrimPrefix(c.Param("filepath"), "/")
		if rel == "" {
			serveIndex(c, indexPage)
			return
		}

		if serveEmbeddedFile(c, distFS, rel) {
			return
		}
		if isStaticAssetPath(rel) {
			c.Status(http.StatusNotFound)
			return
		}
		serveIndex(c, indexPage)
	}
}

func serveEmbeddedFile(c *gin.Context, distFS fs.FS, rel string) bool {
	f, err := distFS.Open(rel)
	if err != nil {
		return false
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil || stat.IsDir() {
		return false
	}
	rs, ok := f.(io.ReadSeeker)
	if !ok {
		return false
	}
	http.ServeContent(c.Writer, c.Request, rel, stat.ModTime(), rs)
	return true
}

func serveIndex(c *gin.Context, indexPage []byte) {
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
}

func isStaticAssetPath(rel string) bool {
	if strings.HasPrefix(rel, "assets/") || strings.HasPrefix(rel, "static/") {
		return true
	}
	for _, suffix := range []string{
		".js",
		".css",
		".map",
		".png",
		".jpg",
		".jpeg",
		".webp",
		".svg",
		".ico",
		".json",
		".txt",
		".woff",
		".woff2",
	} {
		if strings.HasSuffix(rel, suffix) {
			return true
		}
	}
	return false
}
