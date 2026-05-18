package model

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// UserModelArchive is a user-owned, named bundle of model aliases.
// Each archive is an independent namespace: alias names are unique only within
// an archive, allowing the same alias to be reused across a user's archives.
// Routing disambiguation is handled by the token's ArchiveId binding or an
// explicit `slug/alias` prefix at request time.
type UserModelArchive struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id" gorm:"not null;uniqueIndex:idx_user_archive_slug,priority:1;index"`
	Name         string         `json:"name" gorm:"type:varchar(64);not null"`
	Slug         string         `json:"slug" gorm:"type:varchar(64);not null;uniqueIndex:idx_user_archive_slug,priority:2"`
	Description  string         `json:"description" gorm:"type:varchar(255);default:''"`
	ShareCode    *string        `json:"share_code" gorm:"type:varchar(32);uniqueIndex"`
	ShareEnabled bool           `json:"share_enabled" gorm:"default:false"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
}

// UserModelAlias maps an alias name within an archive to a real (group, model) pair.
type UserModelAlias struct {
	Id             int    `json:"id"`
	ArchiveId      int    `json:"archive_id" gorm:"not null;uniqueIndex:idx_archive_alias,priority:1"`
	AliasName      string `json:"alias_name" gorm:"type:varchar(64);not null;uniqueIndex:idx_archive_alias,priority:2"`
	SourceGroup    string `json:"source_group" gorm:"type:varchar(64);not null"`
	SourceModel    string `json:"source_model" gorm:"type:varchar(255);not null"`
	DisabledReason string `json:"disabled_reason" gorm:"type:varchar(255);default:''"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime    int64  `json:"updated_time" gorm:"bigint"`
}

const (
	archiveShareCodeLength = 10
	archiveSlugMaxLength   = 32
	archiveSlugRetryMax    = 16
)

var (
	ErrArchiveNotFound       = errors.New("archive not found")
	ErrArchiveAliasNotFound  = errors.New("alias not found")
	ErrArchiveAliasDuplicate = errors.New("alias name already exists in this archive")
	ErrArchiveSlugUnstable   = errors.New("failed to allocate a unique archive slug")

	slugInvalidChars = regexp.MustCompile(`[^a-z0-9]+`)
	slugTrimDashes   = regexp.MustCompile(`(^-+)|(-+$)`)
)

// ValidateAliasName accepts any non-empty string (including Chinese / other
// Unicode) up to 64 runes, with two forbidden characters:
//   - '@' is reserved as the archive-prefix routing separator ("slug@alias")
//   - any whitespace, which has no place in API model names
func ValidateAliasName(name string) error {
	if name == "" {
		return errors.New("别名不能为空")
	}
	if utf8.RuneCountInString(name) > 64 {
		return errors.New("别名长度不能超过 64 个字符")
	}
	for _, r := range name {
		if r == '@' {
			return errors.New("别名不能包含 '@'（用于跨存档路由的保留字符）")
		}
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			return errors.New("别名不能包含空白字符")
		}
	}
	return nil
}

// slugify converts an arbitrary display name into an ASCII slug.
// Non-ASCII (e.g. Chinese) chars are stripped; if the result is empty,
// "archive" is used as a base and a random suffix is appended later.
func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = slugInvalidChars.ReplaceAllString(s, "-")
	s = slugTrimDashes.ReplaceAllString(s, "")
	if len(s) > archiveSlugMaxLength {
		s = s[:archiveSlugMaxLength]
		s = slugTrimDashes.ReplaceAllString(s, "")
	}
	if s == "" {
		s = "archive"
	}
	return s
}

// ValidateAliasName enforces a conservative alias charset so aliases don't
// collide with URL/path syntax used in prefix routing.
// (Moved above into the var block as a standalone func; this comment intentionally left empty.)

func generateArchiveShareCode() (string, error) {
	return common.GenerateRandomCharsKey(archiveShareCodeLength)
}

func archiveSlugExists(userId int, slug string, excludeId int) (bool, error) {
	q := DB.Unscoped().Model(&UserModelArchive{}).Where("user_id = ? AND slug = ? AND deleted_at IS NULL", userId, slug)
	if excludeId > 0 {
		q = q.Where("id <> ?", excludeId)
	}
	var count int64
	if err := q.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func allocateArchiveSlug(userId int, base string, excludeId int) (string, error) {
	base = slugify(base)
	candidate := base
	for i := 0; i < archiveSlugRetryMax; i++ {
		exists, err := archiveSlugExists(userId, candidate, excludeId)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, i+2)
	}
	// Final fallback: append a 4-char random suffix.
	suffix, err := common.GenerateRandomCharsKey(4)
	if err != nil {
		return "", err
	}
	candidate = fmt.Sprintf("%s-%s", base, strings.ToLower(suffix))
	exists, err := archiveSlugExists(userId, candidate, excludeId)
	if err != nil {
		return "", err
	}
	if exists {
		return "", ErrArchiveSlugUnstable
	}
	return candidate, nil
}

