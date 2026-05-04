package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UINotificationCategoryAnnouncement = "announcement"
	UINotificationCategoryBilling      = "billing"
	UINotificationCategoryAppeal       = "appeal"
	UINotificationCategorySystem       = "system"

	UINotificationLevelInfo    = "info"
	UINotificationLevelSuccess = "success"
	UINotificationLevelWarning = "warning"
	UINotificationLevelError   = "error"

	UINotificationTargetAll   = "all"
	UINotificationTargetUser  = "user"
	UINotificationTargetGroup = "group"
	UINotificationTargetAdmin = "admin"

	UINotificationFormatPlain    = "plain"
	UINotificationFormatMarkdown = "markdown"

	UINotificationSourceAnnouncement = "announcement"
	UINotificationSourceTopUp        = "topup"
	UINotificationSourceRedemption   = "redemption"
	UINotificationSourceRefundAppeal = "refund_appeal"
	UINotificationSourceManual       = "manual"
)

var ErrUINotificationRequiresAck = errors.New("该通知需要点击确认")

var ErrUINotificationSettingTableMissing = errors.New("通知设置表 ui_notification_settings 不存在，请先完成数据库迁移")

type UINotification struct {
	Id            int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title         string `json:"title" gorm:"type:varchar(191);not null"`
	Summary       string `json:"summary" gorm:"type:varchar(500);default:''"`
	Content       string `json:"content" gorm:"type:text"`
	ContentFormat string `json:"content_format" gorm:"type:varchar(32);default:'plain'"`
	Category      string `json:"category" gorm:"type:varchar(32);default:'system';index:idx_ui_notifications_category_enabled_created,priority:1"`
	Level         string `json:"level" gorm:"type:varchar(32);default:'info'"`
	SourceType    string `json:"source_type" gorm:"type:varchar(64);default:'';index:idx_ui_notifications_source,priority:1"`
	SourceKey     string `json:"source_key" gorm:"type:varchar(191);default:'';index:idx_ui_notifications_source,priority:2"`
	SourceId      int64  `json:"source_id" gorm:"default:0;index"`
	SourceVersion int    `json:"source_version" gorm:"default:0"`
	TargetType    string `json:"target_type" gorm:"type:varchar(32);default:'all';index:idx_ui_notifications_target,priority:1"`
	TargetUserId  int    `json:"target_user_id" gorm:"default:0;index:idx_ui_notifications_target,priority:2"`
	TargetGroup   string `json:"target_group" gorm:"type:varchar(64);default:'';index:idx_ui_notifications_target,priority:3"`
	ActionUrl     string `json:"action_url" gorm:"type:varchar(500);default:''"`
	Popup         bool   `json:"popup" gorm:"default:false;index"`
	RequireAck    bool   `json:"require_ack" gorm:"default:false;index"`
	Pinned        bool   `json:"pinned" gorm:"default:false;index:idx_ui_notifications_category_enabled_created,priority:3"`
	Enabled       bool   `json:"enabled" gorm:"default:true;index:idx_ui_notifications_category_enabled_created,priority:2"`
	Priority      int    `json:"priority" gorm:"default:0;index"`
	StartsAt      int64  `json:"starts_at" gorm:"default:0;index:idx_ui_notifications_time,priority:1"`
	EndsAt        int64  `json:"ends_at" gorm:"default:0;index:idx_ui_notifications_time,priority:2"`
	CreatedBy     int    `json:"created_by" gorm:"default:0"`
	UpdatedBy     int    `json:"updated_by" gorm:"default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"default:0;index:idx_ui_notifications_category_enabled_created,priority:4"`
	UpdatedAt     int64  `json:"updated_at" gorm:"default:0"`
	DeletedAt     int64  `json:"deleted_at" gorm:"default:0;index"`
}

func (UINotification) TableName() string {
	return "ui_notifications"
}

type UINotificationRead struct {
	Id             int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	NotificationId int64 `json:"notification_id" gorm:"not null;uniqueIndex:idx_ui_notification_reads_unique,priority:1;index"`
	UserId         int   `json:"user_id" gorm:"not null;uniqueIndex:idx_ui_notification_reads_unique,priority:2;index"`
	ReadAt         int64 `json:"read_at" gorm:"default:0;index"`
	AcknowledgedAt int64 `json:"acknowledged_at" gorm:"default:0;index"`
	CreatedAt      int64 `json:"created_at" gorm:"default:0"`
	UpdatedAt      int64 `json:"updated_at" gorm:"default:0"`
}

