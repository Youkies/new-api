package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ResolveModelAlias inspects the requested model name against the user's
// archive aliases and rewrites it when a match is found.
//
// Two scopes are considered, in order:
//  1. Explicit prefix routing: a request like "slug/alias-name" is parsed as
//     archive slug + alias name. The slug must resolve to an archive the user
//     owns. If the prefix matches but the alias is missing, this is treated
//     as a user error (returns an error).
//  2. Token-bound archive: if the token has a default archive bound, the full
//     model name is looked up as an alias in that archive. A miss falls
//     through to normal routing (no error).
//
// On a successful rewrite this function also overrides ContextKeyUsingGroup
// to the alias's source group (after re-checking the user's access). The
// original user-typed model name is preserved in ContextKeyUserInputAlias so
// future log views can show the user-side name alongside the real model.
//
// Returns the resolved model name (unchanged on miss). Returns a non-nil
// error only when the request must be aborted (disabled alias, permission
// revoked, explicit prefix to a missing alias).
func ResolveModelAlias(c *gin.Context, modelName string) (string, error) {
	if c == nil || modelName == "" {
		return modelName, nil
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		return modelName, nil
	}

	aliasName := modelName
	archiveId := 0
	explicitPrefix := false

	if idx := strings.IndexByte(modelName, '/'); idx > 0 && idx < len(modelName)-1 {
		candidateSlug := modelName[:idx]
		candidateAlias := modelName[idx+1:]
		archive, err := model.GetUserArchiveBySlug(userId, candidateSlug)
		if err == nil && archive != nil {
			archiveId = archive.Id
			aliasName = candidateAlias
			explicitPrefix = true
		} else if err != nil && !errors.Is(err, model.ErrArchiveNotFound) {
			common.SysLog("archive slug lookup failed: " + err.Error())
		}
	}

	if !explicitPrefix {
		if v, ok := common.GetContextKey(c, constant.ContextKeyTokenArchiveId); ok {
			if id, ok2 := v.(int); ok2 && id > 0 {
				archiveId = id
			}
		}
	}

	if archiveId == 0 {
		return modelName, nil
	}

	alias, err := model.LookupAliasInArchive(archiveId, aliasName)
	if err != nil {
		common.SysLog("alias lookup failed: " + err.Error())
		return modelName, nil
	}
	if alias == nil {
		if explicitPrefix {
			return modelName, fmt.Errorf("别名 '%s' 在指定存档中不存在", aliasName)
		}
		return modelName, nil
	}

	if alias.DisabledReason != "" {
		return modelName, fmt.Errorf("别名 '%s' 已禁用 (%s)", aliasName, alias.DisabledReason)
	}

	userGroup, gerr := model.GetUserGroup(userId, false)
	if gerr != nil {
		return modelName, fmt.Errorf("校验用户分组失败: %v", gerr)
	}
	if !GroupInUserUsableGroups(userGroup, alias.SourceGroup) {
		return modelName, fmt.Errorf("您没有别名源分组 '%s' 的访问权限", alias.SourceGroup)
	}

	common.SetContextKey(c, constant.ContextKeyUserInputAlias, modelName)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, alias.SourceGroup)
	return alias.SourceModel, nil
}
