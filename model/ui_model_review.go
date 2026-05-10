package model

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UIModelReviewStatusVisible = "visible"
	UIModelReviewStatusHidden  = "hidden"
	UIModelReviewStatusPending = "pending"

	UIModelReviewPointTypeBase     = "base_review"
	UIModelReviewPointTypeQuality  = "quality_review"
	UIModelReviewPointTypeHelpful  = "helpful"
	UIModelReviewPointTypeFeatured = "featured"
	UIModelReviewPointTypeRedeem   = "redeem_quota"

	uiModelReviewRankingWindowSeconds = 30 * 24 * 60 * 60
	uiModelReviewBayesPriorReviews    = 5
	uiModelReviewBayesPriorRating     = 3.8
)

var (
	ErrUIModelReviewNeedUsage      = errors.New("使用过该模型后才能评价")
	ErrUIModelReviewSettingMissing = errors.New("模型评价设置表 ui_model_review_settings 不存在，请先完成数据库迁移")
)

type UIModelReview struct {
	Id                    int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId                int    `json:"user_id" gorm:"not null;uniqueIndex:idx_ui_model_reviews_user_model,priority:1;index"`
	Username              string `json:"username" gorm:"type:varchar(191);default:'';index"`
	ModelName             string `json:"model_name" gorm:"type:varchar(191);not null;uniqueIndex:idx_ui_model_reviews_user_model,priority:2;index"`
	Rating                int    `json:"rating" gorm:"default:0;index"`
	Scenario              string `json:"scenario" gorm:"type:varchar(64);default:'';index"`
	Tags                  string `json:"tags" gorm:"type:text"`
	Pros                  string `json:"pros" gorm:"type:varchar(500);default:''"`
	Cons                  string `json:"cons" gorm:"type:varchar(500);default:''"`
	Content               string `json:"content" gorm:"type:text"`
	Anonymous             bool   `json:"anonymous" gorm:"default:false;index"`
	HideUsage             bool   `json:"hide_usage" gorm:"default:false"`
	UsageCount            int    `json:"usage_count" gorm:"default:0"`
	UsageTokens           int    `json:"usage_tokens" gorm:"default:0"`
	UsageQuota            int    `json:"usage_quota" gorm:"default:0"`
	LastUsedAt            int64  `json:"last_used_at" gorm:"default:0;index"`
	QualityScore          int    `json:"quality_score" gorm:"default:0;index"`
	HelpfulCount          int    `json:"helpful_count" gorm:"default:0;index"`
	Featured              bool   `json:"featured" gorm:"default:false;index"`
	Status                string `json:"status" gorm:"type:varchar(32);default:'visible';index"`
	BasePointsAwarded     int    `json:"base_points_awarded" gorm:"default:0"`
	QualityPointsAwarded  int    `json:"quality_points_awarded" gorm:"default:0"`
	HelpfulPointsAwarded  int    `json:"helpful_points_awarded" gorm:"default:0"`
	FeaturedPointsAwarded int    `json:"featured_points_awarded" gorm:"default:0"`
	TotalPointsAwarded    int    `json:"total_points_awarded" gorm:"default:0;index"`
	CreatedAt             int64  `json:"created_at" gorm:"default:0;index"`
	UpdatedAt             int64  `json:"updated_at" gorm:"default:0"`
	ReviewedBy            int    `json:"reviewed_by" gorm:"default:0"`
	ReviewedAt            int64  `json:"reviewed_at" gorm:"default:0"`
}

func (UIModelReview) TableName() string {
	return "ui_model_reviews"
}

type UIModelReviewHelpful struct {
	Id        int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	ReviewId  int64 `json:"review_id" gorm:"not null;uniqueIndex:idx_ui_model_review_helpful_unique,priority:1;index"`
	UserId    int   `json:"user_id" gorm:"not null;uniqueIndex:idx_ui_model_review_helpful_unique,priority:2;index"`
	AuthorId  int   `json:"author_id" gorm:"not null;index"`
	CreatedAt int64 `json:"created_at" gorm:"default:0;index"`
}

func (UIModelReviewHelpful) TableName() string {
	return "ui_model_review_helpful"
}

type UIModelReviewPointAccount struct {
	UserId          int    `json:"user_id" gorm:"primaryKey"`
	Username        string `json:"username" gorm:"type:varchar(191);default:'';index"`
	TotalEarned     int    `json:"total_earned" gorm:"default:0"`
	AvailablePoints int    `json:"available_points" gorm:"default:0"`
	RedeemedPoints  int    `json:"redeemed_points" gorm:"default:0"`
	UpdatedAt       int64  `json:"updated_at" gorm:"default:0"`
}

func (UIModelReviewPointAccount) TableName() string {
	return "ui_model_review_point_accounts"
}

