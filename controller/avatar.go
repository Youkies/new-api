package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const maxAvatarSize = 200 * 1024 // 200KB

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

func UploadAvatar(c *gin.Context) {
	id := c.GetInt("id")

	file, header, err := c.Request.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "missing avatar file"})
		return
	}
	defer file.Close()

	if header.Size > maxAvatarSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("avatar exceeds %dKB limit", maxAvatarSize/1024),
		})
		return
	}

	ct := header.Header.Get("Content-Type")
	if !allowedImageTypes[ct] {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "unsupported image type, allowed: jpeg/png/webp/gif",
		})
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to read file"})
		return
	}

	if len(data) > maxAvatarSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("avatar exceeds %dKB limit", maxAvatarSize/1024),
		})
		return
	}

	if err := model.UpdateUserAvatar(id, data, ct); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to save avatar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    fmt.Sprintf("/api/user/avatar/%d?t=%d", id, time.Now().Unix()),
	})
}

func GetAvatar(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		c.Status(http.StatusNotFound)
		return
	}

	data, ct, err := model.GetUserAvatar(id)
	if err != nil || len(data) == 0 {
		c.Status(http.StatusNotFound)
		return
	}

	if ct == "" {
		ct = "image/jpeg"
	}

	etag := fmt.Sprintf(`"%d-%d"`, id, len(data))
	if match := c.GetHeader("If-None-Match"); match != "" && strings.Contains(match, etag) {
		c.Status(http.StatusNotModified)
		return
	}

	c.Header("Cache-Control", "public, max-age=86400")
	c.Header("ETag", etag)
	c.Data(http.StatusOK, ct, data)
}

func DeleteAvatar(c *gin.Context) {
	id := c.GetInt("id")

	if err := model.DeleteUserAvatar(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to delete avatar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
