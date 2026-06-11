package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
)

// GenerateInviteCode POST /api/user/invite
func GenerateInviteCode(c *gin.Context) {
	userId := c.GetInt("id")

	hasTopUp, err := model.UserHasTopUp(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	if !hasTopUp {
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeNoTopUp)
		return
	}

	todayCount, err := model.CountTodayGenerated(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	if todayCount >= model.InviteCodeDailyMax {
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeDailyLimit)
		return
	}

	activeCount, err := model.CountActiveForOwner(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}
	if activeCount >= model.InviteCodeMaxActive {
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeActiveLimit)
		return
	}

	ic, err := model.CreateInviteCode(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgUserInviteCodeGenFailed)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    ic,
	})
}

// GetMyInviteCodes GET /api/user/invite
func GetMyInviteCodes(c *gin.Context) {
	userId := c.GetInt("id")

	codes, err := model.GetInviteCodesByOwner(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	hasTopUp, err := model.UserHasTopUp(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	todayCount, err := model.CountTodayGenerated(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	activeCount, err := model.CountActiveForOwner(userId)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgDatabaseError)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"data":           codes,
		"has_top_up":     hasTopUp,
		"today_used":     todayCount,
		"today_max":      model.InviteCodeDailyMax,
		"active_count":   activeCount,
		"active_max":     model.InviteCodeMaxActive,
	})
}