type UIModelReviewPointLedger struct {
	Id           int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;index:idx_ui_model_review_points_user_created,priority:1"`
	Username     string `json:"username" gorm:"type:varchar(191);default:'';index"`
	ReviewId     int64  `json:"review_id" gorm:"default:0;index"`
	ModelName    string `json:"model_name" gorm:"type:varchar(191);default:'';index"`
	Type         string `json:"type" gorm:"type:varchar(32);not null;index"`
	Points       int    `json:"points" gorm:"default:0"`
	QuotaAwarded int    `json:"quota_awarded" gorm:"default:0"`
	BalanceAfter int    `json:"balance_after" gorm:"default:0"`
	Note         string `json:"note" gorm:"type:varchar(500);default:''"`
	CreatedBy    int    `json:"created_by" gorm:"default:0;index"`
	CreatedAt    int64  `json:"created_at" gorm:"default:0;index:idx_ui_model_review_points_user_created,priority:2"`
}

func (UIModelReviewPointLedger) TableName() string {
	return "ui_model_review_point_ledgers"
}

type UIModelReviewSetting struct {
	Id                    int   `json:"id" gorm:"primaryKey"`
	Enabled               bool  `json:"enabled" gorm:"default:true"`
	RequireAdminReview    bool  `json:"require_admin_review" gorm:"default:false"`
	PointsPerQuota        int   `json:"points_per_quota" gorm:"default:1000"`
	BaseReviewPoints      int   `json:"base_review_points" gorm:"default:500"`
	QualityRewardMinScore int   `json:"quality_reward_min_score" gorm:"default:40"`
	QualityRewardMax      int   `json:"quality_reward_max" gorm:"default:1500"`
	HelpfulPoints         int   `json:"helpful_points" gorm:"default:20"`
	HelpfulRewardLimit    int   `json:"helpful_reward_limit" gorm:"default:500"`
	FeaturedReviewPoints  int   `json:"featured_review_points" gorm:"default:3000"`
	DailyPointsCap        int   `json:"daily_points_cap" gorm:"default:3000"`
	WeeklyPointsCap       int   `json:"weekly_points_cap" gorm:"default:10000"`
	RewardMultiplier      int   `json:"reward_multiplier" gorm:"default:100"`
	MinRedeemPoints       int   `json:"min_redeem_points" gorm:"default:1000"`
	CreatedAt             int64 `json:"created_at" gorm:"default:0"`
	UpdatedAt             int64 `json:"updated_at" gorm:"default:0"`
}

func (UIModelReviewSetting) TableName() string {
	return "ui_model_review_settings"
}

type UIModelReviewUsage struct {
	ModelName  string `json:"model_name"`
	Count      int    `json:"count"`
	Tokens     int    `json:"tokens"`
	Quota      int    `json:"quota"`
	LastUsedAt int64  `json:"last_used_at"`
	Eligible   bool   `json:"eligible"`
}

type UIModelReviewView struct {
	*UIModelReview
	TagList         []string `json:"tag_list"`
	DisplayName     string   `json:"display_name"`
	UsageLabel      string   `json:"usage_label"`
	PublicUsage     bool     `json:"public_usage"`
	HelpfulByMe     bool     `json:"helpful_by_me"`
	CanMarkHelpful  bool     `json:"can_mark_helpful"`
	CanEdit         bool     `json:"can_edit"`
	CanUseExactName bool     `json:"can_use_exact_name"`
}

type UIModelReviewRankingEntry struct {
	ModelName       string              `json:"model_name"`
	AverageRating   float64             `json:"average_rating"`
	ReviewCount     int                 `json:"review_count"`
	HelpfulCount    int                 `json:"helpful_count"`
	FeaturedCount   int                 `json:"featured_count"`
	AverageQuality  float64             `json:"average_quality"`
	UsageTokens     int64               `json:"usage_tokens"`
	Score           float64             `json:"score"`
	MyUsage         *UIModelReviewUsage `json:"my_usage,omitempty"`
	MyReview        *UIModelReviewView  `json:"my_review,omitempty"`
	Eligible        bool                `json:"eligible"`
	HasEnoughSample bool                `json:"has_enough_sample"`
}

type UIModelReviewRankingResponse struct {
	Entries   []*UIModelReviewRankingEntry `json:"entries"`
	Settings  *UIModelReviewSetting        `json:"settings"`
	MyAccount *UIModelReviewPointAccount   `json:"my_account,omitempty"`
	UpdatedAt int64                        `json:"updated_at"`
}

type UIModelReviewUpsertInput struct {
	UserId     int
	Username   string
	ModelName  string
	Rating     int
	Scenario   string
	Tags       []string
	Pros       string
	Cons       string
	Content    string
	Anonymous  bool
	HideUsage  bool
	ReviewerId int
}

type uiModelReviewAggRow struct {
	ModelName      string
	AverageRating  float64
	ReviewCount    int
	HelpfulCount   int
	FeaturedCount  int
	AverageQuality float64
}

func defaultUIModelReviewSetting() *UIModelReviewSetting {
	now := common.GetTimestamp()
	return &UIModelReviewSetting{
		Id:                    1,
		Enabled:               true,
		PointsPerQuota:        1000,
		BaseReviewPoints:      500,
		QualityRewardMinScore: 40,
		QualityRewardMax:      1500,
		HelpfulPoints:         20,
		HelpfulRewardLimit:    500,
		FeaturedReviewPoints:  3000,
		DailyPointsCap:        3000,
		WeeklyPointsCap:       10000,
		RewardMultiplier:      100,
		MinRedeemPoints:       1000,
		CreatedAt:             now,
		UpdatedAt:             now,
	}
}