func (UINotificationRead) TableName() string {
	return "ui_notification_reads"
}

type UINotificationSetting struct {
	Id                        int   `json:"id" gorm:"primaryKey"`
	BillingEnabled            bool  `json:"billing_enabled" gorm:"default:true"`
	BillingRequireAck         bool  `json:"billing_require_ack" gorm:"default:false"`
	AppealSubmittedEnabled    bool  `json:"appeal_submitted_enabled" gorm:"default:true"`
	AppealSubmittedRequireAck bool  `json:"appeal_submitted_require_ack" gorm:"default:false"`
	AppealApprovedEnabled     bool  `json:"appeal_approved_enabled" gorm:"default:true"`
	AppealApprovedRequireAck  bool  `json:"appeal_approved_require_ack" gorm:"default:false"`
	AppealRejectedEnabled     bool  `json:"appeal_rejected_enabled" gorm:"default:true"`
	AppealRejectedRequireAck  bool  `json:"appeal_rejected_require_ack" gorm:"default:false"`
	CreatedAt                 int64 `json:"created_at" gorm:"default:0"`
	UpdatedAt                 int64 `json:"updated_at" gorm:"default:0"`
}

func (UINotificationSetting) TableName() string {
	return "ui_notification_settings"
}

type UINotificationView struct {
	UINotification
	ReadAt         int64 `json:"read_at"`
	AcknowledgedAt int64 `json:"acknowledged_at"`
	Unread         bool  `json:"unread"`
	Acknowledged   bool  `json:"acknowledged"`
}

type UINotificationListOptions struct {
	Category   string
	UnreadOnly bool
}

func defaultUINotificationSetting() *UINotificationSetting {
	now := common.GetTimestamp()
	return &UINotificationSetting{
		Id:                     1,
		BillingEnabled:         true,
		AppealSubmittedEnabled: true,
		AppealApprovedEnabled:  true,
		AppealRejectedEnabled:  true,
		CreatedAt:              now,
		UpdatedAt:              now,
	}
}

