package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	DebugKeyTraceStatusSuccess        = "success"
	DebugKeyTraceStatusError          = "error"
	DebugKeyTraceStatusClientCanceled = "client_canceled"
)

type DebugKeyTrace struct {
	Id                    int64  `json:"id"`
	RequestId             string `json:"request_id" gorm:"type:varchar(64);index"`
	CreatedAt             int64  `json:"created_at" gorm:"bigint;index"`
	UserId                int    `json:"user_id" gorm:"index"`
	Username              string `json:"username" gorm:"type:varchar(191);index;default:''"`
	TokenId               int    `json:"token_id" gorm:"index"`
	TokenName             string `json:"token_name" gorm:"type:varchar(191);index;default:''"`
	ModelName             string `json:"model_name" gorm:"type:varchar(191);index;default:''"`
	Group                 string `json:"group" gorm:"type:varchar(191);index;default:''"`
	RequestMethod         string `json:"request_method" gorm:"type:varchar(16);default:''"`
	RequestPath           string `json:"request_path" gorm:"type:varchar(512);index;default:''"`
	RelayFormat           string `json:"relay_format" gorm:"type:varchar(64);default:''"`
	FinalRelayFormat      string `json:"final_relay_format" gorm:"type:varchar(64);default:''"`
	RelayMode             int    `json:"relay_mode" gorm:"default:0"`
	IsStream              bool   `json:"is_stream"`
	ChannelId             int    `json:"channel_id" gorm:"index;default:0"`
	ChannelName           string `json:"channel_name" gorm:"type:varchar(191);default:''"`
	ChannelType           int    `json:"channel_type" gorm:"default:0"`
	UseChannel            string `json:"use_channel" gorm:"type:text"`
	Status                string `json:"status" gorm:"type:varchar(32);index;default:''"`
	HttpStatus            int    `json:"http_status" gorm:"default:0"`
	UpstreamStatus        int    `json:"upstream_status" gorm:"default:0"`
	ErrorType             string `json:"error_type" gorm:"type:varchar(64);default:''"`
	ErrorCode             string `json:"error_code" gorm:"type:varchar(128);default:''"`
	ErrorMessage          string `json:"error_message" gorm:"type:text"`
	RequestHeaders        string `json:"request_headers" gorm:"type:text"`
	RequestBody           string `json:"request_body" gorm:"type:text"`
	RequestBodyTruncated  bool   `json:"request_body_truncated"`
	UpstreamUrl           string `json:"upstream_url" gorm:"type:text"`
	UpstreamHeaders       string `json:"upstream_headers" gorm:"type:text"`
	UpstreamBody          string `json:"upstream_body" gorm:"type:text"`
	UpstreamBodyTruncated bool   `json:"upstream_body_truncated"`
	ResponseHeaders       string `json:"response_headers" gorm:"type:text"`
	ResponseBody          string `json:"response_body" gorm:"type:text"`
	ResponseBodyTruncated bool   `json:"response_body_truncated"`
	ResponseSize          int64  `json:"response_size" gorm:"default:0"`
	UseTime               int    `json:"use_time" gorm:"default:0"`
	AdminInfo             string `json:"admin_info" gorm:"type:text"`
}

type DebugKeyTraceQuery struct {
	Status    string
	RequestId string
	Keyword   string
	TokenId   int
	UserId    int
	StartTime int64
	EndTime   int64
}

func CreateDebugKeyTrace(trace *DebugKeyTrace) error {
	return LOG_DB.Create(trace).Error
}

func GetDebugKeyTraceById(id int64) (*DebugKeyTrace, error) {
	trace := &DebugKeyTrace{}
	err := LOG_DB.First(trace, "id = ?", id).Error
	return trace, err
}

func DeleteDebugKeyTraceById(id int64) error {
	return LOG_DB.Delete(&DebugKeyTrace{}, "id = ?", id).Error
}

func GetAdminDebugKeyTraces(pageInfo *common.PageInfo, query DebugKeyTraceQuery) ([]*DebugKeyTrace, int64, error) {
	tx := LOG_DB.Model(&DebugKeyTrace{})
	tx = applyDebugKeyTraceFilters(tx, query)

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var traces []*DebugKeyTrace
	err := tx.
		Omit("request_headers", "request_body", "upstream_headers", "upstream_body", "response_headers", "response_body", "admin_info").
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&traces).Error
	return traces, total, err
}

func applyDebugKeyTraceFilters(tx *gorm.DB, query DebugKeyTraceQuery) *gorm.DB {
	if query.Status != "" {
		tx = tx.Where("status = ?", query.Status)
	}
	if query.RequestId != "" {
		tx = tx.Where("request_id = ?", query.RequestId)
	}
	if query.TokenId > 0 {
		tx = tx.Where("token_id = ?", query.TokenId)
	}
	if query.UserId > 0 {
		tx = tx.Where("user_id = ?", query.UserId)
	}
	if query.StartTime > 0 {
		tx = tx.Where("created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		tx = tx.Where("created_at <= ?", query.EndTime)
	}
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		tx = tx.Where(
			"username LIKE ? OR token_name LIKE ? OR model_name LIKE ? OR request_path LIKE ? OR error_message LIKE ?",
			pattern, pattern, pattern, pattern, pattern,
		)
	}
	return tx
}
