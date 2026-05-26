package controller

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	maxPlaygroundImageBytes  = 4 * 1024 * 1024 // 4MB hard cap per stored image
	playgroundImageURLPrefix = "/api/ui/playground/images"
)

type playgroundImageSavePayload struct {
	Prompt    string `json:"prompt"`
	Model     string `json:"model"`
	GroupName string `json:"group_name"`
	Size      string `json:"size"`
	Quality   string `json:"quality"`
	Style     string `json:"style"`
	// Either b64_json (preferred) or url.
	B64Json   string `json:"b64_json"`
	URL       string `json:"url"`
	ImageType string `json:"image_type"`
	Extra     string `json:"extra"`
}

func ListUIPlaygroundImages(c *gin.Context) {
	userId := c.GetInt("id")
	limit, _ := strconv.Atoi(c.Query("limit"))
	imgs, err := model.ListPlaygroundImages(userId, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	views := make([]*model.PlaygroundImageView, 0, len(imgs))
	for _, img := range imgs {
		if v := img.ToView(playgroundImageURLPrefix); v != nil {
			views = append(views, v)
		}
	}
	common.ApiSuccess(c, gin.H{"items": views})
}

func CreateUIPlaygroundImage(c *gin.Context) {
	var payload playgroundImageSavePayload
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	payload.Prompt = strings.TrimSpace(payload.Prompt)
	if payload.Prompt == "" {
		common.ApiErrorMsg(c, "prompt 不能为空")
		return
	}
	if len([]rune(payload.Prompt)) > 4000 {
		payload.Prompt = string([]rune(payload.Prompt)[:4000])
	}

	bytesData, mime, err := decodePlaygroundImagePayload(payload.B64Json, payload.URL, payload.ImageType)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(bytesData) > maxPlaygroundImageBytes {
		common.ApiErrorMsg(c, "图片体积超过限制")
		return
	}

	width, height := 0, 0
	if cfg, _, decErr := image.DecodeConfig(bytes.NewReader(bytesData)); decErr == nil {
		width, height = cfg.Width, cfg.Height
	}

	userId := c.GetInt("id")
	rec := &model.PlaygroundImage{
		UserId:    userId,
		Prompt:    payload.Prompt,
		Model:     strings.TrimSpace(payload.Model),
		GroupName: strings.TrimSpace(payload.GroupName),
		Size:      strings.TrimSpace(payload.Size),
		Quality:   strings.TrimSpace(payload.Quality),
		Style:     strings.TrimSpace(payload.Style),
		Image:     bytesData,
		ImageType: mime,
		Width:     width,
		Height:    height,
		Extra:     payload.Extra,
	}
	if err := model.CreatePlaygroundImage(rec); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rec.ToView(playgroundImageURLPrefix))
}

func GetUIPlaygroundImage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid image id")
		return
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		// <img> tag cannot send custom New-Api-User header — fall back to session-only auth.
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	img, err := model.GetPlaygroundImageBinary(id, userId)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	mime := img.ImageType
	if mime == "" {
		mime = "image/png"
	}
	c.Header("Cache-Control", "private, max-age=86400")
	c.Header("Content-Type", mime)
	c.Header("Content-Length", strconv.Itoa(len(img.Image)))
	_, _ = c.Writer.Write(img.Image)
}

func DeleteUIPlaygroundImage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid image id")
		return
	}
	userId := c.GetInt("id")
	if err := model.DeletePlaygroundImage(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func decodePlaygroundImagePayload(b64 string, url string, mimeHint string) ([]byte, string, error) {
	b64 = strings.TrimSpace(b64)
	url = strings.TrimSpace(url)
	mime := strings.TrimSpace(mimeHint)
	if mime == "" {
		mime = "image/png"
	}

	if b64 != "" {
		// Strip data URL prefix if any
		if i := strings.Index(b64, ","); i >= 0 && strings.HasPrefix(b64, "data:") {
			head := b64[:i]
			b64 = b64[i+1:]
			if j := strings.Index(head, ";"); j >= 0 {
				detected := strings.TrimPrefix(head[:j], "data:")
				if strings.HasPrefix(detected, "image/") {
					mime = detected
				}
			}
		}
		bs, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil, "", err
		}
		return bs, mime, nil
	}

	if url != "" {
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			return nil, "", errors.New("invalid image url")
		}
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(url)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode/100 != 2 {
			return nil, "", errors.New("upstream image fetch failed: " + resp.Status)
		}
		ct := strings.TrimSpace(resp.Header.Get("Content-Type"))
		if strings.HasPrefix(ct, "image/") {
			mime = ct
		}
		bs, err := io.ReadAll(io.LimitReader(resp.Body, maxPlaygroundImageBytes+1))
		if err != nil {
			return nil, "", err
		}
		if len(bs) > maxPlaygroundImageBytes {
			return nil, "", errors.New("image too large")
		}
		return bs, mime, nil
	}

	return nil, "", errors.New("either b64_json or url is required")
}