func GetUINotificationSetting() (*UINotificationSetting, error) {
	if DB == nil {
		return defaultUINotificationSetting(), nil
	}
	if !DB.Migrator().HasTable(UINotificationSetting{}.TableName()) {
		return defaultUINotificationSetting(), nil
	}
	var setting UINotificationSetting
	err := DB.First(&setting, "id = ?", 1).Error
	if err == nil {
		return &setting, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	settingPtr := defaultUINotificationSetting()
	if err = DB.Create(settingPtr).Error; err != nil {
		return nil, err
	}
	return settingPtr, nil
}

func SaveUINotificationSetting(setting *UINotificationSetting) error {
	if setting == nil {
		return errors.New("通知设置不能为空")
	}
	if DB == nil || !DB.Migrator().HasTable(UINotificationSetting{}.TableName()) {
		return ErrUINotificationSettingTableMissing
	}
	now := common.GetTimestamp()
	setting.Id = 1
	if setting.CreatedAt == 0 {
		setting.CreatedAt = now
	}
	setting.UpdatedAt = now
	return DB.Save(setting).Error
}

type uiNotificationUserScope struct {
	Group string
	Role  int
}

func NormalizeUINotification(n *UINotification) {
	n.Title = strings.TrimSpace(n.Title)
	n.Summary = strings.TrimSpace(n.Summary)
	n.Content = strings.TrimSpace(n.Content)
	n.ContentFormat = strings.TrimSpace(n.ContentFormat)
	n.Category = strings.TrimSpace(n.Category)
	n.Level = strings.TrimSpace(n.Level)
	n.SourceType = strings.TrimSpace(n.SourceType)
	n.SourceKey = strings.TrimSpace(n.SourceKey)
	n.TargetType = strings.TrimSpace(n.TargetType)
	n.TargetGroup = strings.TrimSpace(n.TargetGroup)
	n.ActionUrl = strings.TrimSpace(n.ActionUrl)
	if n.ContentFormat == "" {
		n.ContentFormat = UINotificationFormatPlain
	}
	if n.Category == "" {
		n.Category = UINotificationCategorySystem
	}
	if n.Level == "" {
		n.Level = UINotificationLevelInfo
	}
	if n.TargetType == "" {
		if n.TargetUserId > 0 {
			n.TargetType = UINotificationTargetUser
		} else {
			n.TargetType = UINotificationTargetAll
		}
	}
}

func ValidateUINotification(n *UINotification) error {
	if n == nil {
		return errors.New("通知不能为空")
	}
	NormalizeUINotification(n)
	if n.Title == "" {
		return errors.New("通知标题不能为空")
	}
	if len([]rune(n.Title)) > 191 {
		return errors.New("通知标题不能超过 191 个字符")
	}
	if len([]rune(n.Summary)) > 500 {
		return errors.New("通知摘要不能超过 500 个字符")
	}
	if len([]rune(n.ActionUrl)) > 500 {
		return errors.New("通知跳转地址不能超过 500 个字符")
	}
	switch n.Category {
	case UINotificationCategoryAnnouncement, UINotificationCategoryBilling, UINotificationCategoryAppeal, UINotificationCategorySystem:
	default:
		return errors.New("通知类型无效")
	}
	switch n.Level {
	case UINotificationLevelInfo, UINotificationLevelSuccess, UINotificationLevelWarning, UINotificationLevelError:
	default:
		return errors.New("通知级别无效")
	}
	switch n.TargetType {
	case UINotificationTargetAll:
		n.TargetUserId = 0
		n.TargetGroup = ""
	case UINotificationTargetUser:
		if n.TargetUserId <= 0 {
			return errors.New("定向用户通知必须指定用户 ID")
		}
		n.TargetGroup = ""
	case UINotificationTargetGroup:
		if n.TargetGroup == "" {
			return errors.New("分组通知必须指定分组")
		}
		n.TargetUserId = 0
	case UINotificationTargetAdmin:
		n.TargetUserId = 0
		n.TargetGroup = ""
	default:
		return errors.New("通知目标无效")
	}
	if n.StartsAt != 0 && n.EndsAt != 0 && n.StartsAt > n.EndsAt {
		return errors.New("通知开始时间不能晚于结束时间")
	}
	return nil
}

func getUINotificationUserScope(userId int) (*uiNotificationUserScope, error) {
	if userId <= 0 {
		return nil, errors.New("无效的用户 ID")
	}
	var user User
	if err := DB.Model(&User{}).Select("role, "+commonGroupCol).Where("id = ?", userId).First(&user).Error; err != nil {
		return nil, err
	}
	return &uiNotificationUserScope{Group: user.Group, Role: user.Role}, nil
}

func activeUINotificationQuery(tx *gorm.DB, now int64) *gorm.DB {
	return tx.Where("ui_notifications.deleted_at = ?", 0).
		Where("ui_notifications.enabled = ?", true).
		Where("(ui_notifications.starts_at = ? OR ui_notifications.starts_at <= ?)", 0, now).
		Where("(ui_notifications.ends_at = ? OR ui_notifications.ends_at >= ?)", 0, now)
}

func applyUINotificationTargetScope(tx *gorm.DB, scope *uiNotificationUserScope, userId int) *gorm.DB {
	args := []interface{}{
		UINotificationTargetAll,
		UINotificationTargetUser, userId,
		UINotificationTargetGroup, scope.Group,
	}
	condition := "(ui_notifications.target_type = ? OR (ui_notifications.target_type = ? AND ui_notifications.target_user_id = ?) OR (ui_notifications.target_type = ? AND ui_notifications.target_group = ?)"
	if scope.Role >= common.RoleAdminUser {
		condition += " OR ui_notifications.target_type = ?"
		args = append(args, UINotificationTargetAdmin)
	}
	condition += ")"
	return tx.Where(condition, args...)
}

func userUINotificationBaseQuery(userId int) (*gorm.DB, error) {
	scope, err := getUINotificationUserScope(userId)
	if err != nil {
		return nil, err
	}
	query := activeUINotificationQuery(DB.Model(&UINotification{}), common.GetTimestamp())
	return applyUINotificationTargetScope(query, scope, userId), nil
}

func uiNotificationOrder(tx *gorm.DB) *gorm.DB {
	return tx.Order("ui_notifications.pinned desc").
		Order("ui_notifications.priority desc").
		Order("ui_notifications.created_at desc").
		Order("ui_notifications.id desc")
}

func applyUINotificationReadJoin(tx *gorm.DB, userId int) *gorm.DB {
	return tx.Joins("LEFT JOIN ui_notification_reads unread_state ON unread_state.notification_id = ui_notifications.id AND unread_state.user_id = ? AND unread_state.read_at > ?", userId, 0)
}

func ListUserUINotifications(userId int, pageInfo *common.PageInfo, options UINotificationListOptions) (views []*UINotificationView, total int64, err error) {
	query, err := userUINotificationBaseQuery(userId)
	if err != nil {
		return nil, 0, err
	}
	options.Category = strings.TrimSpace(options.Category)
	if options.Category != "" {
		query = query.Where("ui_notifications.category = ?", options.Category)
	}
	query = applyUINotificationReadJoin(query, userId)
	if options.UnreadOnly {
		query = query.Where("unread_state.id IS NULL")
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var notifications []*UINotification
	if err = uiNotificationOrder(query.Select("ui_notifications.*")).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}
	views, _, err = buildUINotificationViews(userId, notifications)
	return views, total, err
}

func buildUINotificationViews(userId int, notifications []*UINotification) ([]*UINotificationView, int64, error) {
	ids := make([]int64, 0, len(notifications))
	for _, notification := range notifications {
		if notification != nil {
			ids = append(ids, notification.Id)
		}
	}
	readMap := make(map[int64]UINotificationRead, len(ids))
	if len(ids) > 0 {
		var reads []UINotificationRead
		if err := DB.Where("user_id = ? AND notification_id IN ?", userId, ids).Find(&reads).Error; err != nil {
			return nil, 0, err
		}
		for _, read := range reads {
			readMap[read.NotificationId] = read
		}
	}
	views := make([]*UINotificationView, 0, len(notifications))
	for _, notification := range notifications {
		if notification == nil {
			continue
		}
		read := readMap[notification.Id]
		view := &UINotificationView{
			UINotification: *notification,
			ReadAt:         read.ReadAt,
			AcknowledgedAt: read.AcknowledgedAt,
			Unread:         read.ReadAt == 0,
			Acknowledged:   read.AcknowledgedAt > 0,
		}
		views = append(views, view)
	}
	return views, int64(len(views)), nil
}

func CountUnreadUINotifications(userId int) (int64, error) {
	query, err := userUINotificationBaseQuery(userId)
	if err != nil {
		return 0, err
	}
	query = applyUINotificationReadJoin(query, userId).Where("unread_state.id IS NULL")
	var total int64
	err = query.Count(&total).Error
	return total, err
}

func GetUserUINotificationById(userId int, id int64) (*UINotification, error) {
	if id <= 0 {
		return nil, errors.New("无效的通知 ID")
	}
	query, err := userUINotificationBaseQuery(userId)
	if err != nil {
		return nil, err
	}
	var notification UINotification
	if err = query.Where("ui_notifications.id = ?", id).First(&notification).Error; err != nil {
		return nil, err
	}
	return &notification, nil
}

func MarkUINotificationRead(userId int, id int64, acknowledge bool) (*UINotification, error) {
	notification, err := GetUserUINotificationById(userId, id)
	if err != nil {
		return nil, err
	}
	if notification.RequireAck && !acknowledge {
		return nil, ErrUINotificationRequiresAck
	}
	if err = upsertUINotificationRead(userId, notification.Id, acknowledge); err != nil {
		return nil, err
	}
	return notification, nil
}

func MarkUINotificationReadBySource(userId int, sourceType string, sourceKey string, acknowledge bool) error {
	sourceType = strings.TrimSpace(sourceType)
	sourceKey = strings.TrimSpace(sourceKey)
	if sourceType == "" || sourceKey == "" {
		return nil
	}
	query, err := userUINotificationBaseQuery(userId)
	if err != nil {
		return err
	}
	var notifications []*UINotification
	if err = query.Where("ui_notifications.source_type = ? AND ui_notifications.source_key = ?", sourceType, sourceKey).Find(&notifications).Error; err != nil {
		return err
	}
	for _, notification := range notifications {
		if notification == nil {
			continue
		}
		if err = upsertUINotificationRead(userId, notification.Id, acknowledge); err != nil {
			return err
		}
	}
	return nil
}

func MarkAllReadableUINotificationsRead(userId int) (int64, error) {
	query, err := userUINotificationBaseQuery(userId)
	if err != nil {
		return 0, err
	}
	query = applyUINotificationReadJoin(query, userId).
		Where("unread_state.id IS NULL").
		Where("ui_notifications.require_ack = ?", false)
	var notifications []*UINotification
	if err = query.Select("ui_notifications.*").Find(&notifications).Error; err != nil {
		return 0, err
	}
	for _, notification := range notifications {
		if notification == nil {
			continue
		}
		if err = upsertUINotificationRead(userId, notification.Id, false); err != nil {
			return 0, err
		}
	}
	return int64(len(notifications)), nil
}

func upsertUINotificationRead(userId int, notificationId int64, acknowledge bool) error {
	now := common.GetTimestamp()
	read := UINotificationRead{
		NotificationId: notificationId,
		UserId:         userId,
		ReadAt:         now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	assignments := map[string]interface{}{
		"read_at":    now,
		"updated_at": now,
	}
	if acknowledge {
		read.AcknowledgedAt = now
		assignments["acknowledged_at"] = now
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "notification_id"},
			{Name: "user_id"},
		},
		DoUpdates: clause.Assignments(assignments),
	}).Create(&read).Error
}