func NormalizeUIModelReviewSetting(setting *UIModelReviewSetting) {
	if setting.PointsPerQuota <= 0 {
		setting.PointsPerQuota = 1000
	}
	if setting.BaseReviewPoints < 0 {
		setting.BaseReviewPoints = 0
	}
	if setting.QualityRewardMinScore < 0 {
		setting.QualityRewardMinScore = 0
	}
	if setting.QualityRewardMinScore > 100 {
		setting.QualityRewardMinScore = 100
	}
	if setting.QualityRewardMax < 0 {
		setting.QualityRewardMax = 0
	}
	if setting.HelpfulPoints < 0 {
		setting.HelpfulPoints = 0
	}
	if setting.HelpfulRewardLimit < 0 {
		setting.HelpfulRewardLimit = 0
	}
	if setting.FeaturedReviewPoints < 0 {
		setting.FeaturedReviewPoints = 0
	}
	if setting.DailyPointsCap < 0 {
		setting.DailyPointsCap = 0
	}
	if setting.WeeklyPointsCap < 0 {
		setting.WeeklyPointsCap = 0
	}
	if setting.RewardMultiplier <= 0 {
		setting.RewardMultiplier = 100
	}
	if setting.MinRedeemPoints <= 0 {
		setting.MinRedeemPoints = setting.PointsPerQuota
	}
}

func GetUIModelReviewSetting() (*UIModelReviewSetting, error) {
	if DB == nil {
		return defaultUIModelReviewSetting(), nil
	}
	if !DB.Migrator().HasTable(UIModelReviewSetting{}.TableName()) {
		return defaultUIModelReviewSetting(), nil
	}
	var setting UIModelReviewSetting
	err := DB.First(&setting, "id = ?", 1).Error
	if err == nil {
		NormalizeUIModelReviewSetting(&setting)
		return &setting, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	settingPtr := defaultUIModelReviewSetting()
	if err = DB.Create(settingPtr).Error; err != nil {
		return nil, err
	}
	return settingPtr, nil
}

func SaveUIModelReviewSetting(setting *UIModelReviewSetting) error {
	if setting == nil {
		return errors.New("模型评价设置不能为空")
	}
	if DB == nil || !DB.Migrator().HasTable(UIModelReviewSetting{}.TableName()) {
		return ErrUIModelReviewSettingMissing
	}
	now := common.GetTimestamp()
	setting.Id = 1
	if setting.CreatedAt == 0 {
		setting.CreatedAt = now
	}
	setting.UpdatedAt = now
	NormalizeUIModelReviewSetting(setting)
	return DB.Save(setting).Error
}

func sanitizeUIModelReviewTags(tags []string) []string {
	seen := map[string]bool{}
	cleaned := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if len([]rune(tag)) > 24 {
			tag = string([]rune(tag)[:24])
		}
		key := strings.ToLower(tag)
		if seen[key] {
			continue
		}
		seen[key] = true
		cleaned = append(cleaned, tag)
		if len(cleaned) >= 8 {
			break
		}
	}
	return cleaned
}

