package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type uiModelReviewPayload struct {
	ModelName string   `json:"model_name"`
	Rating    int      `json:"rating"`
	Scenario  string   `json:"scenario"`
	Tags      []string `json:"tags"`
	Pros      string   `json:"pros"`
	Cons      string   `json:"cons"`
	Content   string   `json:"content"`
	Anonymous *bool    `json:"anonymous"`
	HideUsage *bool    `json:"hide_usage"`
}

type uiModelReviewSettingPayload struct {
	Enabled               bool `json:"enabled"`
	RequireAdminReview    bool `json:"require_admin_review"`
	PointsPerQuota        int  `json:"points_per_quota"`
	BaseReviewPoints      int  `json:"base_review_points"`
	QualityRewardMinScore int  `json:"quality_reward_min_score"`
	QualityRewardMax      int  `json:"quality_reward_max"`
	HelpfulPoints         int  `json:"helpful_points"`
	HelpfulRewardLimit    int  `json:"helpful_reward_limit"`
	FeaturedReviewPoints  int  `json:"featured_review_points"`
	DailyPointsCap        int  `json:"daily_points_cap"`
	WeeklyPointsCap       int  `json:"weekly_points_cap"`
	RewardMultiplier      int  `json:"reward_multiplier"`
	MinRedeemPoints       int  `json:"min_redeem_points"`
}

type uiModelReviewAdminPatchPayload struct {
	Status         string `json:"status"`
	Featured       *bool  `json:"featured"`
	FeaturedPoints *int   `json:"featured_points"`
}

type uiModelReviewRedeemPayload struct {
	Points int `json:"points"`
}

func currentUIModelReviewUsername(c *gin.Context) string {
	username := strings.TrimSpace(c.GetString("username"))
	if username != "" {
		return username
	}
	username, _ = model.GetUsernameById(c.GetInt("id"), false)
	return username
}

func GetUIModelReviewRankings(c *gin.Context) {
	resp, err := model.GetUIModelReviewRankings(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func ListUIModelReviews(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	modelName := strings.TrimSpace(c.Query("model_name"))
	reviews, total, err := model.ListUIModelReviews(modelName, c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(reviews)
	common.ApiSuccess(c, pageInfo)
}

func GetUIModelReviewEligibility(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model_name"))
	usage, err := model.GetUserModelReviewUsage(c.GetInt("id"), modelName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, usage)
}

func UpsertUIModelReview(c *gin.Context) {
	var payload uiModelReviewPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	input := model.UIModelReviewUpsertInput{
		UserId:     c.GetInt("id"),
		Username:   currentUIModelReviewUsername(c),
		ModelName:  payload.ModelName,
		Rating:     payload.Rating,
		Scenario:   payload.Scenario,
		Tags:       payload.Tags,
		Pros:       payload.Pros,
		Cons:       payload.Cons,
		Content:    payload.Content,
		Anonymous:  boolPayloadValue(payload.Anonymous, false),
		HideUsage:  boolPayloadValue(payload.HideUsage, false),
		ReviewerId: c.GetInt("id"),
	}
	review, account, err := model.UpsertUIModelReview(input)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"review":  review,
		"account": account,
	})
}

func MarkUIModelReviewHelpful(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	review, account, err := model.MarkUIModelReviewHelpful(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"review":  review,
		"account": account,
	})
}

func GetUIModelReviewPointAccount(c *gin.Context) {
	account, err := model.GetUIModelReviewPointAccount(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	setting, err := model.GetUIModelReviewSetting()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"account": account,
		"setting": setting,
	})
}

func RedeemUIModelReviewPoints(c *gin.Context) {
	var payload uiModelReviewRedeemPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	account, quota, err := model.RedeemUIModelReviewPoints(c.GetInt("id"), payload.Points)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"account": account,
		"quota":   quota,
	})
}

func AdminGetUIModelReviewSetting(c *gin.Context) {
	setting, err := model.GetUIModelReviewSetting()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, setting)
}

func AdminSaveUIModelReviewSetting(c *gin.Context) {
	var payload uiModelReviewSettingPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	setting, err := model.GetUIModelReviewSetting()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	setting.Enabled = payload.Enabled
	setting.RequireAdminReview = payload.RequireAdminReview
	setting.PointsPerQuota = payload.PointsPerQuota
	setting.BaseReviewPoints = payload.BaseReviewPoints
	setting.QualityRewardMinScore = payload.QualityRewardMinScore
	setting.QualityRewardMax = payload.QualityRewardMax
	setting.HelpfulPoints = payload.HelpfulPoints
	setting.HelpfulRewardLimit = payload.HelpfulRewardLimit
	setting.FeaturedReviewPoints = payload.FeaturedReviewPoints
	setting.DailyPointsCap = payload.DailyPointsCap
	setting.WeeklyPointsCap = payload.WeeklyPointsCap
	setting.RewardMultiplier = payload.RewardMultiplier
	setting.MinRedeemPoints = payload.MinRedeemPoints
	if err = model.SaveUIModelReviewSetting(setting); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, setting)
}

func AdminListUIModelReviews(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := strings.TrimSpace(c.Query("status"))
	reviews, total, err := model.ListAdminUIModelReviews(pageInfo, keyword, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(reviews)
	common.ApiSuccess(c, pageInfo)
}

func AdminPatchUIModelReview(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiModelReviewAdminPatchPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	review, err := model.AdminPatchUIModelReview(id, payload.Status, payload.Featured, payload.FeaturedPoints, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, review)
}