func GetAdminUINotifications(pageInfo *common.PageInfo, category string, targetType string, keyword string, enabled *bool) (notifications []*UINotification, total int64, err error) {
	query := DB.Model(&UINotification{}).Where("deleted_at = ?", 0)
	category = strings.TrimSpace(category)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	targetType = strings.TrimSpace(targetType)
	if targetType != "" {
		query = query.Where("target_type = ?", targetType)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		if id, convErr := parseInt64(keyword); convErr == nil {
			query = query.Where("id = ? OR source_id = ? OR target_user_id = ? OR title LIKE ? OR summary LIKE ?", id, id, id, "%"+keyword+"%", "%"+keyword+"%")
		} else {
			query = query.Where("title LIKE ? OR summary LIKE ? OR source_key LIKE ?", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%")
		}
	}
	if enabled != nil {
		query = query.Where("enabled = ?", *enabled)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = uiNotificationOrder(query).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&notifications).Error
	return notifications, total, err
}

func parseInt64(value string) (int64, error) {
	var result int64
	_, err := fmt.Sscanf(value, "%d", &result)
	return result, err
}

func GetUINotificationById(id int64) (*UINotification, error) {
	if id <= 0 {
		return nil, errors.New("无效的通知 ID")
	}
	var notification UINotification
	if err := DB.Where("id = ? AND deleted_at = ?", id, 0).First(&notification).Error; err != nil {
		return nil, err
	}
	return &notification, nil
}

func CreateUINotification(notification *UINotification) error {
	if err := ValidateUINotification(notification); err != nil {
		return err
	}
	now := common.GetTimestamp()
	notification.Id = 0
	notification.CreatedAt = now
	notification.UpdatedAt = now
	return DB.Create(notification).Error
}

func UpdateUINotification(notification *UINotification) error {
	if err := ValidateUINotification(notification); err != nil {
		return err
	}
	notification.UpdatedAt = common.GetTimestamp()
	return DB.Model(&UINotification{}).
		Where("id = ? AND deleted_at = ?", notification.Id, 0).
		Updates(map[string]interface{}{
			"title":          notification.Title,
			"summary":        notification.Summary,
			"content":        notification.Content,
			"content_format": notification.ContentFormat,
			"category":       notification.Category,
			"level":          notification.Level,
			"source_type":    notification.SourceType,
			"source_key":     notification.SourceKey,
			"source_id":      notification.SourceId,
			"source_version": notification.SourceVersion,
			"target_type":    notification.TargetType,
			"target_user_id": notification.TargetUserId,
			"target_group":   notification.TargetGroup,
			"action_url":     notification.ActionUrl,
			"popup":          notification.Popup,
			"require_ack":    notification.RequireAck,
			"pinned":         notification.Pinned,
			"enabled":        notification.Enabled,
			"priority":       notification.Priority,
			"starts_at":      notification.StartsAt,
			"ends_at":        notification.EndsAt,
			"updated_by":     notification.UpdatedBy,
			"updated_at":     notification.UpdatedAt,
		}).Error
}

func DeleteUINotificationById(id int64, updatedBy int) error {
	now := common.GetTimestamp()
	return DB.Model(&UINotification{}).
		Where("id = ? AND deleted_at = ?", id, 0).
		Updates(map[string]interface{}{
			"enabled":    false,
			"updated_by": updatedBy,
			"updated_at": now,
			"deleted_at": now,
		}).Error
}

func UpsertSourceUINotification(notification *UINotification) error {
	if err := ValidateUINotification(notification); err != nil {
		return err
	}
	if notification.SourceType == "" || notification.SourceKey == "" {
		return CreateUINotification(notification)
	}
	now := common.GetTimestamp()
	var existing UINotification
	err := DB.Where("source_type = ? AND source_key = ? AND target_type = ? AND target_user_id = ? AND target_group = ? AND deleted_at = ?",
		notification.SourceType, notification.SourceKey, notification.TargetType, notification.TargetUserId, notification.TargetGroup, 0).
		First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		notification.CreatedAt = now
		notification.UpdatedAt = now
		return DB.Create(notification).Error
	}
	if err != nil {
		return err
	}
	notification.Id = existing.Id
	notification.CreatedAt = existing.CreatedAt
	notification.UpdatedAt = now
	return UpdateUINotification(notification)
}