func uiModelReviewTagsToString(tags []string) string {
	tags = sanitizeUIModelReviewTags(tags)
	if len(tags) == 0 {
		return "[]"
	}
	data, err := common.Marshal(tags)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func uiModelReviewStringToTags(raw string) []string {
	var tags []string
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	if err := common.Unmarshal([]byte(raw), &tags); err != nil {
		return []string{}
	}
	return sanitizeUIModelReviewTags(tags)
}

func validateUIModelReviewInput(input *UIModelReviewUpsertInput) error {
	input.ModelName = strings.TrimSpace(input.ModelName)
	input.Scenario = strings.TrimSpace(input.Scenario)
	input.Pros = strings.TrimSpace(input.Pros)
	input.Cons = strings.TrimSpace(input.Cons)
	input.Content = strings.TrimSpace(input.Content)
	input.Tags = sanitizeUIModelReviewTags(input.Tags)
	if input.UserId <= 0 {
		return errors.New("无效的用户")
	}
	if input.ModelName == "" {
		return errors.New("模型名称不能为空")
	}
	if len([]rune(input.ModelName)) > 191 {
		return errors.New("模型名称不能超过 191 个字符")
	}
	if input.Rating < 1 || input.Rating > 5 {
		return errors.New("评分必须是 1 到 5 星")
	}
	if len([]rune(input.Scenario)) > 64 {
		return errors.New("使用场景不能超过 64 个字符")
	}
	if len([]rune(input.Pros)) > 500 || len([]rune(input.Cons)) > 500 {
		return errors.New("优点和不足说明不能超过 500 个字符")
	}
	if len([]rune(input.Content)) > 4000 {
		return errors.New("评价正文不能超过 4000 个字符")
	}
	return nil
}

func CalculateUIModelReviewQualityScore(scenario string, tags []string, pros string, cons string, content string) int {
	score := 0
	if strings.TrimSpace(scenario) != "" {
		score += 20
	}
	if len(sanitizeUIModelReviewTags(tags)) > 0 {
		score += 10
	}
	if strings.TrimSpace(pros) != "" {
		score += 20
	}
	if strings.TrimSpace(cons) != "" {
		score += 20
	}
	contentLen := len([]rune(strings.TrimSpace(content)))
	if contentLen >= 80 {
		score += 20
	}
	if contentLen >= 160 {
		score += 10
	}
	if score > 100 {
		score = 100
	}
	return score
}

func targetUIModelReviewQualityPoints(setting *UIModelReviewSetting, qualityScore int) int {
	if setting == nil || qualityScore < setting.QualityRewardMinScore || setting.QualityRewardMax <= 0 {
		return 0
	}
	points := int(math.Round(float64(setting.QualityRewardMax) * float64(qualityScore) / 100.0))
	if points < 0 {
		return 0
	}
	if points > setting.QualityRewardMax {
		return setting.QualityRewardMax
	}
	return points
}

func GetUserModelReviewUsage(userId int, modelName string) (*UIModelReviewUsage, error) {
	usage := &UIModelReviewUsage{ModelName: modelName}
	modelName = strings.TrimSpace(modelName)
	if userId <= 0 || modelName == "" {
		return usage, nil
	}
	var row struct {
		Count      int   `gorm:"column:count"`
		Tokens     int   `gorm:"column:tokens"`
		Quota      int   `gorm:"column:quota"`
		LastUsedAt int64 `gorm:"column:last_used_at"`
	}
	err := LOG_DB.Model(&Log{}).
		Select("COUNT(*) as count, COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens, COALESCE(SUM(quota), 0) as quota, COALESCE(MAX(created_at), 0) as last_used_at").
		Where("user_id = ? AND model_name = ? AND type = ?", userId, modelName, LogTypeConsume).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	usage.Count = row.Count
	usage.Tokens = row.Tokens
	usage.Quota = row.Quota
	usage.LastUsedAt = row.LastUsedAt
	usage.Eligible = row.Count > 0
	return usage, nil
}

func GetUserModelReviewUsageMap(userId int) (map[string]*UIModelReviewUsage, error) {
	result := map[string]*UIModelReviewUsage{}
	if userId <= 0 {
		return result, nil
	}
	var rows []struct {
		ModelName  string `gorm:"column:model_name"`
		Count      int    `gorm:"column:count"`
		Tokens     int    `gorm:"column:tokens"`
		Quota      int    `gorm:"column:quota"`
		LastUsedAt int64  `gorm:"column:last_used_at"`
	}
	err := LOG_DB.Model(&Log{}).
		Select("model_name, COUNT(*) as count, COALESCE(SUM(prompt_tokens + completion_tokens), 0) as tokens, COALESCE(SUM(quota), 0) as quota, COALESCE(MAX(created_at), 0) as last_used_at").
		Where("user_id = ? AND model_name <> '' AND type = ?", userId, LogTypeConsume).
		Group("model_name").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ModelName] = &UIModelReviewUsage{
			ModelName:  row.ModelName,
			Count:      row.Count,
			Tokens:     row.Tokens,
			Quota:      row.Quota,
			LastUsedAt: row.LastUsedAt,
			Eligible:   row.Count > 0,
		}
	}
	return result, nil
}

func GrantUIModelReviewPoints(userId int, username string, reviewId int64, modelName string, pointType string, requestedPoints int, note string, createdBy int) (int, error) {
	if userId <= 0 || requestedPoints <= 0 {
		return 0, nil
	}
	setting, err := GetUIModelReviewSetting()
	if err != nil {
		return 0, err
	}
	if !setting.Enabled {
		return 0, nil
	}
	requestedPoints = int(decimal.NewFromInt(int64(requestedPoints)).
		Mul(decimal.NewFromInt(int64(setting.RewardMultiplier))).
		Div(decimal.NewFromInt(100)).
		IntPart())
	if requestedPoints <= 0 {
		return 0, nil
	}
	now := common.GetTimestamp()
	dayStart, weekStart := uiModelReviewRewardWindowStarts(time.Now())
	var dailyUsed, weeklyUsed int
	if err = DB.Model(&UIModelReviewPointLedger{}).
		Select("COALESCE(SUM(points), 0)").
		Where("user_id = ? AND points > 0 AND created_at >= ?", userId, dayStart).
		Scan(&dailyUsed).Error; err != nil {
		return 0, err
	}
	if err = DB.Model(&UIModelReviewPointLedger{}).
		Select("COALESCE(SUM(points), 0)").
		Where("user_id = ? AND points > 0 AND created_at >= ?", userId, weekStart).
		Scan(&weeklyUsed).Error; err != nil {
		return 0, err
	}
	allowed := requestedPoints
	if setting.DailyPointsCap > 0 {
		allowed = minInt(allowed, setting.DailyPointsCap-dailyUsed)
	}
	if setting.WeeklyPointsCap > 0 {
		allowed = minInt(allowed, setting.WeeklyPointsCap-weeklyUsed)
	}
	if allowed <= 0 {
		return 0, nil
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		var account UIModelReviewPointAccount
		accountErr := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&account, "user_id = ?", userId).Error
		if errors.Is(accountErr, gorm.ErrRecordNotFound) {
			account = UIModelReviewPointAccount{
				UserId:    userId,
				Username:  username,
				UpdatedAt: now,
			}
			if accountErr = tx.Create(&account).Error; accountErr != nil {
				return accountErr
			}
		} else if accountErr != nil {
			return accountErr
		}
		account.Username = username
		account.TotalEarned += allowed
		account.AvailablePoints += allowed
		account.UpdatedAt = now
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		ledger := &UIModelReviewPointLedger{
			UserId:       userId,
			Username:     username,
			ReviewId:     reviewId,
			ModelName:    modelName,
			Type:         pointType,
			Points:       allowed,
			BalanceAfter: account.AvailablePoints,
			Note:         strings.TrimSpace(note),
			CreatedBy:    createdBy,
			CreatedAt:    now,
		}
		return tx.Create(ledger).Error
	})
	return allowed, err
}

