package controller

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type archiveDTO struct {
	Id           int     `json:"id"`
	Name         string  `json:"name"`
	Slug         string  `json:"slug"`
	Description  string  `json:"description"`
	ShareCode    *string `json:"share_code"`
	ShareEnabled bool    `json:"share_enabled"`
	CreatedTime  int64   `json:"created_time"`
	UpdatedTime  int64   `json:"updated_time"`
	AliasCount   int     `json:"alias_count"`
}

type aliasDTO struct {
	Id             int    `json:"id"`
	ArchiveId      int    `json:"archive_id"`
	AliasName      string `json:"alias_name"`
	SourceGroup    string `json:"source_group"`
	SourceModel    string `json:"source_model"`
	DisabledReason string `json:"disabled_reason"`
	CreatedTime    int64  `json:"created_time"`
	UpdatedTime    int64  `json:"updated_time"`
}

func toArchiveDTO(a *model.UserModelArchive, aliasCount int) archiveDTO {
	return archiveDTO{
		Id:           a.Id,
		Name:         a.Name,
		Slug:         a.Slug,
		Description:  a.Description,
		ShareCode:    a.ShareCode,
		ShareEnabled: a.ShareEnabled,
		CreatedTime:  a.CreatedTime,
		UpdatedTime:  a.UpdatedTime,
		AliasCount:   aliasCount,
	}
}

func toAliasDTO(al *model.UserModelAlias) aliasDTO {
	return aliasDTO{
		Id:             al.Id,
		ArchiveId:      al.ArchiveId,
		AliasName:      al.AliasName,
		SourceGroup:    al.SourceGroup,
		SourceModel:    al.SourceModel,
		DisabledReason: al.DisabledReason,
		CreatedTime:    al.CreatedTime,
		UpdatedTime:    al.UpdatedTime,
	}
}

// GET /api/archive — list current user's archives with alias counts.
func ListUserArchives(c *gin.Context) {
	userId := c.GetInt("id")
	archives, err := model.ListUserArchives(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	ids := make([]int, 0, len(archives))
	for _, a := range archives {
		ids = append(ids, a.Id)
	}
	counts, err := model.CountAliasesPerArchive(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]archiveDTO, 0, len(archives))
	for _, a := range archives {
		items = append(items, toArchiveDTO(a, counts[a.Id]))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// GET /api/archive/:id — fetch one archive with its aliases.
func GetUserArchive(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	a, err := model.GetUserArchive(id, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	aliases, err := model.ListArchiveAliases(a.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	aliasItems := make([]aliasDTO, 0, len(aliases))
	for _, al := range aliases {
		aliasItems = append(aliasItems, toAliasDTO(al))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"archive": toArchiveDTO(a, len(aliases)),
			"aliases": aliasItems,
		},
	})
}

type archiveCreateReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Slug        string `json:"slug"`
}

type archiveUpdateReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Slug        string `json:"slug"`
}

// POST /api/archive
func CreateUserArchive(c *gin.Context) {
	userId := c.GetInt("id")
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req archiveCreateReq
	if err := common.Unmarshal(body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	a := &model.UserModelArchive{
		UserId:      userId,
		Name:        strings.TrimSpace(req.Name),
		Description: strings.TrimSpace(req.Description),
		Slug:        strings.TrimSpace(req.Slug),
	}
	if err := a.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toArchiveDTO(a, 0)})
}

// PUT /api/archive/:id
func UpdateUserArchive(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req archiveUpdateReq
	if err := common.Unmarshal(body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	a, err := model.GetUserArchive(id, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := a.UpdateMeta(strings.TrimSpace(req.Name), strings.TrimSpace(req.Description), strings.TrimSpace(req.Slug)); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toArchiveDTO(a, 0)})
}