func DisableUINotificationsBySource(sourceType string, sourceId int64) error {
	if strings.TrimSpace(sourceType) == "" || sourceId <= 0 {
		return nil
	}
	now := common.GetTimestamp()
	return DB.Model(&UINotification{}).
		Where("source_type = ? AND source_id = ? AND deleted_at = ?", sourceType, sourceId, 0).
		Updates(map[string]interface{}{
			"enabled":    false,
			"updated_at": now,
		}).Error
}

func UIAnnouncementNotificationSourceKey(announcementId int64, version int) string {
	if version <= 0 {
		version = 1
	}
	return fmt.Sprintf("announcement:%d:v%d", announcementId, version)
}

func SyncUIAnnouncementNotification(announcement *UIAnnouncement) error {
	if announcement == nil || announcement.Id <= 0 {
		return nil
	}
	if err := DisableUINotificationsBySource(UINotificationSourceAnnouncement, announcement.Id); err != nil {
		return err
	}
	NormalizeUIAnnouncement(announcement)
	if !announcement.Enabled || !announcement.NotifyEnabled {
		return nil
	}
	requireAck := announcement.RequireAck || announcement.ForcePopup
	return UpsertSourceUINotification(&UINotification{
		Title:         announcement.Title,
		Summary:       announcement.Summary,
		Content:       announcement.Content,
		ContentFormat: UINotificationFormatMarkdown,
		Category:      UINotificationCategoryAnnouncement,
		Level:         announcement.NotifyLevel,
		SourceType:    UINotificationSourceAnnouncement,
		SourceKey:     UIAnnouncementNotificationSourceKey(announcement.Id, announcement.Version),
		SourceId:      announcement.Id,
		SourceVersion: announcement.Version,
		TargetType:    UINotificationTargetAll,
		ActionUrl:     "/announcements",
		Popup:         announcement.ForcePopup,
		RequireAck:    requireAck,
		Pinned:        announcement.Pinned,
		Enabled:       true,
		Priority:      announcement.Priority,
		StartsAt:      announcement.StartsAt,
		EndsAt:        announcement.EndsAt,
		CreatedBy:     announcement.CreatedBy,
		UpdatedBy:     announcement.UpdatedBy,
	})
}

