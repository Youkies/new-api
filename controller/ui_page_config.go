package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type uiPageConfigPayload struct {
	APIURLs          []model.UIPageAPIURL          `json:"api_urls"`
	MembershipBadges []model.UIPageMembershipBadge `json:"membership_badges"`
}

func uiPageConfigResponse(config *model.UIPageConfig, admin bool) gin.H {
	items := config.APIURLItems()
	if !admin {
		items = model.EnabledUIPageAPIURLs(items)
	}
	return gin.H{
		"api_urls":          items,
		"membership_badges": model.GetUIPageMembershipBadges(),
		"updated_at":        config.UpdatedAt,
	}
}

func GetUIPageConfig(c *gin.Context) {
	config, err := model.GetUIPageConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, uiPageConfigResponse(config, false))
}

func AdminGetUIPageConfig(c *gin.Context) {
	config, err := model.GetUIPageConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, uiPageConfigResponse(config, true))
}

func AdminSaveUIPageConfig(c *gin.Context) {
	var payload uiPageConfigPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	config, err := model.GetUIPageConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.SaveUIPageConfigAPIURLs(config, payload.APIURLs); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.MembershipBadges != nil {
		if err = model.SaveUIPageMembershipBadges(payload.MembershipBadges); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, uiPageConfigResponse(config, true))
}
