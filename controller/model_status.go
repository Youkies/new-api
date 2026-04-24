package controller

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type modelStatusSlot struct {
	Slot        int     `json:"slot"`
	StartTime   int64   `json:"start_time"`
	EndTime     int64   `json:"end_time"`
	Total       int     `json:"total"`
	Success     int     `json:"success"`
	SuccessRate float64 `json:"success_rate"`
	Status      string  `json:"status"`
}

type modelStatusEntry struct {
	ModelName   string            `json:"model_name"`
	Status      string            `json:"status"`
	SuccessRate float64           `json:"success_rate"`
	TotalReqs   int               `json:"total_requests"`
	Slots       []modelStatusSlot `json:"slots"`
}

type modelStatusResponse struct {
	Models    []modelStatusEntry `json:"models"`
	Window    string             `json:"window"`
	UpdatedAt int64              `json:"updated_at"`
}

type slotAggRow struct {
	ModelName string
	Slot      int
	Total     int
	Success   int
}

var windowConfigs = map[string][3]int64{
	"1h":  {3600, 60, 60},
	"6h":  {21600, 24, 900},
	"12h": {43200, 24, 1800},
	"24h": {86400, 24, 3600},
}

func GetModelStatus(c *gin.Context) {
	window := c.DefaultQuery("window", "1h")
	cfg, ok := windowConfigs[window]
	if !ok {
		common.ApiErrorMsg(c, "invalid window, must be one of: 1h, 6h, 12h, 24h")
		return
	}
	windowSeconds := cfg[0]
	numSlots := int(cfg[1])
	slotSeconds := cfg[2]

	var models []string
	err := model.DB.Table("abilities").
		Select("DISTINCT abilities.model").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("channels.status = ? AND abilities.enabled = ?", 1, true).
		Pluck("model", &models).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if len(models) == 0 {
		common.ApiSuccess(c, modelStatusResponse{
			Models:    []modelStatusEntry{},
			Window:    window,
			UpdatedAt: time.Now().Unix(),
		})
		return
	}

	now := time.Now().Unix()
	windowStart := now - windowSeconds

	logIsPostgres := common.LogSqlType == common.DatabaseTypePostgreSQL ||
		(common.LogSqlType == common.DatabaseTypeSQLite && common.UsingPostgreSQL)
	logIsSQLite := common.UsingSQLite && common.LogSqlType == common.DatabaseTypeSQLite

	var floorExpr string
	if logIsPostgres {
		floorExpr = fmt.Sprintf("FLOOR((created_at - %d) / %d)::integer", windowStart, slotSeconds)
	} else if logIsSQLite {
		floorExpr = fmt.Sprintf("CAST((created_at - %d) / %d AS INTEGER)", windowStart, slotSeconds)
	} else {
		floorExpr = fmt.Sprintf("FLOOR((created_at - %d) / %d)", windowStart, slotSeconds)
	}

	var rows []slotAggRow
	err = model.LOG_DB.Table("logs").
		Select(fmt.Sprintf(
			"model_name, %s AS slot, COUNT(*) AS total, SUM(CASE WHEN type = 2 THEN 1 ELSE 0 END) AS success",
			floorExpr,
		)).
		Where("type IN (2, 5) AND created_at >= ? AND model_name IN ?", windowStart, models).
		Group(fmt.Sprintf("model_name, %s", floorExpr)).
		Scan(&rows).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type slotKey struct {
		Model string
		Slot  int
	}
	slotMap := make(map[slotKey]slotAggRow, len(rows))
	for _, r := range rows {
		slotMap[slotKey{r.ModelName, r.Slot}] = r
	}

	entries := make([]modelStatusEntry, 0, len(models))
	for _, m := range models {
		slots := make([]modelStatusSlot, numSlots)
		totalReqs := 0
		totalSuccess := 0

		for i := 0; i < numSlots; i++ {
			slotStart := windowStart + int64(i)*slotSeconds
			slotEnd := slotStart + slotSeconds
			s := modelStatusSlot{
				Slot:      i,
				StartTime: slotStart,
				EndTime:   slotEnd,
				Status:    "green",
			}

			if agg, found := slotMap[slotKey{m, i}]; found {
				s.Total = agg.Total
				s.Success = agg.Success
				totalReqs += agg.Total
				totalSuccess += agg.Success
				if s.Total > 0 {
					s.SuccessRate = float64(s.Success) / float64(s.Total) * 100
					s.Status = statusColor(s.SuccessRate)
				}
			}
			slots[i] = s
		}

		var overallRate float64
		overallStatus := "green"
		if totalReqs > 0 {
			overallRate = float64(totalSuccess) / float64(totalReqs) * 100
			overallStatus = statusColor(overallRate)
		}

		entries = append(entries, modelStatusEntry{
			ModelName:   m,
			Status:      overallStatus,
			SuccessRate: overallRate,
			TotalReqs:   totalReqs,
			Slots:       slots,
		})
	}

	common.ApiSuccess(c, modelStatusResponse{
		Models:    entries,
		Window:    window,
		UpdatedAt: now,
	})
}

func statusColor(rate float64) string {
	if rate >= 95 {
		return "green"
	}
	if rate >= 80 {
		return "yellow"
	}
	return "red"
}
