package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newGinCtxForUser(userId int) *gin.Context {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("id", userId)
	return c
}

func seedAliasUser(t *testing.T, id int, group string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:    id,
		Group: group,
	}).Error)
}

func seedAliasArchive(t *testing.T, userId int, name string) *model.UserModelArchive {
	t.Helper()
	a := &model.UserModelArchive{UserId: userId, Name: name}
	require.NoError(t, a.Insert())
	return a
}

func seedAlias(t *testing.T, archiveId int, name, group, real string) *model.UserModelAlias {
	t.Helper()
	al := &model.UserModelAlias{
		ArchiveId:   archiveId,
		AliasName:   name,
		SourceGroup: group,
		SourceModel: real,
	}
	require.NoError(t, al.Insert())
	return al
}

func TestResolveModelAlias_NoArchiveBoundPassthrough(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1001, "default")
	c := newGinCtxForUser(1001)

	got, err := ResolveModelAlias(c, "gpt-4")
	require.NoError(t, err)
	require.Equal(t, "gpt-4", got)
}

func TestResolveModelAlias_BoundArchiveHitRewritesModelAndGroup(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1002, "default")
	archive := seedAliasArchive(t, 1002, "myArchive")
	seedAlias(t, archive.Id, "cheap", "vip", "claude-3-5-sonnet")

	c := newGinCtxForUser(1002)
	common.SetContextKey(c, constant.ContextKeyTokenArchiveId, archive.Id)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")

	got, err := ResolveModelAlias(c, "cheap")
	require.NoError(t, err)
	require.Equal(t, "claude-3-5-sonnet", got)

	require.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	require.Equal(t, "cheap", common.GetContextKeyString(c, constant.ContextKeyUserInputAlias))
}

func TestResolveModelAlias_BoundArchiveMissPassesThrough(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1003, "default")
	archive := seedAliasArchive(t, 1003, "myArchive")
	seedAlias(t, archive.Id, "cheap", "vip", "claude-3-5-sonnet")

	c := newGinCtxForUser(1003)
	common.SetContextKey(c, constant.ContextKeyTokenArchiveId, archive.Id)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")

	got, err := ResolveModelAlias(c, "gpt-4o")
	require.NoError(t, err)
	require.Equal(t, "gpt-4o", got)
	// Group must NOT be touched on miss.
	require.Equal(t, "default", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
}

func TestResolveModelAlias_DisabledAliasRejected(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1004, "default")
	archive := seedAliasArchive(t, 1004, "myArchive")
	al := &model.UserModelAlias{
		ArchiveId:      archive.Id,
		AliasName:      "broken",
		SourceGroup:    "vip",
		SourceModel:    "claude-3-5-sonnet",
		DisabledReason: "model_not_available_in_source_group",
	}
	require.NoError(t, al.Insert())

	c := newGinCtxForUser(1004)
	common.SetContextKey(c, constant.ContextKeyTokenArchiveId, archive.Id)

	_, err := ResolveModelAlias(c, "broken")
	require.Error(t, err)
	require.Contains(t, err.Error(), "已禁用")
}

func TestResolveModelAlias_SourceGroupPermissionRevoked(t *testing.T) {
	truncate(t)
	// User is in "default" only; alias points to a non-usable group.
	seedAliasUser(t, 1005, "default")
	archive := seedAliasArchive(t, 1005, "myArchive")
	// "ghost-group" is not in the default usable groups (default/vip), so
	// access is denied at hook time even though the alias exists.
	seedAlias(t, archive.Id, "cheap", "ghost-group", "claude-3-5-sonnet")

	c := newGinCtxForUser(1005)
	common.SetContextKey(c, constant.ContextKeyTokenArchiveId, archive.Id)

	_, err := ResolveModelAlias(c, "cheap")
	require.Error(t, err)
	require.Contains(t, err.Error(), "ghost-group")
}

func TestResolveModelAlias_ExplicitPrefixHit(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1006, "default")
	archive := seedAliasArchive(t, 1006, "myArchive")
	seedAlias(t, archive.Id, "cheap", "vip", "claude-3-5-sonnet")

	// No token-bound archive — only prefix routing should work.
	c := newGinCtxForUser(1006)

	got, err := ResolveModelAlias(c, archive.Slug+"/cheap")
	require.NoError(t, err)
	require.Equal(t, "claude-3-5-sonnet", got)
	require.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
}

func TestResolveModelAlias_ExplicitPrefixMissReturnsError(t *testing.T) {
	truncate(t)
	seedAliasUser(t, 1007, "default")
	archive := seedAliasArchive(t, 1007, "myArchive")
	seedAlias(t, archive.Id, "cheap", "vip", "claude-3-5-sonnet")

	c := newGinCtxForUser(1007)

	_, err := ResolveModelAlias(c, archive.Slug+"/nonexistent")
	require.Error(t, err)
	require.Contains(t, err.Error(), "不存在")
}

func TestResolveModelAlias_UnknownPrefixPassesThrough(t *testing.T) {
	// A slash in the model name that doesn't match any of the user's archive
	// slugs is treated as a normal model name (e.g. "anthropic/claude-..."),
	// not a routing error.
	truncate(t)
	seedAliasUser(t, 1008, "default")

	c := newGinCtxForUser(1008)
	got, err := ResolveModelAlias(c, "anthropic/claude-3-5-sonnet")
	require.NoError(t, err)
	require.Equal(t, "anthropic/claude-3-5-sonnet", got)
}
