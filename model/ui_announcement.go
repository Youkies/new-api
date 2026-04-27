package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UIAnnouncementTypeNormal     = "normal"
	UIAnnouncementFormatMarkdown = "markdown"
	UIAnnouncementScopeAll       = "all"
)

type UIAnnouncement struct {
	Id            int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title         string `json:"title" gorm:"type:varchar(191);not null"`
	Summary       string `json:"summary" gorm:"type:varchar(500);default:''"`
	Content       string `json:"content" gorm:"type:text;not null"`
	ContentFormat string `json:"content_format" gorm:"type:varchar(32);default:'markdown'"`
	Type          string `json:"type" gorm:"type:varchar(32);default:'normal'"`
	Scope         string `json:"scope" gorm:"type:varchar(32);default:'all'"`
	ForcePopup    bool   `json:"force_popup" gorm:"default:false;index:idx_ui_announcements_enabled_force_deleted,priority:2"`
	Pinned        bool   `json:"pinned" gorm:"default:false;index:idx_ui_announcements_enabled_pinned_priority_created,priority:2"`
	Enabled       bool   `json:"enabled" gorm:"default:true;index:idx_ui_announcements_enabled_force_deleted,priority:1;index:idx_ui_announcements_enabled_pinned_priority_created,priority:1"`
	Version       int    `json:"version" gorm:"default:1"`
	Priority      int    `json:"priority" gorm:"default:0;index:idx_ui_announcements_enabled_pinned_priority_created,priority:3"`
	StartsAt      int64  `json:"starts_at" gorm:"default:0;index:idx_ui_announcements_starts_ends,priority:1"`
	EndsAt        int64  `json:"ends_at" gorm:"default:0;index:idx_ui_announcements_starts_ends,priority:2"`
	CreatedBy     int    `json:"created_by" gorm:"default:0"`
	UpdatedBy     int    `json:"updated_by" gorm:"default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"default:0;index:idx_ui_announcements_enabled_pinned_priority_created,priority:4"`
	UpdatedAt     int64  `json:"updated_at" gorm:"default:0"`
	DeletedAt     int64  `json:"deleted_at" gorm:"default:0;index:idx_ui_announcements_enabled_force_deleted,priority:3"`
}

func (UIAnnouncement) TableName() string {
	return "ui_announcements"
}

type UIAnnouncementAck struct {
	Id                  int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	AnnouncementId      int64 `json:"announcement_id" gorm:"not null;uniqueIndex:idx_ui_announcement_acks_unique,priority:1;index"`
	AnnouncementVersion int   `json:"announcement_version" gorm:"default:1;uniqueIndex:idx_ui_announcement_acks_unique,priority:2"`
	UserId              int   `json:"user_id" gorm:"not null;uniqueIndex:idx_ui_announcement_acks_unique,priority:3;index"`
	DontShowAgain       bool  `json:"dont_show_again" gorm:"default:false"`
	AcknowledgedAt      int64 `json:"acknowledged_at" gorm:"default:0"`
	CreatedAt           int64 `json:"created_at" gorm:"default:0"`
	UpdatedAt           int64 `json:"updated_at" gorm:"default:0"`
}

func (UIAnnouncementAck) TableName() string {
	return "ui_announcement_acks"
}

func NormalizeUIAnnouncement(a *UIAnnouncement) {
	a.Title = strings.TrimSpace(a.Title)
	a.Summary = strings.TrimSpace(a.Summary)
	a.Content = strings.TrimSpace(a.Content)
	a.ContentFormat = strings.TrimSpace(a.ContentFormat)
	a.Type = strings.TrimSpace(a.Type)
	a.Scope = strings.TrimSpace(a.Scope)
	if a.ContentFormat == "" {
		a.ContentFormat = UIAnnouncementFormatMarkdown
	}
	if a.Type == "" {
		a.Type = UIAnnouncementTypeNormal
	}
	if a.Scope == "" {
		a.Scope = UIAnnouncementScopeAll
	}
	if a.Version <= 0 {
		a.Version = 1
	}
}

func ValidateUIAnnouncement(a *UIAnnouncement) error {
	if a == nil {
		return errors.New("公告不能为空")
	}
	NormalizeUIAnnouncement(a)
	if a.Title == "" {
		return errors.New("公告标题不能为空")
	}
	if len([]rune(a.Title)) > 191 {
		return errors.New("公告标题不能超过 191 个字符")
	}
	if len([]rune(a.Summary)) > 500 {
		return errors.New("公告摘要不能超过 500 个字符")
	}
	if a.Content == "" {
		return errors.New("公告内容不能为空")
	}
	if a.StartsAt != 0 && a.EndsAt != 0 && a.StartsAt > a.EndsAt {
		return errors.New("公告开始时间不能晚于结束时间")
	}
	return nil
}

func activeUIAnnouncementQuery(tx *gorm.DB, now int64) *gorm.DB {
	return tx.Where("deleted_at = ?", 0).
		Where("enabled = ?", true).
		Where("(starts_at = ? OR starts_at <= ?)", 0, now).
		Where("(ends_at = ? OR ends_at >= ?)", 0, now)
}

func uiAnnouncementOrder(tx *gorm.DB) *gorm.DB {
	return tx.Order("pinned desc").Order("priority desc").Order("created_at desc").Order("id desc")
}