func uiModelReviewRewardWindowStarts(now time.Time) (int64, int64) {
	local := now.In(time.Local)
	dayStart := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
	weekday := int(local.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	weekStart := dayStart.AddDate(0, 0, -(weekday - 1))
	return dayStart.Unix(), weekStart.Unix()
}

func UpsertUIModelReview(input UIModelReviewUpsertInput) (*UIModelReviewView, *UIModelReviewPointAccount, error) {
	if err := validateUIModelReviewInput(&input); err != nil {
		return nil, nil, err
	}
	setting, err := GetUIModelReviewSetting()
	if err != nil {
		return nil, nil, err
	}
	if !setting.Enabled {
		return nil, nil, errors.New("模型评价暂未开启")
	}
	usage, err := GetUserModelReviewUsage(input.UserId, input.ModelName)
	if err != nil {
		return nil, nil, err
	}
	if usage.Count <= 0 {
		return nil, nil, ErrUIModelReviewNeedUsage
	}

	now := common.GetTimestamp()
	var review UIModelReview
	err = DB.Where("user_id = ? AND model_name = ?", input.UserId, input.ModelName).First(&review).Error
	isNew := errors.Is(err, gorm.ErrRecordNotFound)
	if err != nil && !isNew {
		return nil, nil, err
	}
	oldQualityPoints := review.QualityPointsAwarded
	if isNew {
		review = UIModelReview{
			UserId:    input.UserId,
			Username:  input.Username,
			ModelName: input.ModelName,
			Status:    UIModelReviewStatusVisible,
			CreatedAt: now,
		}
	}
	review.Username = input.Username
	review.Rating = input.Rating
	review.Scenario = input.Scenario
	review.Tags = uiModelReviewTagsToString(input.Tags)
	review.Pros = input.Pros
	review.Cons = input.Cons
	review.Content = input.Content
	review.Anonymous = input.Anonymous
	review.HideUsage = input.HideUsage
	review.UsageCount = usage.Count
	review.UsageTokens = usage.Tokens
	review.UsageQuota = usage.Quota
	review.LastUsedAt = usage.LastUsedAt
	review.QualityScore = CalculateUIModelReviewQualityScore(input.Scenario, input.Tags, input.Pros, input.Cons, input.Content)
	if setting.RequireAdminReview && isNew {
		review.Status = UIModelReviewStatusPending
	} else if review.Status == "" {
		review.Status = UIModelReviewStatusVisible
	}
	review.UpdatedAt = now
	if isNew {
		err = DB.Create(&review).Error
	} else {
		err = DB.Save(&review).Error
	}
	if err != nil {
		return nil, nil, err
	}

	if review.BasePointsAwarded == 0 && setting.BaseReviewPoints > 0 {
		granted, grantErr := GrantUIModelReviewPoints(input.UserId, input.Username, review.Id, review.ModelName, UIModelReviewPointTypeBase, setting.BaseReviewPoints, "首次有效评价", input.ReviewerId)
		if grantErr != nil {
			return nil, nil, grantErr
		}
		if granted > 0 {
			review.BasePointsAwarded += granted
			review.TotalPointsAwarded += granted
		}
	}
	targetQualityPoints := targetUIModelReviewQualityPoints(setting, review.QualityScore)
	if targetQualityPoints > oldQualityPoints {
		granted, grantErr := GrantUIModelReviewPoints(input.UserId, input.Username, review.Id, review.ModelName, UIModelReviewPointTypeQuality, targetQualityPoints-oldQualityPoints, "高质量评价补差额", input.ReviewerId)
		if grantErr != nil {
			return nil, nil, grantErr
		}
		if granted > 0 {
			review.QualityPointsAwarded += granted
			review.TotalPointsAwarded += granted
		}
	}
	if err = DB.Save(&review).Error; err != nil {
		return nil, nil, err
	}
	account, _ := GetUIModelReviewPointAccount(input.UserId)
	return BuildUIModelReviewView(&review, input.UserId, map[int64]bool{}), account, nil
}

func GetUIModelReviewPointAccount(userId int) (*UIModelReviewPointAccount, error) {
	account := &UIModelReviewPointAccount{UserId: userId}
	if userId <= 0 {
		return account, nil
	}
	err := DB.First(account, "user_id = ?", userId).Error
	if err == nil {
		return account, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		username, _ := GetUsernameById(userId, false)
		account.Username = username
		return account, nil
	}
	return nil, err
}

func BuildUIModelReviewView(review *UIModelReview, viewerId int, helpfulMap map[int64]bool) *UIModelReviewView {
	if review == nil {
		return nil
	}
	view := &UIModelReviewView{
		UIModelReview:   review,
		TagList:         uiModelReviewStringToTags(review.Tags),
		DisplayName:     review.Username,
		PublicUsage:     !review.HideUsage,
		HelpfulByMe:     helpfulMap[review.Id],
		CanMarkHelpful:  viewerId > 0 && viewerId != review.UserId,
		CanEdit:         viewerId > 0 && viewerId == review.UserId,
		CanUseExactName: !review.Anonymous,
	}
	if review.Anonymous {
		view.DisplayName = "匿名食评家"
		view.CanUseExactName = false
	}
	if review.HideUsage {
		view.UsageLabel = "已验证使用"
	} else {
		view.UsageLabel = fmt.Sprintf("已使用 %d 次", review.UsageCount)
	}
	return view
}

func BuildUIModelReviewViews(reviews []*UIModelReview, viewerId int) ([]*UIModelReviewView, error) {
	helpfulMap := map[int64]bool{}
	if viewerId > 0 && len(reviews) > 0 {
		ids := make([]int64, 0, len(reviews))
		for _, review := range reviews {
			ids = append(ids, review.Id)
		}
		var rows []UIModelReviewHelpful
		if err := DB.Where("user_id = ? AND review_id IN ?", viewerId, ids).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			helpfulMap[row.ReviewId] = true
		}
	}
	views := make([]*UIModelReviewView, 0, len(reviews))
	for _, review := range reviews {
		views = append(views, BuildUIModelReviewView(review, viewerId, helpfulMap))
	}
	return views, nil
}

