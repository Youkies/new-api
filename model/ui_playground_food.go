package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	UIPlaygroundFoodStatusPending  = "pending"
	UIPlaygroundFoodStatusApproved = "approved"
	UIPlaygroundFoodStatusRejected = "rejected"

	UIPlaygroundFoodVisibilityPublic  = "public"
	UIPlaygroundFoodVisibilityPrivate = "private"

	UIPlaygroundFoodSourceUser  = "user"
	UIPlaygroundFoodSourceAdmin = "admin"
)

var uiPlaygroundFoodCategories = map[string]bool{
	"breakfast": true,
	"rice":      true,
	"noodles":   true,
	"spicy":     true,
	"global":    true,
	"snack":     true,
	"dessert":   true,
	"drink":     true,
}

type UIPlaygroundFood struct {
	Id                int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Name              string `json:"name" gorm:"type:varchar(191);not null;index"`
	Description       string `json:"description" gorm:"type:varchar(500);default:''"`
	Category          string `json:"category" gorm:"type:varchar(32);not null;index:idx_ui_playground_foods_status_category_deleted,priority:2"`
	Icon              string `json:"icon" gorm:"type:varchar(32);default:'🍽️'"`
	Image             []byte `json:"-" gorm:"column:image"`
	ImageType         string `json:"image_type" gorm:"column:image_type;type:varchar(64);default:''"`
	Status            string `json:"status" gorm:"type:varchar(32);default:'pending';index:idx_ui_playground_foods_status_category_deleted,priority:1"`
	Visibility        string `json:"visibility" gorm:"type:varchar(32);default:'public';index"`
	Source            string `json:"source" gorm:"type:varchar(32);default:'user';index"`
	SubmittedBy       int    `json:"submitted_by" gorm:"default:0;index"`
	SubmittedUsername string `json:"submitted_username" gorm:"type:varchar(191);default:''"`
	ReviewedBy        int    `json:"reviewed_by" gorm:"default:0;index"`
	ReviewNote        string `json:"review_note" gorm:"type:varchar(500);default:''"`
	ReviewedAt        int64  `json:"reviewed_at" gorm:"default:0"`
	CreatedAt         int64  `json:"created_at" gorm:"default:0;index"`
	UpdatedAt         int64  `json:"updated_at" gorm:"default:0"`
	DeletedAt         int64  `json:"deleted_at" gorm:"default:0;index:idx_ui_playground_foods_status_category_deleted,priority:3"`
}

func (UIPlaygroundFood) TableName() string {
	return "ui_playground_foods"
}

type UIPlaygroundFoodView struct {
	Id                int64  `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description"`
	Category          string `json:"category"`
	Icon              string `json:"icon"`
	ImageURL          string `json:"image_url"`
	Status            string `json:"status"`
	Visibility        string `json:"visibility"`
	Source            string `json:"source"`
	SubmittedBy       int    `json:"submitted_by"`
	SubmittedUsername string `json:"submitted_username"`
	ReviewedBy        int    `json:"reviewed_by"`
	ReviewNote        string `json:"review_note"`
	ReviewedAt        int64  `json:"reviewed_at"`
	CreatedAt         int64  `json:"created_at"`
	UpdatedAt         int64  `json:"updated_at"`
}

func (food *UIPlaygroundFood) ToView() *UIPlaygroundFoodView {
	if food == nil {
		return nil
	}
	imageURL := ""
	if food.ImageType != "" {
		imageURL = fmt.Sprintf("/api/ui/playground/foods/%d/image?t=%d", food.Id, food.UpdatedAt)
	}
	return &UIPlaygroundFoodView{
		Id:                food.Id,
		Name:              food.Name,
		Description:       food.Description,
		Category:          food.Category,
		Icon:              food.Icon,
		ImageURL:          imageURL,
		Status:            food.Status,
		Visibility:        food.Visibility,
		Source:            food.Source,
		SubmittedBy:       food.SubmittedBy,
		SubmittedUsername: food.SubmittedUsername,
		ReviewedBy:        food.ReviewedBy,
		ReviewNote:        food.ReviewNote,
		ReviewedAt:        food.ReviewedAt,
		CreatedAt:         food.CreatedAt,
		UpdatedAt:         food.UpdatedAt,
	}
}