func NotifyUITopUpSuccess(topUp *TopUp, quota int, provider string) error {
	if topUp == nil || topUp.UserId <= 0 || quota <= 0 {
		return nil
	}
	setting, err := GetUINotificationSetting()
	if err != nil {
		return err
	}
	if !setting.BillingEnabled {
		return nil
	}
	provider = strings.TrimSpace(provider)
	if provider == "" {
		provider = topUp.PaymentProvider
	}
	sourceKey := strings.TrimSpace(topUp.TradeNo)
	if sourceKey == "" {
		sourceKey = fmt.Sprintf("%d", topUp.Id)
	}
	return UpsertSourceUINotification(&UINotification{
		Title:         "充值已到账",
		Summary:       fmt.Sprintf("已为账户增加 %s。", logger.LogQuota(quota)),
		Content:       fmt.Sprintf("充值订单 %s 已完成，支付渠道：%s，到账额度：%s。", sourceKey, provider, logger.LogQuota(quota)),
		ContentFormat: UINotificationFormatPlain,
		Category:      UINotificationCategoryBilling,
		Level:         UINotificationLevelSuccess,
		SourceType:    UINotificationSourceTopUp,
		SourceKey:     "topup:" + sourceKey,
		SourceId:      int64(topUp.Id),
		SourceVersion: 1,
		TargetType:    UINotificationTargetUser,
		TargetUserId:  topUp.UserId,
		ActionUrl:     "/topup",
		RequireAck:    setting.BillingRequireAck,
		Enabled:       true,
	})
}