func ListUIModelReviews(modelName string, viewerId int, pageInfo *common.PageInfo) ([]*UIModelReviewView, int64, error) {
	query := DB.Model(&UIModelReview{}).Where("status = ?", UIModelReviewStatusVisible)
	if strings.TrimSpace(modelName) != "" {
		query = query.Where("model_name = ?", strings.TrimSpace(modelName))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var reviews []*UIModelReview
	err := query.Order("featured DESC, helpful_count DESC, updated_at DESC").
		Offset(pageInfo.GetStartIdx()).
		Limit(pageInfo.GetPageSize()).
		Find(&reviews).Error
	if err != nil {
		return nil, 0, err
	}
	views, err := BuildUIModelReviewViews(reviews, viewerId)
	return views, total, err
}

func ListAdminUIModelReviews(pageInfo *common.PageInfo, keyword string, status string) ([]*UIModelReview, int64, error) {
	query := DB.Model(&UIModelReview{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("model_name LIKE ? OR username LIKE ? OR content LIKE ?", like, like, like)
	}
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var reviews []*UIModelReview
	err := query.Order("updated_at DESC").
		Offset(pageInfo.GetStartIdx()).
		Limit(pageInfo.GetPageSize()).
		Find(&reviews).Error
	return reviews, total, err
}

func GetUIModelReviewRankings(viewerId int) (*UIModelReviewRankingResponse, error) {
	setting, err := GetUIModelReviewSetting()
	if err != nil {
		return nil, err
	}
	var rows []uiModelReviewAggRow
	err = DB.Model(&UIModelReview{}).
		Select("model_name, AVG(rating) as average_rating, COUNT(*) as review_count, COALESCE(SUM(helpful_count), 0) as helpful_count, COALESCE(SUM(CASE WHEN featured THEN 1 ELSE 0 END), 0) as featured_count, COALESCE(AVG(quality_score), 0) as average_quality").
		Where("status = ?", UIModelReviewStatusVisible).
		Group("model_name").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	windowStart := common.GetTimestamp() - uiModelReviewRankingWindowSeconds
	quotaTotals, _ := GetRankingQuotaTotals(windowStart, 0)
	entryMap := map[string]*UIModelReviewRankingEntry{}
	for _, p := range GetPricing() {
		name := strings.TrimSpace(p.ModelName)
		if name == "" {
			continue
		}
		entryMap[name] = &UIModelReviewRankingEntry{ModelName: name}
	}
	for _, total := range quotaTotals {
		name := strings.TrimSpace(total.ModelName)
		if name == "" {
			continue
		}
		entry, ok := entryMap[name]
		if !ok {
			entry = &UIModelReviewRankingEntry{ModelName: name}
			entryMap[name] = entry
		}
		entry.UsageTokens = total.TotalTokens
	}
	for _, row := range rows {
		name := strings.TrimSpace(row.ModelName)
		if name == "" {
			continue
		}
		entry, ok := entryMap[name]
		if !ok {
			entry = &UIModelReviewRankingEntry{ModelName: name}
			entryMap[name] = entry
		}
		entry.AverageRating = math.Round(row.AverageRating*10) / 10
		entry.ReviewCount = row.ReviewCount
		entry.HelpfulCount = row.HelpfulCount
		entry.FeaturedCount = row.FeaturedCount
		entry.AverageQuality = math.Round(row.AverageQuality)
		entry.HasEnoughSample = row.ReviewCount >= 3
		entry.Score = calculateUIModelReviewRankingScore(entry)
	}

	if viewerId > 0 {
		usageMap, usageErr := GetUserModelReviewUsageMap(viewerId)
		if usageErr != nil {
			return nil, usageErr
		}
		var myReviews []*UIModelReview
		if err = DB.Where("user_id = ?", viewerId).Find(&myReviews).Error; err != nil {
			return nil, err
		}
		myReviewViews, err := BuildUIModelReviewViews(myReviews, viewerId)
		if err != nil {
			return nil, err
		}
		myReviewMap := map[string]*UIModelReviewView{}
		for _, review := range myReviewViews {
			myReviewMap[review.ModelName] = review
		}
		for name, usage := range usageMap {
			entry, ok := entryMap[name]
			if !ok {
				entry = &UIModelReviewRankingEntry{ModelName: name}
				entryMap[name] = entry
			}
			entry.MyUsage = usage
			entry.Eligible = usage.Eligible
		}
		for name, review := range myReviewMap {
			entry, ok := entryMap[name]
			if !ok {
				entry = &UIModelReviewRankingEntry{ModelName: name}
				entryMap[name] = entry
			}
			entry.MyReview = review
		}
	}

	entries := make([]*UIModelReviewRankingEntry, 0, len(entryMap))
	for _, entry := range entryMap {
		entry.Score = math.Round(entry.Score*10) / 10
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Score == entries[j].Score {
			if entries[i].ReviewCount == entries[j].ReviewCount {
				return entries[i].ModelName < entries[j].ModelName
			}
			return entries[i].ReviewCount > entries[j].ReviewCount
		}
		return entries[i].Score > entries[j].Score
	})

	var account *UIModelReviewPointAccount
	if viewerId > 0 {
		account, _ = GetUIModelReviewPointAccount(viewerId)
	}
	return &UIModelReviewRankingResponse{
		Entries:   entries,
		Settings:  setting,
		MyAccount: account,
		UpdatedAt: common.GetTimestamp(),
	}, nil
}

func calculateUIModelReviewRankingScore(entry *UIModelReviewRankingEntry) float64 {
	if entry == nil {
		return 0
	}
	reviews := float64(entry.ReviewCount)
	avg := entry.AverageRating
	if avg <= 0 {
		avg = uiModelReviewBayesPriorRating
	}
	bayes := ((avg * reviews) + uiModelReviewBayesPriorRating*uiModelReviewBayesPriorReviews) / (reviews + uiModelReviewBayesPriorReviews)
	ratingScore := bayes * 20
	usageScore := math.Min(math.Log10(float64(entry.UsageTokens)+10)*4, 18)
	helpfulScore := math.Min(float64(entry.HelpfulCount)*1.5, 10)
	qualityScore := math.Min(entry.AverageQuality/10, 10)
	featuredScore := math.Min(float64(entry.FeaturedCount)*3, 9)
	if entry.ReviewCount == 0 {
		ratingScore *= 0.55
	}
	return ratingScore*0.68 + usageScore*0.12 + helpfulScore + qualityScore + featuredScore
}

func MarkUIModelReviewHelpful(reviewId int64, userId int) (*UIModelReviewView, *UIModelReviewPointAccount, error) {
	if reviewId <= 0 || userId <= 0 {
		return nil, nil, errors.New("无效的评价")
	}
	var review UIModelReview
	if err := DB.First(&review, "id = ? AND status = ?", reviewId, UIModelReviewStatusVisible).Error; err != nil {
		return nil, nil, err
	}
	if review.UserId == userId {
		return nil, nil, errors.New("不能给自己的评价点有帮助")
	}
	now := common.GetTimestamp()
	helpful := &UIModelReviewHelpful{
		ReviewId:  review.Id,
		UserId:    userId,
		AuthorId:  review.UserId,
		CreatedAt: now,
	}
	err := DB.Create(helpful).Error
	if err != nil {
		return nil, nil, errors.New("已经点过有帮助")
	}
	if err = DB.Model(&UIModelReview{}).Where("id = ?", review.Id).Update("helpful_count", gorm.Expr("helpful_count + ?", 1)).Error; err != nil {
		return nil, nil, err
	}
	setting, err := GetUIModelReviewSetting()
	if err != nil {
		return nil, nil, err
	}
	remaining := setting.HelpfulRewardLimit - review.HelpfulPointsAwarded
	if remaining > 0 && setting.HelpfulPoints > 0 {
		pointsToGrant := minInt(setting.HelpfulPoints, remaining)
		granted, grantErr := GrantUIModelReviewPoints(review.UserId, review.Username, review.Id, review.ModelName, UIModelReviewPointTypeHelpful, pointsToGrant, "评价被点有帮助", userId)
		if grantErr != nil {
			return nil, nil, grantErr
		}
		if granted > 0 {
			if err = DB.Model(&UIModelReview{}).Where("id = ?", review.Id).Updates(map[string]interface{}{
				"helpful_points_awarded": gorm.Expr("helpful_points_awarded + ?", granted),
				"total_points_awarded":   gorm.Expr("total_points_awarded + ?", granted),
			}).Error; err != nil {
				return nil, nil, err
			}
		}
	}
	if err = DB.First(&review, review.Id).Error; err != nil {
		return nil, nil, err
	}
	account, _ := GetUIModelReviewPointAccount(review.UserId)
	return BuildUIModelReviewView(&review, userId, map[int64]bool{review.Id: true}), account, nil
}

func AdminPatchUIModelReview(reviewId int64, status string, featured *bool, featuredPoints *int, adminId int) (*UIModelReview, error) {
	if reviewId <= 0 {
		return nil, errors.New("无效的评价")
	}
	var review UIModelReview
	if err := DB.First(&review, reviewId).Error; err != nil {
		return nil, err
	}
	updates := map[string]interface{}{
		"updated_at": common.GetTimestamp(),
	}
	status = strings.TrimSpace(status)
	if status != "" {
		switch status {
		case UIModelReviewStatusVisible, UIModelReviewStatusHidden, UIModelReviewStatusPending:
			updates["status"] = status
			updates["reviewed_by"] = adminId
			updates["reviewed_at"] = common.GetTimestamp()
		default:
			return nil, errors.New("评价状态无效")
		}
	}
	if featured != nil {
		updates["featured"] = *featured
		updates["reviewed_by"] = adminId
		updates["reviewed_at"] = common.GetTimestamp()
		if *featured && !review.Featured {
			setting, err := GetUIModelReviewSetting()
			if err != nil {
				return nil, err
			}
			points := setting.FeaturedReviewPoints
			if featuredPoints != nil {
				points = *featuredPoints
			}
			if points > 0 {
				granted, grantErr := GrantUIModelReviewPoints(review.UserId, review.Username, review.Id, review.ModelName, UIModelReviewPointTypeFeatured, points, "管理员精选评价", adminId)
				if grantErr != nil {
					return nil, grantErr
				}
				if granted > 0 {
					updates["featured_points_awarded"] = gorm.Expr("featured_points_awarded + ?", granted)
					updates["total_points_awarded"] = gorm.Expr("total_points_awarded + ?", granted)
				}
			}
		}
	}
	if err := DB.Model(&UIModelReview{}).Where("id = ?", review.Id).Updates(updates).Error; err != nil {
		return nil, err
	}
	err := DB.First(&review, review.Id).Error
	return &review, err
}

func RedeemUIModelReviewPoints(userId int, points int) (*UIModelReviewPointAccount, int, error) {
	if userId <= 0 {
		return nil, 0, errors.New("无效的用户")
	}
	setting, err := GetUIModelReviewSetting()
	if err != nil {
		return nil, 0, err
	}
	if points <= 0 {
		return nil, 0, errors.New("兑换积分必须大于 0")
	}
	if points < setting.MinRedeemPoints {
		return nil, 0, fmt.Errorf("至少 %d 食评积分起兑", setting.MinRedeemPoints)
	}
	if points%setting.PointsPerQuota != 0 {
		return nil, 0, fmt.Errorf("兑换积分需为 %d 的整数倍", setting.PointsPerQuota)
	}
	quota := int(decimal.NewFromInt(int64(points)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Div(decimal.NewFromInt(int64(setting.PointsPerQuota))).
		IntPart())
	if quota <= 0 {
		return nil, 0, errors.New("兑换额度过小")
	}
	now := common.GetTimestamp()
	username, _ := GetUsernameById(userId, false)
	var account UIModelReviewPointAccount
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&account, "user_id = ?", userId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("暂无可兑换积分")
			}
			return err
		}
		if account.AvailablePoints < points {
			return errors.New("可用食评积分不足")
		}
		account.AvailablePoints -= points
		account.RedeemedPoints += points
		account.Username = username
		account.UpdatedAt = now
		if err := tx.Save(&account).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", quota)).Error; err != nil {
			return err
		}
		ledger := &UIModelReviewPointLedger{
			UserId:       userId,
			Username:     username,
			Type:         UIModelReviewPointTypeRedeem,
			Points:       -points,
			QuotaAwarded: quota,
			BalanceAfter: account.AvailablePoints,
			Note:         "食评积分兑换额度",
			CreatedAt:    now,
		}
		return tx.Create(ledger).Error
	})
	if err != nil {
		return nil, 0, err
	}
	_ = InvalidateUserCache(userId)
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("食评积分兑换额度：%d 积分兑换 %s", points, logger.LogQuota(quota)))
	return &account, quota, nil
}

func minInt(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
