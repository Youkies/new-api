package controller

import (
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const maxPlaygroundFoodImageSize = 800 * 1024

type uiPlaygroundFoodReviewPayload struct {
	ReviewNote string `json:"review_note"`
}

func ListUIPlaygroundFoods(c *gin.Context) {
	foods, err := model.ListUIPlaygroundFoods(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": foods})
}

func CreateUIPlaygroundFoodSubmission(c *gin.Context) {
	image, imageType, hasImage, err := readPlaygroundFoodImage(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !hasImage {
		common.ApiErrorMsg(c, "请上传菜品图片")
		return
	}
	userId := c.GetInt("id")
	food := &model.UIPlaygroundFood{
		Status:      model.UIPlaygroundFoodStatusPending,
		Visibility:  model.UIPlaygroundFoodVisibilityPublic,
		Source:      model.UIPlaygroundFoodSourceUser,
		SubmittedBy: userId,
		Image:       image,
		ImageType:   imageType,
	}
	applyUIPlaygroundFoodForm(food, c)
	food.SubmittedUsername = getUIPlaygroundFoodUsername(userId)
	if err = model.CreateUIPlaygroundFood(food); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, food.ToView())
}

func CreatePrivateUIPlaygroundFood(c *gin.Context) {
	image, imageType, hasImage, err := readPlaygroundFoodImage(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	food := &model.UIPlaygroundFood{
		Status:      model.UIPlaygroundFoodStatusApproved,
		Visibility:  model.UIPlaygroundFoodVisibilityPrivate,
		Source:      model.UIPlaygroundFoodSourceUser,
		SubmittedBy: userId,
	}
	if hasImage {
		food.Image = image
		food.ImageType = imageType
	}
	applyUIPlaygroundFoodForm(food, c)
	food.SubmittedUsername = getUIPlaygroundFoodUsername(userId)
	if err = model.CreateUIPlaygroundFood(food); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, food.ToView())
}

func DeletePrivateUIPlaygroundFood(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeletePrivateUIPlaygroundFood(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetUIPlaygroundFoodImage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	food, err := model.GetUIPlaygroundFoodImage(id)
	if err != nil || food == nil || len(food.Image) == 0 {
		c.Status(http.StatusNotFound)
		return
	}
	if food.Visibility == model.UIPlaygroundFoodVisibilityPrivate && food.SubmittedBy != c.GetInt("id") {
		c.Status(http.StatusNotFound)
		return
	}
	data := food.Image
	contentType := food.ImageType
	if contentType == "" {
		contentType = "image/jpeg"
	}
	etag := fmt.Sprintf(`"%d-%d-%08x"`, id, food.UpdatedAt, crc32.ChecksumIEEE(data))
	if match := c.GetHeader("If-None-Match"); match != "" && strings.Contains(match, etag) {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("Cache-Control", "no-cache")
	c.Header("ETag", etag)
	c.Data(http.StatusOK, contentType, data)
}

func AdminListUIPlaygroundFoods(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := strings.TrimSpace(c.Query("status"))
	if status != "" && !model.ValidateUIPlaygroundFoodStatus(status) {
		common.ApiErrorMsg(c, "菜品状态无效")
		return
	}
	keyword := strings.TrimSpace(c.Query("keyword"))
	foods, total, err := model.GetAdminUIPlaygroundFoods(pageInfo, status, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(foods)
	common.ApiSuccess(c, pageInfo)
}

func AdminGetUIPlaygroundFood(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	food, err := model.GetUIPlaygroundFoodById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, food.ToView())
}

func AdminUpdateUIPlaygroundFood(c *gin.Context) {
	food, err := getAdminUIPlaygroundFoodFromParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	image, imageType, hasImage, err := readPlaygroundFoodImage(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	applyUIPlaygroundFoodForm(food, c)
	if hasImage {
		food.Image = image
		food.ImageType = imageType
	}
	if err = model.UpdateUIPlaygroundFood(food, hasImage); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetUIPlaygroundFoodById(food.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated.ToView())
}

func AdminApproveUIPlaygroundFood(c *gin.Context) {
	food, err := getAdminUIPlaygroundFoodFromParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	image, imageType, hasImage, err := readPlaygroundFoodImage(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	applyUIPlaygroundFoodForm(food, c)
	if hasImage {
		food.Image = image
		food.ImageType = imageType
	}
	if food.ImageType == "" && !hasImage {
		common.ApiErrorMsg(c, "菜品缺少图片，无法加入菜品池")
		return
	}
	if err = model.ReviewUIPlaygroundFood(food, hasImage, c.GetInt("id"), model.UIPlaygroundFoodStatusApproved); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetUIPlaygroundFoodById(food.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated.ToView())
}

func AdminRejectUIPlaygroundFood(c *gin.Context) {
	food, err := getAdminUIPlaygroundFoodFromParam(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var payload uiPlaygroundFoodReviewPayload
	if err = c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	food.ReviewNote = payload.ReviewNote
	if err = model.ReviewUIPlaygroundFood(food, false, c.GetInt("id"), model.UIPlaygroundFoodStatusRejected); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetUIPlaygroundFoodById(food.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated.ToView())
}

func AdminDeleteUIPlaygroundFood(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteUIPlaygroundFood(id, c.GetInt("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func getAdminUIPlaygroundFoodFromParam(c *gin.Context) (*model.UIPlaygroundFood, error) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return nil, err
	}
	food, err := model.GetUIPlaygroundFoodById(id)
	if err != nil {
		return nil, err
	}
	if food.Visibility != model.UIPlaygroundFoodVisibilityPublic {
		return nil, errors.New("只能审核公共投稿菜品")
	}
	return food, nil
}

func applyUIPlaygroundFoodForm(food *model.UIPlaygroundFood, c *gin.Context) {
	if name, ok := c.GetPostForm("name"); ok {
		food.Name = name
	}
	if description, ok := c.GetPostForm("description"); ok {
		food.Description = description
	}
	if category, ok := c.GetPostForm("category"); ok {
		food.Category = category
	}
	if icon, ok := c.GetPostForm("icon"); ok {
		food.Icon = icon
	}
	if reviewNote, ok := c.GetPostForm("review_note"); ok {
		food.ReviewNote = reviewNote
	}
}

func readPlaygroundFoodImage(c *gin.Context) ([]byte, string, bool, error) {
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) || strings.Contains(err.Error(), "no such file") {
			return nil, "", false, nil
		}
		return nil, "", false, err
	}
	defer file.Close()

	if header.Size > maxPlaygroundFoodImageSize {
		return nil, "", false, fmt.Errorf("菜品图片不能超过 %dKB", maxPlaygroundFoodImageSize/1024)
	}
	data, err := io.ReadAll(io.LimitReader(file, maxPlaygroundFoodImageSize+1))
	if err != nil {
		return nil, "", false, err
	}
	if len(data) == 0 {
		return nil, "", false, errors.New("菜品图片不能为空")
	}
	if len(data) > maxPlaygroundFoodImageSize {
		return nil, "", false, fmt.Errorf("菜品图片不能超过 %dKB", maxPlaygroundFoodImageSize/1024)
	}
	contentType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if !allowedImageTypes[contentType] {
		detected := http.DetectContentType(data)
		if allowedImageTypes[detected] {
			contentType = detected
		}
	}
	if !allowedImageTypes[contentType] {
		return nil, "", false, errors.New("不支持的图片类型，仅支持 jpeg/png/webp/gif")
	}
	return data, contentType, true, nil
}

func getUIPlaygroundFoodUsername(userId int) string {
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		return ""
	}
	if user.DisplayName != "" {
		return user.DisplayName
	}
	return user.Username
}
