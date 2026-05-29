package model

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UIRefundAppealStatusPending  = "pending"
	UIRefundAppealStatusApproved = "approved"
	UIRefundAppealStatusRejected = "rejected"

	uiRefundAppealWindowSeconds = 48 * 60 * 60
	uiRefundAppealMaxItems      = 50
	uiRefundAppealScanLimit     = 200
)

var ErrNoUIRefundCandidates = errors.New("暂无可提交的疑似空回记录")

// imageGenModelPrefixes lists model name prefixes for image/video generation.
// These requests return completion_tokens=0 by design and must not be treated as empty responses.
var imageGenModelPrefixes = []string{
	"grok-imagine", "grok-2-image",
	"gpt-image-", "chatgpt-image-", "dall-e-",
	"imagen", "flux", "seedream", "cogview", "kolors", "hidream",
}

type UIRefundAppeal struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"not null;index"`
	Username    string `json:"username" gorm:"type:varchar(191);default:'';index"`
	Status      string `json:"status" gorm:"type:varchar(32);default:'pending';index"`
	TotalItems  int    `json:"total_items" gorm:"default:0"`
	RefundQuota int    `json:"refund_quota" gorm:"default:0"`
	WindowStart int64  `json:"window_start" gorm:"default:0;index"`
	WindowEnd   int64  `json:"window_end" gorm:"default:0;index"`
	Reason      string `json:"reason" gorm:"type:varchar(500);default:''"`
	ReviewNote  string `json:"review_note" gorm:"type:varchar(500);default:''"`
	ReviewedBy  int    `json:"reviewed_by" gorm:"default:0;index"`
	ReviewedAt  int64  `json:"reviewed_at" gorm:"default:0"`
	CreatedAt   int64  `json:"created_at" gorm:"default:0;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"default:0"`
}

func (UIRefundAppeal) TableName() string {
	return "ui_refund_appeals"
}

type UIRefundAppealItem struct {
	Id               int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	AppealId         int64  `json:"appeal_id" gorm:"not null;index"`
	UserId           int    `json:"user_id" gorm:"not null;index"`
	LogId            int    `json:"log_id" gorm:"not null;uniqueIndex"`
	Status           string `json:"status" gorm:"type:varchar(32);default:'pending';index"`
	LogCreatedAt     int64  `json:"log_created_at" gorm:"default:0;index"`
	ModelName        string `json:"model_name" gorm:"type:varchar(191);default:''"`
	TokenName        string `json:"token_name" gorm:"type:varchar(191);default:''"`
	RequestId        string `json:"request_id" gorm:"type:varchar(64);default:'';index"`
	ChannelId        int    `json:"channel_id" gorm:"default:0;index"`
	Group            string `json:"group" gorm:"type:varchar(64);default:''"`
	Quota            int    `json:"quota" gorm:"default:0"`
	PromptTokens     int    `json:"prompt_tokens" gorm:"default:0"`
	CompletionTokens int    `json:"completion_tokens" gorm:"default:0"`
	UseTime          int    `json:"use_time" gorm:"default:0"`
	IsStream         bool   `json:"is_stream" gorm:"default:false"`
	Content          string `json:"content" gorm:"type:text"`
	CreatedAt        int64  `json:"created_at" gorm:"default:0"`
	UpdatedAt        int64  `json:"updated_at" gorm:"default:0"`
}

func (UIRefundAppealItem) TableName() string {
	return "ui_refund_appeal_items"
}

