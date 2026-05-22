package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	PlaygroundSessionKindChat  = "chat"
	PlaygroundSessionKindImage = "image"

	MaxPlaygroundSessionsPerUser = 100
	MaxPlaygroundMessagesPerSession = 200
)

type PlaygroundSession struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	Kind      string `json:"kind" gorm:"type:varchar(16);index;not null;default:'chat'"`
	Title     string `json:"title" gorm:"type:varchar(200);default:''"`
	Model     string `json:"model" gorm:"type:varchar(160);default:''"`
	GroupName string `json:"group_name" gorm:"column:group_name;type:varchar(64);default:''"`
	Config    string `json:"config" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"default:0;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"default:0;index"`
	DeletedAt int64  `json:"-" gorm:"default:0;index"`
}

func (PlaygroundSession) TableName() string {
	return "playground_sessions"
}

type PlaygroundMessage struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	SessionId int64  `json:"session_id" gorm:"index;not null"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	Role      string `json:"role" gorm:"type:varchar(16);not null"`
	Content   string `json:"content" gorm:"type:text"`
	Reasoning string `json:"reasoning" gorm:"type:text"`
	Model     string `json:"model" gorm:"type:varchar(160);default:''"`
	GroupName string `json:"group_name" gorm:"column:group_name;type:varchar(64);default:''"`
	Extra     string `json:"extra" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"default:0;index"`
}

func (PlaygroundMessage) TableName() string {
	return "playground_messages"
}

func validatePlaygroundKind(kind string) error {
	switch kind {
	case PlaygroundSessionKindChat, PlaygroundSessionKindImage:
		return nil
	default:
		return errors.New("invalid playground session kind")
	}
}

func normalizePlaygroundSession(s *PlaygroundSession) {
	s.Kind = strings.TrimSpace(s.Kind)
	if s.Kind == "" {
		s.Kind = PlaygroundSessionKindChat
	}
	s.Title = strings.TrimSpace(s.Title)
	if s.Title == "" {
		s.Title = "新对话"
	}
	if len([]rune(s.Title)) > 80 {
		s.Title = string([]rune(s.Title)[:80])
	}
	s.Model = strings.TrimSpace(s.Model)
	s.GroupName = strings.TrimSpace(s.GroupName)
	if s.GroupName == "" {
		s.GroupName = "auto"
	}
}

func ListPlaygroundSessions(userId int, kind string) ([]*PlaygroundSession, error) {
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	query := DB.Model(&PlaygroundSession{}).
		Where("user_id = ? AND deleted_at = ?", userId, 0)
	if kind != "" {
		if err := validatePlaygroundKind(kind); err != nil {
			return nil, err
		}
		query = query.Where("kind = ?", kind)
	}
	var sessions []*PlaygroundSession
	err := query.Order("updated_at desc").Order("id desc").Limit(MaxPlaygroundSessionsPerUser).Find(&sessions).Error
	return sessions, err
}

func GetPlaygroundSession(id int64, userId int) (*PlaygroundSession, error) {
	if id <= 0 || userId <= 0 {
		return nil, errors.New("invalid params")
	}
	var s PlaygroundSession
	err := DB.Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func CreatePlaygroundSession(s *PlaygroundSession) error {
	if s == nil || s.UserId <= 0 {
		return errors.New("invalid session")
	}
	if err := validatePlaygroundKind(s.Kind); err != nil {
		// allow empty -> chat default
		s.Kind = PlaygroundSessionKindChat
	}
	normalizePlaygroundSession(s)
	now := common.GetTimestamp()
	s.Id = 0
	s.CreatedAt = now
	s.UpdatedAt = now
	s.DeletedAt = 0
	if err := DB.Create(s).Error; err != nil {
		return err
	}
	// Trim user's session list if over cap (soft delete oldest)
	pruneOldPlaygroundSessions(s.UserId, s.Kind)
	return nil
}

func pruneOldPlaygroundSessions(userId int, kind string) {
	var ids []int64
	q := DB.Model(&PlaygroundSession{}).
		Select("id").
		Where("user_id = ? AND kind = ? AND deleted_at = ?", userId, kind, 0).
		Order("updated_at desc").
		Order("id desc").
		Offset(MaxPlaygroundSessionsPerUser)
	if err := q.Find(&ids).Error; err != nil || len(ids) == 0 {
		return
	}
	now := common.GetTimestamp()
	DB.Model(&PlaygroundSession{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{"deleted_at": now, "updated_at": now})
}

func UpdatePlaygroundSession(id int64, userId int, patch map[string]interface{}) error {
	if id <= 0 || userId <= 0 || len(patch) == 0 {
		return errors.New("invalid params")
	}
	allowed := map[string]bool{
		"title":      true,
		"model":      true,
		"group_name": true,
		"config":     true,
	}
	clean := make(map[string]interface{}, len(patch))
	for k, v := range patch {
		if allowed[k] {
			clean[k] = v
		}
	}
	if len(clean) == 0 {
		return errors.New("nothing to update")
	}
	clean["updated_at"] = common.GetTimestamp()
	return DB.Model(&PlaygroundSession{}).
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		Updates(clean).Error
}

func TouchPlaygroundSession(id int64, userId int) error {
	return DB.Model(&PlaygroundSession{}).
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		Update("updated_at", common.GetTimestamp()).Error
}

func DeletePlaygroundSession(id int64, userId int) error {
	if id <= 0 || userId <= 0 {
		return errors.New("invalid params")
	}
	now := common.GetTimestamp()
	if err := DB.Model(&PlaygroundSession{}).
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		Updates(map[string]interface{}{"deleted_at": now, "updated_at": now}).Error; err != nil {
		return err
	}
	// Also hard delete messages for that session to save space.
	return DB.Where("session_id = ? AND user_id = ?", id, userId).Delete(&PlaygroundMessage{}).Error
}

func ListPlaygroundMessages(sessionId int64, userId int) ([]*PlaygroundMessage, error) {
	if sessionId <= 0 || userId <= 0 {
		return nil, errors.New("invalid params")
	}
	// Verify ownership first
	if _, err := GetPlaygroundSession(sessionId, userId); err != nil {
		return nil, err
	}
	var msgs []*PlaygroundMessage
	err := DB.Where("session_id = ? AND user_id = ?", sessionId, userId).
		Order("id asc").
		Limit(MaxPlaygroundMessagesPerSession).
		Find(&msgs).Error
	return msgs, err
}

func AppendPlaygroundMessage(m *PlaygroundMessage) error {
	if m == nil || m.SessionId <= 0 || m.UserId <= 0 {
		return errors.New("invalid message")
	}
	role := strings.ToLower(strings.TrimSpace(m.Role))
	switch role {
	case "user", "assistant", "system", "image":
	default:
		return errors.New("invalid role")
	}
	m.Role = role
	// Verify ownership
	if _, err := GetPlaygroundSession(m.SessionId, m.UserId); err != nil {
		return err
	}
	if m.CreatedAt == 0 {
		m.CreatedAt = common.GetTimestamp()
	}
	m.Id = 0
	if err := DB.Create(m).Error; err != nil {
		return err
	}
	pruneOldPlaygroundMessages(m.SessionId, m.UserId)
	// Touch session updated_at
	_ = TouchPlaygroundSession(m.SessionId, m.UserId)
	return nil
}

func pruneOldPlaygroundMessages(sessionId int64, userId int) {
	var ids []int64
	q := DB.Model(&PlaygroundMessage{}).
		Select("id").
		Where("session_id = ? AND user_id = ?", sessionId, userId).
		Order("id desc").
		Offset(MaxPlaygroundMessagesPerSession)
	if err := q.Find(&ids).Error; err != nil || len(ids) == 0 {
		return
	}
	DB.Where("id IN ?", ids).Delete(&PlaygroundMessage{})
}

func DeletePlaygroundMessage(id int64, userId int) error {
	if id <= 0 || userId <= 0 {
		return errors.New("invalid params")
	}
	return DB.Where("id = ? AND user_id = ?", id, userId).Delete(&PlaygroundMessage{}).Error
}

func ClearPlaygroundMessages(sessionId int64, userId int) error {
	if sessionId <= 0 || userId <= 0 {
		return errors.New("invalid params")
	}
	if _, err := GetPlaygroundSession(sessionId, userId); err != nil {
		return err
	}
	return DB.Where("session_id = ? AND user_id = ?", sessionId, userId).Delete(&PlaygroundMessage{}).Error
}