// Insert creates a new archive. Slug is auto-allocated from Name when empty.
func (a *UserModelArchive) Insert() error {
	if a.UserId <= 0 {
		return errors.New("archive must belong to a user")
	}
	if strings.TrimSpace(a.Name) == "" {
		return errors.New("archive name is required")
	}
	if len(a.Name) > 64 {
		return errors.New("archive name too long")
	}
	if len(a.Description) > 255 {
		return errors.New("archive description too long")
	}
	base := a.Slug
	if strings.TrimSpace(base) == "" {
		base = a.Name
	}
	slug, err := allocateArchiveSlug(a.UserId, base, 0)
	if err != nil {
		return err
	}
	a.Slug = slug
	now := time.Now().Unix()
	a.CreatedTime = now
	a.UpdatedTime = now
	a.ShareCode = nil
	a.ShareEnabled = false
	return DB.Create(a).Error
}

// UpdateMeta updates name/description/slug on an archive. Slug auto-realloc
// happens when the supplied slug is empty and the name changed.
func (a *UserModelArchive) UpdateMeta(name, description, slug string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("archive name is required")
	}
	if len(name) > 64 {
		return errors.New("archive name too long")
	}
	if len(description) > 255 {
		return errors.New("archive description too long")
	}
	base := slug
	if strings.TrimSpace(base) == "" {
		base = name
	}
	newSlug, err := allocateArchiveSlug(a.UserId, base, a.Id)
	if err != nil {
		return err
	}
	a.Name = name
	a.Description = description
	a.Slug = newSlug
	a.UpdatedTime = time.Now().Unix()
	return DB.Model(a).Select("name", "description", "slug", "updated_time").Updates(a).Error
}

// EnableShare creates or rotates the archive share code and enables sharing.
func (a *UserModelArchive) EnableShare() error {
	code, err := generateArchiveShareCode()
	if err != nil {
		return err
	}
	// Retry on the (very unlikely) global collision on share_code.
	for i := 0; i < 4; i++ {
		var dup UserModelArchive
		err := DB.Where("share_code = ?", code).First(&dup).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			break
		}
		if err != nil {
			return err
		}
		code, err = generateArchiveShareCode()
		if err != nil {
			return err
		}
	}
	a.ShareCode = &code
	a.ShareEnabled = true
	a.UpdatedTime = time.Now().Unix()
	return DB.Model(a).Select("share_code", "share_enabled", "updated_time").Updates(a).Error
}

// DisableShare clears the share code and disables sharing.
func (a *UserModelArchive) DisableShare() error {
	a.ShareCode = nil
	a.ShareEnabled = false
	a.UpdatedTime = time.Now().Unix()
	return DB.Model(a).Select("share_code", "share_enabled", "updated_time").Updates(a).Error
}

// Delete soft-deletes the archive and hard-deletes its aliases.
// Tokens whose ArchiveId points here are detached (set to NULL) so requests
// stop routing through the deleted archive without breaking the token.
func (a *UserModelArchive) Delete() error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("archive_id = ?", a.Id).Delete(&UserModelAlias{}).Error; err != nil {
			return err
		}
		if err := tx.Model(&Token{}).Where("archive_id = ?", a.Id).Update("archive_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(a).Error
	})
}