// DELETE /api/archive/:id
func DeleteUserArchive(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	a, err := model.GetUserArchive(id, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := a.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// POST /api/archive/:id/share — enable share, return code.
func EnableArchiveShare(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	a, err := model.GetUserArchive(id, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := a.EnableShare(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"share_code":    a.ShareCode,
		"share_enabled": a.ShareEnabled,
	}})
}

// DELETE /api/archive/:id/share — disable share.
func DisableArchiveShare(c *gin.Context) {
	userId := c.GetInt("id")
	id, _ := strconv.Atoi(c.Param("id"))
	a, err := model.GetUserArchive(id, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := a.DisableShare(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

type aliasReq struct {
	AliasName   string `json:"alias_name"`
	SourceGroup string `json:"source_group"`
	SourceModel string `json:"source_model"`
}

// validateAliasSource checks the user can access source_group and that the
// source_model exists in that group. Returns the disabled_reason if it should
// be created in disabled state, or an error if the request must be rejected.
func validateAliasSource(c *gin.Context, sourceGroup, sourceModel string) (disabledReason string, err error) {
	userId := c.GetInt("id")
	userGroup, gerr := model.GetUserGroup(userId, false)
	if gerr != nil {
		return "", gerr
	}
	if !service.GroupInUserUsableGroups(userGroup, sourceGroup) {
		return "", errors.New("您没有该分组的访问权限")
	}
	models := model.GetGroupEnabledModels(sourceGroup)
	for _, m := range models {
		if m == sourceModel {
			return "", nil
		}
	}
	// Group is accessible but the specific model is not currently enabled in it.
	// Allow creation but mark disabled so users can fix configuration later.
	return "model_not_available_in_source_group", nil
}

// POST /api/archive/:id/aliases — create alias.
func CreateArchiveAlias(c *gin.Context) {
	userId := c.GetInt("id")
	archiveId, _ := strconv.Atoi(c.Param("id"))
	a, err := model.GetUserArchive(archiveId, userId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req aliasReq
	if err := common.Unmarshal(body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.AliasName = strings.TrimSpace(req.AliasName)
	req.SourceGroup = strings.TrimSpace(req.SourceGroup)
	req.SourceModel = strings.TrimSpace(req.SourceModel)
	disabledReason, verr := validateAliasSource(c, req.SourceGroup, req.SourceModel)
	if verr != nil {
		common.ApiErrorMsg(c, verr.Error())
		return
	}
	al := &model.UserModelAlias{
		ArchiveId:      a.Id,
		AliasName:      req.AliasName,
		SourceGroup:    req.SourceGroup,
		SourceModel:    req.SourceModel,
		DisabledReason: disabledReason,
	}
	if err := al.Insert(); err != nil {
		if errors.Is(err, model.ErrArchiveAliasDuplicate) {
			common.ApiErrorMsg(c, "该存档已存在同名别名")
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toAliasDTO(al)})
}

// PUT /api/archive/:id/aliases/:aliasId — update alias.
func UpdateArchiveAlias(c *gin.Context) {
	userId := c.GetInt("id")
	archiveId, _ := strconv.Atoi(c.Param("id"))
	aliasId, _ := strconv.Atoi(c.Param("aliasId"))
	if _, err := model.GetUserArchive(archiveId, userId); err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	al, err := model.GetArchiveAlias(archiveId, aliasId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveAliasNotFound) {
			common.ApiErrorMsg(c, "别名不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req aliasReq
	if err := common.Unmarshal(body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	req.AliasName = strings.TrimSpace(req.AliasName)
	req.SourceGroup = strings.TrimSpace(req.SourceGroup)
	req.SourceModel = strings.TrimSpace(req.SourceModel)
	disabledReason, verr := validateAliasSource(c, req.SourceGroup, req.SourceModel)
	if verr != nil {
		common.ApiErrorMsg(c, verr.Error())
		return
	}
	if err := al.UpdateAlias(req.AliasName, req.SourceGroup, req.SourceModel, disabledReason); err != nil {
		if errors.Is(err, model.ErrArchiveAliasDuplicate) {
			common.ApiErrorMsg(c, "该存档已存在同名别名")
			return
		}
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toAliasDTO(al)})
}

// DELETE /api/archive/:id/aliases/:aliasId — delete alias.
func DeleteArchiveAlias(c *gin.Context) {
	userId := c.GetInt("id")
	archiveId, _ := strconv.Atoi(c.Param("id"))
	aliasId, _ := strconv.Atoi(c.Param("aliasId"))
	if _, err := model.GetUserArchive(archiveId, userId); err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "存档不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	al, err := model.GetArchiveAlias(archiveId, aliasId)
	if err != nil {
		if errors.Is(err, model.ErrArchiveAliasNotFound) {
			common.ApiErrorMsg(c, "别名不存在")
			return
		}
		common.ApiError(c, err)
		return
	}
	if err := al.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GET /api/archive/options — return groups + models the current user can target
// when picking source for an alias.
func GetArchiveOptions(c *gin.Context) {
	userId := c.GetInt("id")
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usable := service.GetUserUsableGroups(userGroup)
	type groupOpt struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Models      []string `json:"models"`
	}
	groups := make([]groupOpt, 0, len(usable))
	for g, desc := range usable {
		groups = append(groups, groupOpt{
			Name:        g,
			Description: desc,
			Models:      model.GetGroupEnabledModels(g),
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"groups": groups}})
}

type sharePreviewAlias struct {
	AliasName   string `json:"alias_name"`
	SourceGroup string `json:"source_group"`
	SourceModel string `json:"source_model"`
	Accessible  bool   `json:"accessible"`
}

// GET /api/archive/share/:code — public preview of a shared archive.
func GetSharedArchivePreview(c *gin.Context) {
	code := strings.TrimSpace(c.Param("code"))
	a, err := model.GetArchiveByShareCode(code)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "分享码无效或已失效")
			return
		}
		common.ApiError(c, err)
		return
	}
	aliases, err := model.ListArchiveAliases(a.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	userGroup, _ := model.GetUserGroup(userId, false)
	usable := service.GetUserUsableGroups(userGroup)
	preview := make([]sharePreviewAlias, 0, len(aliases))
	for _, al := range aliases {
		_, ok := usable[al.SourceGroup]
		preview = append(preview, sharePreviewAlias{
			AliasName:   al.AliasName,
			SourceGroup: al.SourceGroup,
			SourceModel: al.SourceModel,
			Accessible:  ok,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"name":         a.Name,
		"description":  a.Description,
		"alias_count":  len(aliases),
		"aliases":      preview,
		"is_own":       a.UserId == userId,
	}})
}

type shareImportReq struct {
	Name string `json:"name"` // optional, overrides source archive name
	Slug string `json:"slug"` // optional
}

// POST /api/archive/share/:code/import — copy a shared archive into current user.
func ImportSharedArchive(c *gin.Context) {
	userId := c.GetInt("id")
	code := strings.TrimSpace(c.Param("code"))
	src, err := model.GetArchiveByShareCode(code)
	if err != nil {
		if errors.Is(err, model.ErrArchiveNotFound) {
			common.ApiErrorMsg(c, "分享码无效或已失效")
			return
		}
		common.ApiError(c, err)
		return
	}
	if src.UserId == userId {
		common.ApiErrorMsg(c, "无法导入自己的存档")
		return
	}
	body, _ := io.ReadAll(c.Request.Body)
	var req shareImportReq
	if len(body) > 0 {
		_ = common.Unmarshal(body, &req)
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = src.Name
	}
	slug := strings.TrimSpace(req.Slug)
	newArchive := &model.UserModelArchive{
		UserId:      userId,
		Name:        name,
		Description: src.Description,
		Slug:        slug,
	}
	if err := newArchive.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	srcAliases, err := model.ListArchiveAliases(src.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userGroup, _ := model.GetUserGroup(userId, false)
	usable := service.GetUserUsableGroups(userGroup)
	createdCount := 0
	for _, al := range srcAliases {
		dup := &model.UserModelAlias{
			ArchiveId:   newArchive.Id,
			AliasName:   al.AliasName,
			SourceGroup: al.SourceGroup,
			SourceModel: al.SourceModel,
		}
		if _, ok := usable[al.SourceGroup]; !ok {
			dup.DisabledReason = "no_access_to_source_group"
		} else {
			models := model.GetGroupEnabledModels(al.SourceGroup)
			found := false
			for _, m := range models {
				if m == al.SourceModel {
					found = true
					break
				}
			}
			if !found {
				dup.DisabledReason = "model_not_available_in_source_group"
			}
		}
		if err := dup.Insert(); err != nil {
			// Duplicate aliases within the source archive should never happen
			// (unique constraint), but if it does we surface and skip.
			continue
		}
		createdCount++
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"archive_id":     newArchive.Id,
		"slug":           newArchive.Slug,
		"created_count":  createdCount,
		"source_count":   len(srcAliases),
	}})
}
