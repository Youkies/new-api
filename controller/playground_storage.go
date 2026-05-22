package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type playgroundSessionPayload struct {
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	GroupName string `json:"group_name"`
	Config    string `json:"config"`
}

type playgroundSessionPatch struct {
	Title     *string `json:"title,omitempty"`
	Model     *string `json:"model,omitempty"`
	GroupName *string `json:"group_name,omitempty"`
	Config    *string `json:"config,omitempty"`
}

type playgroundMessagePayload struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning"`
	Model     string `json:"model"`
	GroupName string `json:"group_name"`
	Extra     string `json:"extra"`
}

func ListUIPlaygroundSessions(c *gin.Context) {
	userId := c.GetInt("id")
	kind := strings.TrimSpace(c.Query("kind"))
	sessions, err := model.ListPlaygroundSessions(userId, kind)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": sessions})
}

func CreateUIPlaygroundSession(c *gin.Context) {
	var payload playgroundSessionPayload
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	s := &model.PlaygroundSession{
		UserId:    userId,
		Kind:      strings.TrimSpace(payload.Kind),
		Title:     payload.Title,
		Model:     payload.Model,
		GroupName: payload.GroupName,
		Config:    payload.Config,
	}
	if err := model.CreatePlaygroundSession(s); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, s)
}

func UpdateUIPlaygroundSession(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid session id")
		return
	}
	var patch playgroundSessionPatch
	if err := common.DecodeJson(c.Request.Body, &patch); err != nil {
		common.ApiError(c, err)
		return
	}
	updates := map[string]interface{}{}
	if patch.Title != nil {
		t := strings.TrimSpace(*patch.Title)
		if t == "" {
			t = "新对话"
		}
		if len([]rune(t)) > 80 {
			t = string([]rune(t)[:80])
		}
		updates["title"] = t
	}
	if patch.Model != nil {
		updates["model"] = strings.TrimSpace(*patch.Model)
	}
	if patch.GroupName != nil {
		g := strings.TrimSpace(*patch.GroupName)
		if g == "" {
			g = "auto"
		}
		updates["group_name"] = g
	}
	if patch.Config != nil {
		updates["config"] = *patch.Config
	}
	userId := c.GetInt("id")
	if err := model.UpdatePlaygroundSession(id, userId, updates); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteUIPlaygroundSession(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid session id")
		return
	}
	userId := c.GetInt("id")
	if err := model.DeletePlaygroundSession(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ListUIPlaygroundMessages(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid session id")
		return
	}
	userId := c.GetInt("id")
	msgs, err := model.ListPlaygroundMessages(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": msgs})
}

func CreateUIPlaygroundMessage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid session id")
		return
	}
	var payload playgroundMessagePayload
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	if len(payload.Content) > 200_000 {
		payload.Content = payload.Content[:200_000]
	}
	if len(payload.Reasoning) > 200_000 {
		payload.Reasoning = payload.Reasoning[:200_000]
	}
	if len(payload.Extra) > 64_000 {
		payload.Extra = payload.Extra[:64_000]
	}
	m := &model.PlaygroundMessage{
		SessionId: id,
		UserId:    userId,
		Role:      payload.Role,
		Content:   payload.Content,
		Reasoning: payload.Reasoning,
		Model:     strings.TrimSpace(payload.Model),
		GroupName: strings.TrimSpace(payload.GroupName),
		Extra:     payload.Extra,
	}
	if err := model.AppendPlaygroundMessage(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, m)
}

func DeleteUIPlaygroundMessage(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid message id")
		return
	}
	userId := c.GetInt("id")
	if err := model.DeletePlaygroundMessage(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ClearUIPlaygroundMessages(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid session id")
		return
	}
	userId := c.GetInt("id")
	if err := model.ClearPlaygroundMessages(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