type UIRefundCandidate struct {
	LogId            int    `json:"log_id"`
	LogCreatedAt     int64  `json:"log_created_at"`
	ModelName        string `json:"model_name"`
	TokenName        string `json:"token_name"`
	RequestId        string `json:"request_id"`
	ChannelId        int    `json:"channel_id"`
	Group            string `json:"group"`
	Quota            int    `json:"quota"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	UseTime          int    `json:"use_time"`
	IsStream         bool   `json:"is_stream"`
	Content          string `json:"content"`
}

type UIRefundCandidateSummary struct {
	Available       bool                 `json:"available"`
	Count           int                  `json:"count"`
	RefundQuota     int                  `json:"refund_quota"`
	WindowStart     int64                `json:"window_start"`
	WindowEnd       int64                `json:"window_end"`
	Cutoff          int64                `json:"cutoff"`
	PendingCount    int64                `json:"pending_count"`
	LatestPendingAt int64                `json:"latest_pending_at"`
	Items           []*UIRefundCandidate `json:"items,omitempty"`
}

type UIRefundAppealBatchApproveResult struct {
	Total       int64             `json:"total"`
	Approved    int               `json:"approved"`
	Failed      int               `json:"failed"`
	RefundQuota int               `json:"refund_quota"`
	Appeals     []*UIRefundAppeal `json:"appeals"`
	Errors      []string          `json:"errors"`
}

func uiRefundAppealConfiguredCutoff() int64 {
	raw := strings.TrimSpace(os.Getenv("UI_REFUND_APPEAL_START_AT"))
	if raw == "" {
		return 0
	}
	if ts, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return ts
	}
	layouts := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
			return t.Unix()
		}
	}
	common.SysLog("invalid UI_REFUND_APPEAL_START_AT: " + raw)
	return 0
}

func uiRefundAppealWindow() (int64, int64, int64) {
	now := common.GetTimestamp()
	cutoff := uiRefundAppealConfiguredCutoff()
	start := now - uiRefundAppealWindowSeconds
	if cutoff > start {
		start = cutoff
	}
	return start, now, cutoff
}

func logToUIRefundCandidate(log *Log) *UIRefundCandidate {
	if log == nil {
		return nil
	}
	return &UIRefundCandidate{
		LogId:            log.Id,
		LogCreatedAt:     log.CreatedAt,
		ModelName:        log.ModelName,
		TokenName:        log.TokenName,
		RequestId:        log.RequestId,
		ChannelId:        log.ChannelId,
		Group:            log.Group,
		Quota:            log.Quota,
		PromptTokens:     log.PromptTokens,
		CompletionTokens: log.CompletionTokens,
		UseTime:          log.UseTime,
		IsStream:         log.IsStream,
		Content:          log.Content,
	}
}

func candidateToUIRefundAppealItem(appealId int64, userId int, candidate *UIRefundCandidate, now int64) *UIRefundAppealItem {
	return &UIRefundAppealItem{
		AppealId:         appealId,
		UserId:           userId,
		LogId:            candidate.LogId,
		Status:           UIRefundAppealStatusPending,
		LogCreatedAt:     candidate.LogCreatedAt,
		ModelName:        candidate.ModelName,
		TokenName:        candidate.TokenName,
		RequestId:        candidate.RequestId,
		ChannelId:        candidate.ChannelId,
		Group:            candidate.Group,
		Quota:            candidate.Quota,
		PromptTokens:     candidate.PromptTokens,
		CompletionTokens: candidate.CompletionTokens,
		UseTime:          candidate.UseTime,
		IsStream:         candidate.IsStream,
		Content:          candidate.Content,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

func GetUIRefundCandidates(userId int, includeItems bool) (*UIRefundCandidateSummary, error) {
	if userId <= 0 {
		return nil, errors.New("无效的用户 ID")
	}
	windowStart, windowEnd, cutoff := uiRefundAppealWindow()
	summary := &UIRefundCandidateSummary{
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		Cutoff:      cutoff,
	}

	var pending struct {
		Count     int64 `gorm:"column:count"`
		CreatedAt int64 `gorm:"column:created_at"`
	}
	if err := DB.Model(&UIRefundAppeal{}).
		Select("COUNT(*) as count, COALESCE(MAX(created_at), 0) as created_at").
		Where("user_id = ? AND status = ?", userId, UIRefundAppealStatusPending).
		Scan(&pending).Error; err != nil {
		return nil, err
	}
	summary.PendingCount = pending.Count
	summary.LatestPendingAt = pending.CreatedAt

	var logs []*Log
	q := LOG_DB.Where("user_id = ? AND type = ? AND created_at >= ? AND created_at <= ? AND quota > ? AND completion_tokens = ?",
		userId, LogTypeConsume, windowStart, windowEnd, 0, 0)
	for _, prefix := range imageGenModelPrefixes {
		q = q.Where("model_name NOT LIKE ?", prefix+"%")
	}
	err := q.Order("id desc").
		Limit(uiRefundAppealScanLimit).
		Find(&logs).Error
	if err != nil {
		return nil, err
	}
	if len(logs) == 0 {
		return summary, nil
	}

	logIds := make([]int, 0, len(logs))
	for _, log := range logs {
		logIds = append(logIds, log.Id)
	}
	var existingItems []UIRefundAppealItem
	if err = DB.Select("log_id").Where("log_id IN ?", logIds).Find(&existingItems).Error; err != nil {
		return nil, err
	}
	existing := make(map[int]struct{}, len(existingItems))
	for _, item := range existingItems {
		existing[item.LogId] = struct{}{}
	}

	items := make([]*UIRefundCandidate, 0, len(logs))
	totalQuota := 0
	for _, log := range logs {
		if _, ok := existing[log.Id]; ok {
			continue
		}
		if log.Quota <= 0 || log.CompletionTokens != 0 {
			continue
		}
		candidate := logToUIRefundCandidate(log)
		items = append(items, candidate)
		totalQuota += candidate.Quota
		if len(items) >= uiRefundAppealMaxItems {
			break
		}
	}
	summary.Count = len(items)
	summary.RefundQuota = totalQuota
	summary.Available = summary.Count > 0
	if includeItems {
		summary.Items = items
	}
	return summary, nil
}

func CreateUIRefundAppeal(userId int, reason string) (*UIRefundAppeal, []*UIRefundAppealItem, error) {
	summary, err := GetUIRefundCandidates(userId, true)
	if err != nil {
		return nil, nil, err
	}
	if summary.Count == 0 {
		return nil, nil, ErrNoUIRefundCandidates
	}

	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) > 500 {
		return nil, nil, errors.New("补偿说明不能超过 500 个字符")
	}
	username, _ := GetUsernameById(userId, false)
	now := common.GetTimestamp()
	appeal := &UIRefundAppeal{
		UserId:      userId,
		Username:    username,
		Status:      UIRefundAppealStatusPending,
		WindowStart: summary.WindowStart,
		WindowEnd:   summary.WindowEnd,
		Reason:      reason,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	items := make([]*UIRefundAppealItem, 0, len(summary.Items))

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(appeal).Error; err != nil {
			return err
		}

		totalItems := 0
		refundQuota := 0
		for _, candidate := range summary.Items {
			item := candidateToUIRefundAppealItem(appeal.Id, userId, candidate, now)
			result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(item)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				continue
			}
			totalItems++
			refundQuota += item.Quota
			items = append(items, item)
		}
		if totalItems == 0 {
			return ErrNoUIRefundCandidates
		}
		appeal.TotalItems = totalItems
		appeal.RefundQuota = refundQuota
		return tx.Model(&UIRefundAppeal{}).Where("id = ?", appeal.Id).Updates(map[string]interface{}{
			"total_items":  totalItems,
			"refund_quota": refundQuota,
			"updated_at":   now,
		}).Error
	})
	if err != nil {
		return nil, nil, err
	}
	return appeal, items, nil
}

func GetUserUIRefundAppeals(userId int, pageInfo *common.PageInfo) (appeals []*UIRefundAppeal, total int64, err error) {
	query := DB.Model(&UIRefundAppeal{}).Where("user_id = ?", userId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&appeals).Error
	return appeals, total, err
}

func GetAdminUIRefundAppeals(pageInfo *common.PageInfo, status string, keyword string) (appeals []*UIRefundAppeal, total int64, err error) {
	query := DB.Model(&UIRefundAppeal{})
	status = strings.TrimSpace(status)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where("id = ? OR user_id = ? OR username LIKE ?", id, id, "%"+keyword+"%")
		} else {
			query = query.Where("username LIKE ?", "%"+keyword+"%")
		}
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&appeals).Error
	return appeals, total, err
}

func GetUIRefundAppealWithItems(id int64) (*UIRefundAppeal, []*UIRefundAppealItem, error) {
	if id <= 0 {
		return nil, nil, errors.New("无效的申诉 ID")
	}
	var appeal UIRefundAppeal
	if err := DB.Where("id = ?", id).First(&appeal).Error; err != nil {
		return nil, nil, err
	}
	var items []*UIRefundAppealItem
	if err := DB.Where("appeal_id = ?", id).Order("log_created_at desc").Find(&items).Error; err != nil {
		return nil, nil, err
	}
	return &appeal, items, nil
}

func ApproveUIRefundAppeal(id int64, adminId int, reviewNote string) (*UIRefundAppeal, error) {
	if id <= 0 {
		return nil, errors.New("无效的申诉 ID")
	}
	reviewNote = strings.TrimSpace(reviewNote)
	if len([]rune(reviewNote)) > 500 {
		return nil, errors.New("审核备注不能超过 500 个字符")
	}
	now := common.GetTimestamp()
	var appeal UIRefundAppeal
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND status = ?", id, UIRefundAppealStatusPending).
			First(&appeal).Error; err != nil {
			return err
		}
		if appeal.RefundQuota <= 0 || appeal.TotalItems <= 0 {
			return errors.New("申诉单补偿额度无效")
		}
		if err := tx.Model(&User{}).Where("id = ?", appeal.UserId).
			Update("quota", gorm.Expr("quota + ?", appeal.RefundQuota)).Error; err != nil {
			return err
		}
		if err := tx.Model(&UIRefundAppeal{}).Where("id = ? AND status = ?", appeal.Id, UIRefundAppealStatusPending).
			Updates(map[string]interface{}{
				"status":      UIRefundAppealStatusApproved,
				"review_note": reviewNote,
				"reviewed_by": adminId,
				"reviewed_at": now,
				"updated_at":  now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&UIRefundAppealItem{}).Where("appeal_id = ?", appeal.Id).
			Updates(map[string]interface{}{
				"status":     UIRefundAppealStatusApproved,
				"updated_at": now,
			}).Error
	})
	if err != nil {
		return nil, err
	}
	appeal.Status = UIRefundAppealStatusApproved
	appeal.ReviewNote = reviewNote
	appeal.ReviewedBy = adminId
	appeal.ReviewedAt = now
	appeal.UpdatedAt = now
	content := fmt.Sprintf("空回补偿审核通过，申诉单 #%d，补偿 %s 额度，包含 %d 条疑似空回记录",
		appeal.Id, logger.LogQuota(appeal.RefundQuota), appeal.TotalItems)
	RecordLogWithAdminInfo(appeal.UserId, LogTypeManage, content, map[string]interface{}{
		"appeal_id":    appeal.Id,
		"reviewed_by":  adminId,
		"refund_quota": appeal.RefundQuota,
		"total_items":  appeal.TotalItems,
	})
	return &appeal, nil
}

func ApproveAllPendingUIRefundAppeals(adminId int, reviewNote string) (*UIRefundAppealBatchApproveResult, error) {
	reviewNote = strings.TrimSpace(reviewNote)
	if len([]rune(reviewNote)) > 500 {
		return nil, errors.New("审核备注不能超过 500 个字符")
	}
	var ids []int64
	if err := DB.Model(&UIRefundAppeal{}).
		Where("status = ?", UIRefundAppealStatusPending).
		Order("id asc").
		Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	result := &UIRefundAppealBatchApproveResult{
		Total:   int64(len(ids)),
		Appeals: make([]*UIRefundAppeal, 0, len(ids)),
		Errors:  make([]string, 0),
	}
	for _, id := range ids {
		appeal, err := ApproveUIRefundAppeal(id, adminId, reviewNote)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("申诉单 #%d：%s", id, err.Error()))
			continue
		}
		result.Approved++
		result.RefundQuota += appeal.RefundQuota
		result.Appeals = append(result.Appeals, appeal)
	}
	return result, nil
}

func RejectUIRefundAppeal(id int64, adminId int, reviewNote string) (*UIRefundAppeal, error) {
	if id <= 0 {
		return nil, errors.New("无效的申诉 ID")
	}
	reviewNote = strings.TrimSpace(reviewNote)
	if reviewNote == "" {
		return nil, errors.New("驳回原因不能为空")
	}
	if len([]rune(reviewNote)) > 500 {
		return nil, errors.New("驳回原因不能超过 500 个字符")
	}
	now := common.GetTimestamp()
	var appeal UIRefundAppeal
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND status = ?", id, UIRefundAppealStatusPending).
			First(&appeal).Error; err != nil {
			return err
		}
		if err := tx.Model(&UIRefundAppeal{}).Where("id = ? AND status = ?", appeal.Id, UIRefundAppealStatusPending).
			Updates(map[string]interface{}{
				"status":      UIRefundAppealStatusRejected,
				"review_note": reviewNote,
				"reviewed_by": adminId,
				"reviewed_at": now,
				"updated_at":  now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&UIRefundAppealItem{}).Where("appeal_id = ?", appeal.Id).
			Updates(map[string]interface{}{
				"status":     UIRefundAppealStatusRejected,
				"updated_at": now,
			}).Error
	})
	if err != nil {
		return nil, err
	}
	appeal.Status = UIRefundAppealStatusRejected
	appeal.ReviewNote = reviewNote
	appeal.ReviewedBy = adminId
	appeal.ReviewedAt = now
	appeal.UpdatedAt = now
	return &appeal, nil
}
