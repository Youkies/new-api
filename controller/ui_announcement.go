package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type uiAnnouncementPayload struct {
	Title         string `json:"title"`
	Summary       string `json:"summary"`
	Content       string `json:"content"`
	ContentFormat string `json:"content_format"`
	Type          string `json:"type"`
	Scope         string `json:"scope"`
	NotifyEnabled *bool  `json:"notify_enabled"`
	NotifyLevel   string `json:"notify_level"`
	RequireAck    *bool  `json:"require_ack"`
	ForcePopup    *bool  `json:"force_popup"`
	Pinned        *bool  `json:"pinned"`
	Enabled       *bool  `json:"enabled"`
	Priority      int    `json:"priority"`
	StartsAt      int64  `json:"starts_at"`
	EndsAt        int64  `json:"ends_at"`
}

type uiAnnouncementAckPayload struct {
	DontShowAgain bool `json:"dont_show_again"`
}

type uiAnnouncementPatchPayload struct {
	NotifyEnabled *bool `json:"notify_enabled"`
	RequireAck    *bool `json:"require_ack"`
	ForcePopup    *bool `json:"force_popup"`
	Pinned        *bool `json:"pinned"`
	Enabled       *bool `json:"enabled"`
	Priority      *int  `json:"priority"`
}

func boolPayloadValue(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func applyUIAnnouncementPayload(target *model.UIAnnouncement, payload uiAnnouncementPayload) {
	target.Title = payload.Title
	target.Summary = payload.Summary
	target.Content = payload.Content
	target.ContentFormat = payload.ContentFormat
	target.Type = payload.Type
	target.Scope = payload.Scope
	target.NotifyEnabled = boolPayloadValue(payload.NotifyEnabled, target.NotifyEnabled)
	target.NotifyLevel = payload.NotifyLevel
	target.RequireAck = boolPayloadValue(payload.RequireAck, target.RequireAck)
	target.ForcePopup = boolPayloadValue(payload.ForcePopup, target.ForcePopup)
	target.Pinned = boolPayloadValue(payload.Pinned, target.Pinned)
	target.Enabled = boolPayloadValue(payload.Enabled, target.Enabled)
	target.Priority = payload.Priority
	target.StartsAt = payload.StartsAt
	target.EndsAt = payload.EndsAt
}

func GetPublicUIAnnouncements(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	announcements, total, err := model.GetPublicUIAnnouncements(pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(announcements)
	common.ApiSuccess(c, pageInfo)
}

func GetActiveUIAnnouncements(c *gin.Context) {
	announcements, err := model.GetActiveForceUIAnnouncements()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	ackMap, err := model.GetUIAnnouncementAckMap(userId, announcements)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pending := make([]*model.UIAnnouncement, 0, len(announcements))
	for _, announcement := range announcements {
		if announcement == nil || ackMap[announcement.Id] {
			continue
		}
		pending = append(pending, announcement)
	}
	common.ApiSuccess(c, gin.H{"items": pending})
}

func AckUIAnnouncement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiAnnouncementAckPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	announcement, err := model.GetUIAnnouncementById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !announcement.Enabled {
		common.ApiErrorMsg(c, "公告未启用")
		return
	}
	if err = model.AckUIAnnouncement(c.GetInt("id"), announcement.Id, announcement.Version, payload.DontShowAgain); err != nil {
		common.ApiError(c, err)
		return
	}
	sourceKey := model.UIAnnouncementNotificationSourceKey(announcement.Id, announcement.Version)
	if err = model.MarkUINotificationReadBySource(c.GetInt("id"), model.UINotificationSourceAnnouncement, sourceKey, true); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListUIAnnouncements(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
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
	announcements, total, err := model.GetAdminUIAnnouncements(pageInfo, keyword, enabled)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(announcements)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetUIAnnouncement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	announcement, err := model.GetUIAnnouncementById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, announcement)
}

func AdminCreateUIAnnouncement(c *gin.Context) {
	var payload uiAnnouncementPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	announcement := &model.UIAnnouncement{Enabled: true, NotifyEnabled: true}
	applyUIAnnouncementPayload(announcement, payload)
	announcement.CreatedBy = c.GetInt("id")
	announcement.UpdatedBy = c.GetInt("id")
	if err := model.CreateUIAnnouncement(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncUIAnnouncementNotification(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, announcement)
}

func AdminUpdateUIAnnouncement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiAnnouncementPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	announcement, err := model.GetUIAnnouncementById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	applyUIAnnouncementPayload(announcement, payload)
	announcement.Version++
	announcement.UpdatedBy = c.GetInt("id")
	if err = model.UpdateUIAnnouncement(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.SyncUIAnnouncementNotification(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, announcement)
}

func AdminPatchUIAnnouncement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiAnnouncementPatchPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	announcement, err := model.GetUIAnnouncementById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	previousForcePopup := announcement.ForcePopup
	previousRequireAck := announcement.RequireAck
	if payload.Enabled != nil {
		announcement.Enabled = *payload.Enabled
	}
	if payload.NotifyEnabled != nil {
		announcement.NotifyEnabled = *payload.NotifyEnabled
	}
	if payload.RequireAck != nil {
		announcement.RequireAck = *payload.RequireAck
	}
	if payload.Pinned != nil {
		announcement.Pinned = *payload.Pinned
	}
	if payload.ForcePopup != nil {
		announcement.ForcePopup = *payload.ForcePopup
	}
	if payload.Priority != nil {
		announcement.Priority = *payload.Priority
	}
	if (payload.ForcePopup != nil && previousForcePopup != announcement.ForcePopup) ||
		(payload.RequireAck != nil && previousRequireAck != announcement.RequireAck) {
		announcement.Version++
	}
	announcement.UpdatedBy = c.GetInt("id")
	if err = model.UpdateUIAnnouncement(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.SyncUIAnnouncementNotification(announcement); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, announcement)
}

func AdminDeleteUIAnnouncement(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteUIAnnouncementById(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.DisableUINotificationsBySource(model.UINotificationSourceAnnouncement, id)
	common.ApiSuccess(c, nil)
}
