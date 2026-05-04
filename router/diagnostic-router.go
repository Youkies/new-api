package router

import (
	"github.com/QuantumNous/new-api/controller"

	"github.com/gin-gonic/gin"
)

func SetDiagnosticRouter(router *gin.Engine) {
	router.GET("/api/debug/long-stream", controller.StreamDiagnosticLongStream)
}
