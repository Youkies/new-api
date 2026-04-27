package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type uiRefundAppealPayload struct {
	Reason string `json:"reason"`
}

type uiRefundReviewPayload struct {
	ReviewNote string `json:"review_note"`
}

func GetUIRefundCandidates(c *gin.Context) {
	summary, err := model.GetUIRefundCandidates(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summary)
}

func CreateUIRefundAppeal(c *gin.Context) {
	var payload uiRefundAppealPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	appeal, items, err := model.CreateUIRefundAppeal(c.GetInt("id"), payload.Reason)
	if err != nil {
		if errors.Is(err, model.ErrNoUIRefundCandidates) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"appeal": appeal,
		"items":  items,
	})
}

func GetUserUIRefundAppeals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	appeals, total, err := model.GetUserUIRefundAppeals(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(appeals)
	common.ApiSuccess(c, pageInfo)
}

func AdminListUIRefundAppeals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := strings.TrimSpace(c.Query("status"))
	keyword := strings.TrimSpace(c.Query("keyword"))
	appeals, total, err := model.GetAdminUIRefundAppeals(pageInfo, status, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(appeals)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetUIRefundAppeal(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	appeal, items, err := model.GetUIRefundAppealWithItems(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"appeal": appeal,
		"items":  items,
	})
}

func AdminApproveUIRefundAppeal(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiRefundReviewPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	appeal, err := model.ApproveUIRefundAppeal(id, c.GetInt("id"), payload.ReviewNote)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, appeal)
}

func AdminRejectUIRefundAppeal(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiRefundReviewPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	appeal, err := model.RejectUIRefundAppeal(id, c.GetInt("id"), payload.ReviewNote)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, appeal)
}
