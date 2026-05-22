package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const MaxPlaygroundImagesPerUser = 60

type PlaygroundImage struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	Model     string `json:"model" gorm:"type:varchar(160);default:''"`
	GroupName string `json:"group_name" gorm:"column:group_name;type:varchar(64);default:''"`
	Size      string `json:"size" gorm:"type:varchar(32);default:''"`
	Quality   string `json:"quality" gorm:"type:varchar(32);default:''"`
	Style     string `json:"style" gorm:"type:varchar(32);default:''"`
	Image     []byte `json:"-" gorm:"column:image"`
	ImageType string `json:"image_type" gorm:"column:image_type;type:varchar(64);default:'image/png'"`
	Width     int    `json:"width" gorm:"default:0"`
	Height    int    `json:"height" gorm:"default:0"`
	Extra     string `json:"extra" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"default:0;index"`
	DeletedAt int64  `json:"-" gorm:"default:0;index"`
}

func (PlaygroundImage) TableName() string {
	return "playground_images"
}

type PlaygroundImageView struct {
	Id        int64  `json:"id"`
	Prompt    string `json:"prompt"`
	Model     string `json:"model"`
	GroupName string `json:"group_name"`
	Size      string `json:"size"`
	Quality   string `json:"quality"`
	Style     string `json:"style"`
	ImageURL  string `json:"image_url"`
	ImageType string `json:"image_type"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Extra     string `json:"extra"`
	CreatedAt int64  `json:"created_at"`
}

func (img *PlaygroundImage) ToView(urlBase string) *PlaygroundImageView {
	if img == nil {
		return nil
	}
	return &PlaygroundImageView{
		Id:        img.Id,
		Prompt:    img.Prompt,
		Model:     img.Model,
		GroupName: img.GroupName,
		Size:      img.Size,
		Quality:   img.Quality,
		Style:     img.Style,
		ImageURL:  urlBase + "/" + intToStr(img.Id) + "/image",
		ImageType: img.ImageType,
		Width:     img.Width,
		Height:    img.Height,
		Extra:     img.Extra,
		CreatedAt: img.CreatedAt,
	}
}

func intToStr(n int64) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 20)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}

func ListPlaygroundImages(userId int, limit int) ([]*PlaygroundImage, error) {
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}
	if limit <= 0 || limit > MaxPlaygroundImagesPerUser {
		limit = MaxPlaygroundImagesPerUser
	}
	var images []*PlaygroundImage
	err := DB.Model(&PlaygroundImage{}).
		Omit("image").
		Where("user_id = ? AND deleted_at = ?", userId, 0).
		Order("id desc").
		Limit(limit).
		Find(&images).Error
	return images, err
}

func GetPlaygroundImageMeta(id int64, userId int) (*PlaygroundImage, error) {
	if id <= 0 || userId <= 0 {
		return nil, errors.New("invalid params")
	}
	var img PlaygroundImage
	err := DB.Omit("image").
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		First(&img).Error
	if err != nil {
		return nil, err
	}
	return &img, nil
}

func GetPlaygroundImageBinary(id int64, userId int) (*PlaygroundImage, error) {
	if id <= 0 || userId <= 0 {
		return nil, errors.New("invalid params")
	}
	var img PlaygroundImage
	err := DB.Select("id", "user_id", "image", "image_type", "created_at", "deleted_at").
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		First(&img).Error
	if err != nil {
		return nil, err
	}
	return &img, nil
}

func CreatePlaygroundImage(img *PlaygroundImage) error {
	if img == nil || img.UserId <= 0 {
		return errors.New("invalid image")
	}
	if len(img.Image) == 0 {
		return errors.New("empty image bytes")
	}
	img.ImageType = strings.TrimSpace(img.ImageType)
	if img.ImageType == "" {
		img.ImageType = "image/png"
	}
	img.Id = 0
	if img.CreatedAt == 0 {
		img.CreatedAt = common.GetTimestamp()
	}
	img.DeletedAt = 0
	if err := DB.Create(img).Error; err != nil {
		return err
	}
	pruneOldPlaygroundImages(img.UserId)
	return nil
}

func pruneOldPlaygroundImages(userId int) {
	var ids []int64
	q := DB.Model(&PlaygroundImage{}).
		Select("id").
		Where("user_id = ? AND deleted_at = ?", userId, 0).
		Order("id desc").
		Offset(MaxPlaygroundImagesPerUser)
	if err := q.Find(&ids).Error; err != nil || len(ids) == 0 {
		return
	}
	now := common.GetTimestamp()
	DB.Model(&PlaygroundImage{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{"deleted_at": now})
}

func DeletePlaygroundImage(id int64, userId int) error {
	if id <= 0 || userId <= 0 {
		return errors.New("invalid params")
	}
	now := common.GetTimestamp()
	return DB.Model(&PlaygroundImage{}).
		Where("id = ? AND user_id = ? AND deleted_at = ?", id, userId, 0).
		Update("deleted_at", now).Error
}
