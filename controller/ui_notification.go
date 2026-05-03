package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type uiNotificationPayload struct {
	Title         string `json:"title"`
	Summary       string `json:"summary"`
	Content       string `json:"content"`
	ContentFormat string `json:"content_format"`
	Category      string `json:"category"`
	Level         string `json:"level"`
	SourceType    string `json:"source_type"`
	SourceKey     string `json:"source_key"`
	SourceId      int64  `json:"source_id"`
	SourceVersion int    `json:"source_version"`
	TargetType    string `json:"target_type"`
	TargetUserId  int    `json:"target_user_id"`
	TargetGroup   string `json:"target_group"`
	ActionUrl     string `json:"action_url"`
	Popup         *bool  `json:"popup"`
	RequireAck    *bool  `json:"require_ack"`
	Pinned        *bool  `json:"pinned"`
	Enabled       *bool  `json:"enabled"`
	Priority      int    `json:"priority"`
	StartsAt      int64  `json:"starts_at"`
	EndsAt        int64  `json:"ends_at"`
}

type uiNotificationPatchPayload struct {
	Popup      *bool `json:"popup"`
	RequireAck *bool `json:"require_ack"`
	Pinned     *bool `json:"pinned"`
	Enabled    *bool `json:"enabled"`
	Priority   *int  `json:"priority"`
}

func applyUINotificationPayload(target *model.UINotification, payload uiNotificationPayload) {
	target.Title = payload.Title
	target.Summary = payload.Summary
	target.Content = payload.Content
	target.ContentFormat = payload.ContentFormat
	target.Category = payload.Category
	target.Level = payload.Level
	target.SourceType = payload.SourceType
	target.SourceKey = payload.SourceKey
	target.SourceId = payload.SourceId
	target.SourceVersion = payload.SourceVersion
	target.TargetType = payload.TargetType
	target.TargetUserId = payload.TargetUserId
	target.TargetGroup = payload.TargetGroup
	target.ActionUrl = payload.ActionUrl
	target.Popup = boolPayloadValue(payload.Popup, target.Popup)
	target.RequireAck = boolPayloadValue(payload.RequireAck, target.RequireAck)
	target.Pinned = boolPayloadValue(payload.Pinned, target.Pinned)
	target.Enabled = boolPayloadValue(payload.Enabled, target.Enabled)
	target.Priority = payload.Priority
	target.StartsAt = payload.StartsAt
	target.EndsAt = payload.EndsAt
}

func ListUINotifications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	options := model.UINotificationListOptions{
		Category:   strings.TrimSpace(c.Query("category")),
		UnreadOnly: c.Query("unread") == "true" || c.Query("unread") == "1",
	}
	notifications, total, err := model.ListUserUINotifications(c.GetInt("id"), pageInfo, options)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(notifications)
	common.ApiSuccess(c, pageInfo)
}

func GetUINotificationUnreadCount(c *gin.Context) {
	count, err := model.CountUnreadUINotifications(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"unread": count})
}

func ReadUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	notification, err := model.MarkUINotificationRead(c.GetInt("id"), id, false)
	if err != nil {
		if errors.Is(err, model.ErrUINotificationRequiresAck) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notification)
}

func AckUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	notification, err := model.MarkUINotificationRead(c.GetInt("id"), id, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if notification.SourceType == model.UINotificationSourceAnnouncement && notification.SourceId > 0 {
		_ = model.AckUIAnnouncement(c.GetInt("id"), notification.SourceId, notification.SourceVersion, true)
	}
	common.ApiSuccess(c, notification)
}

func ReadAllUINotifications(c *gin.Context) {
	count, err := model.MarkAllReadableUINotificationsRead(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"read": count})
}

func AdminListUINotifications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	category := strings.TrimSpace(c.Query("category"))
	targetType := strings.TrimSpace(c.Query("target_type"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	var enabled *bool
	if raw := strings.TrimSpace(c.Query("enabled")); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		enabled = &parsed
	}
	notifications, total, err := model.GetAdminUINotifications(pageInfo, category, targetType, keyword, enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(notifications)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	notification, err := model.GetUINotificationById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notification)
}

func AdminCreateUINotification(c *gin.Context) {
	var payload uiNotificationPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	notification := &model.UINotification{
		Enabled:       true,
		Category:      model.UINotificationCategorySystem,
		Level:         model.UINotificationLevelInfo,
		ContentFormat: model.UINotificationFormatPlain,
		TargetType:    model.UINotificationTargetAll,
		SourceType:    model.UINotificationSourceManual,
	}
	applyUINotificationPayload(notification, payload)
	notification.CreatedBy = c.GetInt("id")
	notification.UpdatedBy = c.GetInt("id")
	if err := model.CreateUINotification(notification); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notification)
}

func AdminUpdateUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiNotificationPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	notification, err := model.GetUINotificationById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	applyUINotificationPayload(notification, payload)
	notification.UpdatedBy = c.GetInt("id")
	if err = model.UpdateUINotification(notification); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notification)
}

func AdminPatchUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiNotificationPatchPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	notification, err := model.GetUINotificationById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Popup != nil {
		notification.Popup = *payload.Popup
	}
	if payload.RequireAck != nil {
		notification.RequireAck = *payload.RequireAck
	}
	if payload.Pinned != nil {
		notification.Pinned = *payload.Pinned
	}
	if payload.Enabled != nil {
		notification.Enabled = *payload.Enabled
	}
	if payload.Priority != nil {
		notification.Priority = *payload.Priority
	}
	notification.UpdatedBy = c.GetInt("id")
	if err = model.UpdateUINotification(notification); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, notification)
}

func AdminDeleteUINotification(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteUINotificationById(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