func UIPlaygroundFoodViews(foods []*UIPlaygroundFood) []*UIPlaygroundFoodView {
	views := make([]*UIPlaygroundFoodView, 0, len(foods))
	for _, food := range foods {
		if view := food.ToView(); view != nil {
			views = append(views, view)
		}
	}
	return views
}

func ValidateUIPlaygroundFoodStatus(status string) bool {
	switch status {
	case UIPlaygroundFoodStatusPending, UIPlaygroundFoodStatusApproved, UIPlaygroundFoodStatusRejected:
		return true
	default:
		return false
	}
}

func ValidateUIPlaygroundFoodVisibility(visibility string) bool {
	switch visibility {
	case UIPlaygroundFoodVisibilityPublic, UIPlaygroundFoodVisibilityPrivate:
		return true
	default:
		return false
	}
}

func NormalizeUIPlaygroundFood(food *UIPlaygroundFood) {
	food.Name = strings.TrimSpace(food.Name)
	food.Description = strings.TrimSpace(food.Description)
	food.Category = strings.TrimSpace(food.Category)
	food.Icon = strings.TrimSpace(food.Icon)
	if food.Icon == "" {
		food.Icon = "🍽️"
	}
	food.Status = strings.TrimSpace(food.Status)
	if food.Status == "" {
		food.Status = UIPlaygroundFoodStatusPending
	}
	food.Visibility = strings.TrimSpace(food.Visibility)
	if food.Visibility == "" {
		food.Visibility = UIPlaygroundFoodVisibilityPublic
	}
	food.Source = strings.TrimSpace(food.Source)
	if food.Source == "" {
		food.Source = UIPlaygroundFoodSourceUser
	}
	food.SubmittedUsername = strings.TrimSpace(food.SubmittedUsername)
	food.ReviewNote = strings.TrimSpace(food.ReviewNote)
}

func ValidateUIPlaygroundFood(food *UIPlaygroundFood) error {
	if food == nil {
		return errors.New("菜品不能为空")
	}
	NormalizeUIPlaygroundFood(food)
	if food.Name == "" {
		return errors.New("菜品名称不能为空")
	}
	if len([]rune(food.Name)) > 40 {
		return errors.New("菜品名称不能超过 40 个字符")
	}
	if len([]rune(food.Description)) > 200 {
		return errors.New("菜品描述不能超过 200 个字符")
	}
	if !uiPlaygroundFoodCategories[food.Category] {
		return errors.New("菜品分类无效")
	}
	if len([]rune(food.Icon)) > 8 {
		return errors.New("菜品图标不能超过 8 个字符")
	}
	if !ValidateUIPlaygroundFoodStatus(food.Status) {
		return errors.New("菜品状态无效")
	}
	if !ValidateUIPlaygroundFoodVisibility(food.Visibility) {
		return errors.New("菜品可见性无效")
	}
	if food.Visibility == UIPlaygroundFoodVisibilityPrivate && food.SubmittedBy <= 0 {
		return errors.New("私有菜品缺少用户")
	}
	if len([]rune(food.ReviewNote)) > 500 {
		return errors.New("审核备注不能超过 500 个字符")
	}
	return nil
}

func ListUIPlaygroundFoods(userId int) ([]*UIPlaygroundFoodView, error) {
	var foods []*UIPlaygroundFood
	query := DB.Model(&UIPlaygroundFood{}).
		Omit("image").
		Where("deleted_at = ?", 0).
		Where("visibility = ? AND status = ?", UIPlaygroundFoodVisibilityPublic, UIPlaygroundFoodStatusApproved)
	if userId > 0 {
		query = DB.Model(&UIPlaygroundFood{}).
			Omit("image").
			Where("deleted_at = ?", 0).
			Where("(visibility = ? AND status = ?) OR (visibility = ? AND submitted_by = ?)",
				UIPlaygroundFoodVisibilityPublic, UIPlaygroundFoodStatusApproved,
				UIPlaygroundFoodVisibilityPrivate, userId)
	}
	err := query.
		Order("updated_at desc").
		Order("id desc").
		Limit(300).
		Find(&foods).Error
	if err != nil {
		return nil, err
	}
	return UIPlaygroundFoodViews(foods), nil
}

