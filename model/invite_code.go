package model

import (
	"crypto/rand"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	ErrInviteCodeNotFound = errors.New("invite code not found or invalid")
	ErrInviteCodeInvalid  = errors.New("invite code is expired or already used")
)

const (
	InviteCodeStatusPending = 0 // not yet used
	InviteCodeStatusUsed    = 1 // consumed by a registrant
	InviteCodeStatusExpired = 2 // past expiry, not consumed

	InviteCodeLength    = 8
	InviteCodeMaxActive = 2 // max simultaneous valid codes per user
	InviteCodeDailyMax  = 2 // max codes generated per natural day (UTC+8)
	InviteCodeTTLDays   = 7
)

type InviteCode struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Code      string `json:"code" gorm:"type:varchar(16);uniqueIndex;not null"`
	OwnerId   int    `json:"owner_id" gorm:"index;not null"`
	UsedById  int    `json:"used_by_id" gorm:"default:0"`
	Status    int    `json:"status" gorm:"type:int;default:0;index"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	ExpiredAt int64  `json:"expired_at" gorm:"not null;index"`
}

func generateInviteCodeString() (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, InviteCodeLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b), nil
}

// beijing0AMidnight returns the Unix timestamp of today's midnight in UTC+8.
func beijing0AMidnight() int64 {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Now().In(loc)
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	return midnight.Unix()
}

// CountTodayGenerated counts codes the user has generated since Beijing midnight.
func CountTodayGenerated(ownerId int) (int64, error) {
	var count int64
	err := DB.Model(&InviteCode{}).
		Where("owner_id = ? AND created_at >= ?", ownerId, beijing0AMidnight()).
		Count(&count).Error
	return count, err
}

// CountActiveForOwner counts unexpired and unused codes for the user.
func CountActiveForOwner(ownerId int) (int64, error) {
	var count int64
	now := time.Now().Unix()
	err := DB.Model(&InviteCode{}).
		Where("owner_id = ? AND status = ? AND expired_at > ?", ownerId, InviteCodeStatusPending, now).
		Count(&count).Error
	return count, err
}

// UserHasTopUp returns true if the user has at least one completed top-up record.
func UserHasTopUp(userId int) (bool, error) {
	var count int64
	err := DB.Model(&TopUp{}).Where("user_id = ? AND status = ?", userId, common.TopUpStatusSuccess).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateInviteCode generates a new invite code for ownerId. Callers must have
// already verified quota (daily limit + active limit + topup eligibility).
func CreateInviteCode(ownerId int) (*InviteCode, error) {
	var code string
	var err error
	// retry up to 5 times on collision
	for i := 0; i < 5; i++ {
		code, err = generateInviteCodeString()
		if err != nil {
			return nil, err
		}
		code = strings.ToUpper(code)
		var existing InviteCode
		if result := DB.Where("code = ?", code).First(&existing); result.Error != nil {
			break // not found — safe to use
		}
	}

	ic := &InviteCode{
		Code:      code,
		OwnerId:   ownerId,
		Status:    InviteCodeStatusPending,
		ExpiredAt: time.Now().Unix() + int64(InviteCodeTTLDays*24*3600),
	}
	if err := DB.Create(ic).Error; err != nil {
		return nil, err
	}
	return ic, nil
}

// GetInviteCodesByOwner returns all codes for the given owner, newest first.
func GetInviteCodesByOwner(ownerId int) ([]*InviteCode, error) {
	var codes []*InviteCode
	err := DB.Where("owner_id = ?", ownerId).Order("created_at DESC").Find(&codes).Error
	return codes, err
}

// ConsumeInviteCode validates the code and marks it used. Returns the owner id.
// Returns error if code is invalid, expired, or already used.
func ConsumeInviteCode(code string, usedById int) (int, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	var ic InviteCode
	if err := DB.Where("code = ?", code).First(&ic).Error; err != nil {
		return 0, ErrInviteCodeNotFound
	}
	if ic.Status != InviteCodeStatusPending {
		return 0, ErrInviteCodeInvalid
	}
	if time.Now().Unix() > ic.ExpiredAt {
		// mark expired lazily
		DB.Model(&ic).Updates(map[string]interface{}{"status": InviteCodeStatusExpired})
		return 0, ErrInviteCodeInvalid
	}
	if err := DB.Model(&ic).Updates(map[string]interface{}{
		"status":     InviteCodeStatusUsed,
		"used_by_id": usedById,
	}).Error; err != nil {
		return 0, err
	}
	return ic.OwnerId, nil
}
