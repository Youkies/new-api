package controller

import (
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

var (
	checkinLocOnce sync.Once
	checkinLoc     *time.Location
)

// checkinTimezone returns the timezone used for "today" semantics in checkin.
// Configurable via CHECKIN_TIMEZONE env (default Asia/Shanghai).
// Falls back to local time if the zone fails to load.
func checkinTimezone() *time.Location {
	checkinLocOnce.Do(func() {
		name := os.Getenv("CHECKIN_TIMEZONE")
		if name == "" {
			name = "Asia/Shanghai"
		}
		loc, err := time.LoadLocation(name)
		if err != nil || loc == nil {
			checkinLoc = time.Local
			return
		}
		checkinLoc = loc
	})
	return checkinLoc
}

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	minQuota, maxQuota := operation_setting.GetCheckinQuotaRangeForGroup(userGroup)

	loc := checkinTimezone()
	// 获取月份参数，默认为当前月份（按签到时区）
	month := c.DefaultQuery("month", time.Now().In(loc).Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":         setting.Enabled,
			"min_quota":       minQuota,
			"max_quota":       maxQuota,
			"user_group":      userGroup,
			"server_now":      time.Now().Unix(),
			"next_checkin_at": nextLocalMidnight().Unix(),
			"stats":           stats,
		},
	})
}

// nextLocalMidnight 返回签到时区下一零点
func nextLocalMidnight() time.Time {
	loc := checkinTimezone()
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, loc)
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到，获得额度 %s", logger.LogQuota(checkin.QuotaAwarded)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded": checkin.QuotaAwarded,
			"checkin_date":  checkin.CheckinDate},
	})
}