func NotifyUIRedemptionSuccess(userId int, quota int, redemptionId int) error {
	if userId <= 0 || quota <= 0 || redemptionId <= 0 {
		return nil
	}
	setting, err := GetUINotificationSetting()
	if err != nil {
		return err
	}
	if !setting.BillingEnabled {
		return nil
	}
	return UpsertSourceUINotification(&UINotification{
		Title:         "兑换码充值成功",
		Summary:       fmt.Sprintf("已为账户增加 %s。", logger.LogQuota(quota)),
		Content:       fmt.Sprintf("兑换码 #%d 已成功使用，到账额度：%s。", redemptionId, logger.LogQuota(quota)),
		ContentFormat: UINotificationFormatPlain,
		Category:      UINotificationCategoryBilling,
		Level:         UINotificationLevelSuccess,
		SourceType:    UINotificationSourceRedemption,
		SourceKey:     fmt.Sprintf("redemption:%d", redemptionId),
		SourceId:      int64(redemptionId),
		SourceVersion: 1,
		TargetType:    UINotificationTargetUser,
		TargetUserId:  userId,
		ActionUrl:     "/topup",
		RequireAck:    setting.BillingRequireAck,
		Enabled:       true,
	})
}

func NotifyUIRefundAppealStatus(appeal *UIRefundAppeal) error {
	if appeal == nil || appeal.Id <= 0 || appeal.UserId <= 0 {
		return nil
	}
	setting, err := GetUINotificationSetting()
	if err != nil {
		return err
	}
	title := "空回补偿申诉已提交"
	level := UINotificationLevelInfo
	summary := fmt.Sprintf("申诉单 #%d 已进入人工审核，共 %d 条记录。", appeal.Id, appeal.TotalItems)
	content := summary
	enabled := setting.AppealSubmittedEnabled
	requireAck := setting.AppealSubmittedRequireAck
	switch appeal.Status {
	case UIRefundAppealStatusApproved:
		enabled = setting.AppealApprovedEnabled
		requireAck = setting.AppealApprovedRequireAck
		title = "空回补偿申诉已通过"
		level = UINotificationLevelSuccess
		summary = fmt.Sprintf("申诉单 #%d 已通过，补偿 %s。", appeal.Id, logger.LogQuota(appeal.RefundQuota))
		content = fmt.Sprintf("%s\n审核备注：%s", summary, emptyTextFallback(appeal.ReviewNote, "管理员未填写备注"))
	case UIRefundAppealStatusRejected:
		enabled = setting.AppealRejectedEnabled
		requireAck = setting.AppealRejectedRequireAck
		title = "空回补偿申诉已驳回"
		level = UINotificationLevelWarning
		summary = fmt.Sprintf("申诉单 #%d 已驳回。", appeal.Id)
		content = fmt.Sprintf("%s\n驳回原因：%s", summary, emptyTextFallback(appeal.ReviewNote, "管理员未填写原因"))
	}
	if !enabled {
		return nil
	}
	return UpsertSourceUINotification(&UINotification{
		Title:         title,
		Summary:       summary,
		Content:       content,
		ContentFormat: UINotificationFormatPlain,
		Category:      UINotificationCategoryAppeal,
		Level:         level,
		SourceType:    UINotificationSourceRefundAppeal,
		SourceKey:     fmt.Sprintf("appeal:%d:%s", appeal.Id, appeal.Status),
		SourceId:      appeal.Id,
		SourceVersion: 1,
		TargetType:    UINotificationTargetUser,
		TargetUserId:  appeal.UserId,
		ActionUrl:     "/logs",
		RequireAck:    requireAck,
		Enabled:       true,
	})
}

func emptyTextFallback(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