func GetPublicUIAnnouncements(pageInfo *common.PageInfo) (announcements []*UIAnnouncement, total int64, err error) {
	now := common.GetTimestamp()
	query := DB.Model(&UIAnnouncement{}).
		Where("deleted_at = ?", 0).
		Where("enabled = ?", true).
		Where("(starts_at = ? OR starts_at <= ?)", 0, now)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = uiAnnouncementOrder(query).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&announcements).Error
	return announcements, total, err
}

func GetActiveForceUIAnnouncements() (announcements []*UIAnnouncement, err error) {
	now := common.GetTimestamp()
	err = uiAnnouncementOrder(activeUIAnnouncementQuery(DB.Model(&UIAnnouncement{}), now).
		Where("force_popup = ?", true)).
		Find(&announcements).Error
	return announcements, err
}

func GetAdminUIAnnouncements(pageInfo *common.PageInfo, keyword string, enabled *bool) (announcements []*UIAnnouncement, total int64, err error) {
	query := DB.Model(&UIAnnouncement{}).Where("deleted_at = ?", 0)
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		query = query.Where("title LIKE ? OR summary LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	if enabled != nil {
		query = query.Where("enabled = ?", *enabled)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = uiAnnouncementOrder(query).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&announcements).Error
	return announcements, total, err
}

func GetUIAnnouncementById(id int64) (*UIAnnouncement, error) {
	if id <= 0 {
		return nil, errors.New("无效的公告 ID")
	}
	var announcement UIAnnouncement
	err := DB.Where("id = ? AND deleted_at = ?", id, 0).First(&announcement).Error
	return &announcement, err
}

func CreateUIAnnouncement(announcement *UIAnnouncement) error {
	if err := ValidateUIAnnouncement(announcement); err != nil {
		return err
	}
	now := common.GetTimestamp()
	announcement.Id = 0
	announcement.Version = 1
	announcement.CreatedAt = now
	announcement.UpdatedAt = now
	return DB.Create(announcement).Error
}

func UpdateUIAnnouncement(announcement *UIAnnouncement) error {
	if err := ValidateUIAnnouncement(announcement); err != nil {
		return err
	}
	announcement.UpdatedAt = common.GetTimestamp()
	return DB.Model(&UIAnnouncement{}).
		Where("id = ? AND deleted_at = ?", announcement.Id, 0).
		Updates(map[string]interface{}{
			"title":          announcement.Title,
			"summary":        announcement.Summary,
			"content":        announcement.Content,
			"content_format": announcement.ContentFormat,
			"type":           announcement.Type,
			"scope":          announcement.Scope,
			"force_popup":    announcement.ForcePopup,
			"pinned":         announcement.Pinned,
			"enabled":        announcement.Enabled,
			"version":        announcement.Version,
			"priority":       announcement.Priority,
			"starts_at":      announcement.StartsAt,
			"ends_at":        announcement.EndsAt,
			"updated_by":     announcement.UpdatedBy,
			"updated_at":     announcement.UpdatedAt,
		}).Error
}

func DeleteUIAnnouncementById(id int64, updatedBy int) error {
	now := common.GetTimestamp()
	return DB.Model(&UIAnnouncement{}).
		Where("id = ? AND deleted_at = ?", id, 0).
		Updates(map[string]interface{}{
			"enabled":    false,
			"updated_by": updatedBy,
			"updated_at": now,
			"deleted_at": now,
		}).Error
}

func AckUIAnnouncement(userId int, announcementId int64, announcementVersion int, dontShowAgain bool) error {
	if userId <= 0 {
		return errors.New("无效的用户 ID")
	}
	if announcementId <= 0 {
		return errors.New("无效的公告 ID")
	}
	if announcementVersion <= 0 {
		announcementVersion = 1
	}
	now := common.GetTimestamp()
	ack := UIAnnouncementAck{
		AnnouncementId:      announcementId,
		AnnouncementVersion: announcementVersion,
		UserId:              userId,
		DontShowAgain:       dontShowAgain,
		AcknowledgedAt:      now,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "announcement_id"},
			{Name: "announcement_version"},
			{Name: "user_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"dont_show_again": dontShowAgain,
			"acknowledged_at": now,
			"updated_at":      now,
		}),
	}).Create(&ack).Error
}

func GetUIAnnouncementAckMap(userId int, announcements []*UIAnnouncement) (map[int64]bool, error) {
	result := make(map[int64]bool)
	if userId <= 0 || len(announcements) == 0 {
		return result, nil
	}
	versions := make(map[int64]int, len(announcements))
	ids := make([]int64, 0, len(announcements))
	for _, announcement := range announcements {
		if announcement == nil {
			continue
		}
		versions[announcement.Id] = announcement.Version
		ids = append(ids, announcement.Id)
	}
	if len(ids) == 0 {
		return result, nil
	}
	var acks []UIAnnouncementAck
	if err := DB.Where("user_id = ? AND announcement_id IN ?", userId, ids).Find(&acks).Error; err != nil {
		return nil, err
	}
	for _, ack := range acks {
		if versions[ack.AnnouncementId] == ack.AnnouncementVersion {
			result[ack.AnnouncementId] = true
		}
	}
	return result, nil
}