func GetAdminUIPlaygroundFoods(pageInfo *common.PageInfo, status string, keyword string) (views []*UIPlaygroundFoodView, total int64, err error) {
	query := DB.Model(&UIPlaygroundFood{}).Omit("image").Where("deleted_at = ? AND visibility = ?", 0, UIPlaygroundFoodVisibilityPublic)
	status = strings.TrimSpace(status)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("name LIKE ? OR description LIKE ? OR submitted_username LIKE ?", like, like, like)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var foods []*UIPlaygroundFood
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&foods).Error
	if err != nil {
		return nil, 0, err
	}
	return UIPlaygroundFoodViews(foods), total, nil
}

func GetUIPlaygroundFoodById(id int64) (*UIPlaygroundFood, error) {
	if id <= 0 {
		return nil, errors.New("无效的菜品 ID")
	}
	var food UIPlaygroundFood
	err := DB.Omit("image").Where("id = ? AND deleted_at = ?", id, 0).First(&food).Error
	return &food, err
}

func GetUIPlaygroundFoodImage(id int64) (*UIPlaygroundFood, error) {
	if id <= 0 {
		return nil, errors.New("无效的菜品 ID")
	}
	var food UIPlaygroundFood
	err := DB.Select("id", "image", "image_type", "status", "visibility", "submitted_by", "updated_at").
		Where("id = ? AND deleted_at = ?", id, 0).
		First(&food).Error
	return &food, err
}

func CreateUIPlaygroundFood(food *UIPlaygroundFood) error {
	if err := ValidateUIPlaygroundFood(food); err != nil {
		return err
	}
	now := common.GetTimestamp()
	food.Id = 0
	food.CreatedAt = now
	food.UpdatedAt = now
	if food.Status != UIPlaygroundFoodStatusPending {
		food.ReviewedAt = now
	}
	return DB.Create(food).Error
}

func UpdateUIPlaygroundFood(food *UIPlaygroundFood, hasImage bool) error {
	if err := ValidateUIPlaygroundFood(food); err != nil {
		return err
	}
	now := common.GetTimestamp()
	updates := map[string]interface{}{
		"name":        food.Name,
		"description": food.Description,
		"category":    food.Category,
		"icon":        food.Icon,
		"status":      food.Status,
		"visibility":  food.Visibility,
		"review_note": food.ReviewNote,
		"reviewed_by": food.ReviewedBy,
		"reviewed_at": food.ReviewedAt,
		"updated_at":  now,
	}
	if hasImage {
		updates["image"] = food.Image
		updates["image_type"] = food.ImageType
	}
	return DB.Model(&UIPlaygroundFood{}).
		Where("id = ? AND deleted_at = ?", food.Id, 0).
		Updates(updates).Error
}

func ReviewUIPlaygroundFood(food *UIPlaygroundFood, hasImage bool, adminId int, status string) error {
	status = strings.TrimSpace(status)
	if !ValidateUIPlaygroundFoodStatus(status) || status == UIPlaygroundFoodStatusPending {
		return errors.New("审核状态无效")
	}
	food.Status = status
	food.ReviewedBy = adminId
	food.ReviewedAt = common.GetTimestamp()
	return UpdateUIPlaygroundFood(food, hasImage)
}

func DeletePrivateUIPlaygroundFood(id int64, userId int) error {
	if id <= 0 {
		return errors.New("无效的菜品 ID")
	}
	if userId <= 0 {
		return errors.New("无效的用户 ID")
	}
	now := common.GetTimestamp()
	return DB.Model(&UIPlaygroundFood{}).
		Where("id = ? AND submitted_by = ? AND visibility = ? AND deleted_at = ?", id, userId, UIPlaygroundFoodVisibilityPrivate, 0).
		Updates(map[string]interface{}{
			"updated_at": now,
			"deleted_at": now,
		}).Error
}

func DeleteUIPlaygroundFood(id int64, adminId int) error {
	if id <= 0 {
		return errors.New("无效的菜品 ID")
	}
	now := common.GetTimestamp()
	return DB.Model(&UIPlaygroundFood{}).
		Where("id = ? AND deleted_at = ?", id, 0).
		Updates(map[string]interface{}{
			"reviewed_by": adminId,
			"updated_at":  now,
			"deleted_at":  now,
		}).Error
}