// GetUserArchive fetches an archive by id, scoped to a user (for ownership check).
func GetUserArchive(archiveId, userId int) (*UserModelArchive, error) {
	if archiveId <= 0 || userId <= 0 {
		return nil, ErrArchiveNotFound
	}
	var a UserModelArchive
	err := DB.Where("id = ? AND user_id = ?", archiveId, userId).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrArchiveNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetUserArchiveBySlug fetches an archive by (user_id, slug) for prefix routing.
func GetUserArchiveBySlug(userId int, slug string) (*UserModelArchive, error) {
	if userId <= 0 || slug == "" {
		return nil, ErrArchiveNotFound
	}
	var a UserModelArchive
	err := DB.Where("user_id = ? AND slug = ?", userId, slug).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrArchiveNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// GetArchiveByShareCode fetches a shared archive by its code. Only enabled shares are returned.
func GetArchiveByShareCode(code string) (*UserModelArchive, error) {
	if code == "" {
		return nil, ErrArchiveNotFound
	}
	var a UserModelArchive
	err := DB.Where("share_code = ? AND share_enabled = ?", code, true).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrArchiveNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListUserArchives returns all archives owned by a user, ordered by created_time desc.
func ListUserArchives(userId int) ([]*UserModelArchive, error) {
	if userId <= 0 {
		return nil, nil
	}
	var archives []*UserModelArchive
	err := DB.Where("user_id = ?", userId).Order("created_time DESC").Find(&archives).Error
	if err != nil {
		return nil, err
	}
	return archives, nil
}

// Insert creates a new alias inside an archive.
func (al *UserModelAlias) Insert() error {
	if al.ArchiveId <= 0 {
		return errors.New("alias must belong to an archive")
	}
	if err := ValidateAliasName(al.AliasName); err != nil {
		return err
	}
	if strings.TrimSpace(al.SourceGroup) == "" {
		return errors.New("source_group is required")
	}
	if strings.TrimSpace(al.SourceModel) == "" {
		return errors.New("source_model is required")
	}
	now := time.Now().Unix()
	al.CreatedTime = now
	al.UpdatedTime = now
	if err := DB.Create(al).Error; err != nil {
		if isDuplicateKeyError(err) {
			return ErrArchiveAliasDuplicate
		}
		return err
	}
	return nil
}

// UpdateAlias updates the source mapping and (optionally) the alias name.
func (al *UserModelAlias) UpdateAlias(aliasName, sourceGroup, sourceModel, disabledReason string) error {
	if err := ValidateAliasName(aliasName); err != nil {
		return err
	}
	if strings.TrimSpace(sourceGroup) == "" {
		return errors.New("source_group is required")
	}
	if strings.TrimSpace(sourceModel) == "" {
		return errors.New("source_model is required")
	}
	al.AliasName = aliasName
	al.SourceGroup = sourceGroup
	al.SourceModel = sourceModel
	al.DisabledReason = disabledReason
	al.UpdatedTime = time.Now().Unix()
	err := DB.Model(al).Select("alias_name", "source_group", "source_model", "disabled_reason", "updated_time").Updates(al).Error
	if err != nil && isDuplicateKeyError(err) {
		return ErrArchiveAliasDuplicate
	}
	return err
}

func (al *UserModelAlias) Delete() error {
	return DB.Delete(al).Error
}

// GetArchiveAlias fetches a single alias by id, scoped to its archive (for ownership check).
func GetArchiveAlias(archiveId, aliasId int) (*UserModelAlias, error) {
	if archiveId <= 0 || aliasId <= 0 {
		return nil, ErrArchiveAliasNotFound
	}
	var al UserModelAlias
	err := DB.Where("id = ? AND archive_id = ?", aliasId, archiveId).First(&al).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrArchiveAliasNotFound
	}
	if err != nil {
		return nil, err
	}
	return &al, nil
}

// ListArchiveAliases returns all aliases in an archive, ordered by created_time asc.
func ListArchiveAliases(archiveId int) ([]*UserModelAlias, error) {
	if archiveId <= 0 {
		return nil, nil
	}
	var aliases []*UserModelAlias
	err := DB.Where("archive_id = ?", archiveId).Order("created_time ASC").Find(&aliases).Error
	if err != nil {
		return nil, err
	}
	return aliases, nil
}

// LookupAliasInArchive is the hot-path lookup for the relay hook.
// Returns nil, nil when the alias does not exist (caller should pass through).
func LookupAliasInArchive(archiveId int, aliasName string) (*UserModelAlias, error) {
	if archiveId <= 0 || aliasName == "" {
		return nil, nil
	}
	var al UserModelAlias
	err := DB.Where("archive_id = ? AND alias_name = ?", archiveId, aliasName).First(&al).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &al, nil
}

// CountAliasesPerArchive returns a map of archive_id -> alias count for the
// provided archive ids. Missing archives map to zero.
func CountAliasesPerArchive(archiveIds []int) (map[int]int, error) {
	result := make(map[int]int, len(archiveIds))
	if len(archiveIds) == 0 {
		return result, nil
	}
	type row struct {
		ArchiveId int
		C         int64
	}
	var rows []row
	err := DB.Model(&UserModelAlias{}).
		Select("archive_id, COUNT(*) AS c").
		Where("archive_id IN ?", archiveIds).
		Group("archive_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.ArchiveId] = int(r.C)
	}
	return result, nil
}

// isDuplicateKeyError returns true when an INSERT/UPDATE failed because of a
// unique-index conflict. We accept the cross-DB cost of substring matching
// because GORM does not expose a typed error for this case.
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique violation") ||
		strings.Contains(msg, "1062") // MySQL ER_DUP_ENTRY
}
