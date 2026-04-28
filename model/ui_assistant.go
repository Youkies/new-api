package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	UIAssistantProviderSite     = "site"
	UIAssistantProviderExternal = "external"
	UIAssistantProviderBalance  = "site_balance"

	UIAssistantDecisionSelfSolve        = "self_solve"
	UIAssistantDecisionSubmitAppeal     = "submit_appeal"
	UIAssistantDecisionManualReview     = "manual_review"
	UIAssistantDecisionInsufficientInfo = "insufficient_info"
)

type UIAssistantConfig struct {
	Id               int    `json:"id" gorm:"primaryKey"`
	Enabled          bool   `json:"enabled" gorm:"default:false"`
	AssistantName    string `json:"assistant_name" gorm:"type:varchar(100);default:'Youkies 的 AI 分身'"`
	WelcomeMessage   string `json:"welcome_message" gorm:"type:varchar(500);default:''"`
	ProviderType     string `json:"provider_type" gorm:"type:varchar(32);default:'site'"`
	BaseURL          string `json:"base_url" gorm:"type:varchar(500);default:''"`
	APIKey           string `json:"-" gorm:"type:text"`
	ModelName        string `json:"model_name" gorm:"type:varchar(191);default:''"`
	SystemPrompt     string `json:"system_prompt" gorm:"type:text"`
	AllowScreenshot  bool   `json:"allow_screenshot" gorm:"default:true"`
	KnowledgeEnabled bool   `json:"knowledge_enabled" gorm:"default:true"`
	StoreSessions    bool   `json:"store_sessions" gorm:"default:true"`
	DailyLimit       int    `json:"daily_limit" gorm:"default:8"`
	MaxImageBytes    int    `json:"max_image_bytes" gorm:"default:819200"`
	CreatedAt        int64  `json:"created_at" gorm:"default:0"`
	UpdatedAt        int64  `json:"updated_at" gorm:"default:0"`
}

func (UIAssistantConfig) TableName() string {
	return "ui_assistant_configs"
}

type UIAssistantDocument struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title     string `json:"title" gorm:"type:varchar(191);not null"`
	Content   string `json:"content" gorm:"type:text;not null"`
	Enabled   bool   `json:"enabled" gorm:"default:true;index:idx_ui_assistant_docs_enabled_deleted_sort,priority:1"`
	SortOrder int    `json:"sort_order" gorm:"default:0;index:idx_ui_assistant_docs_enabled_deleted_sort,priority:3"`
	CreatedBy int    `json:"created_by" gorm:"default:0"`
	UpdatedBy int    `json:"updated_by" gorm:"default:0"`
	CreatedAt int64  `json:"created_at" gorm:"default:0"`
	UpdatedAt int64  `json:"updated_at" gorm:"default:0"`
	DeletedAt int64  `json:"deleted_at" gorm:"default:0;index:idx_ui_assistant_docs_enabled_deleted_sort,priority:2"`
}

func (UIAssistantDocument) TableName() string {
	return "ui_assistant_documents"
}

type UIAssistantSession struct {
	Id              int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"user_id" gorm:"index:idx_ui_assistant_sessions_user_created,priority:1;index"`
	PagePath        string `json:"page_path" gorm:"type:varchar(255);default:''"`
	Question        string `json:"question" gorm:"type:text"`
	ScreenshotCount int    `json:"screenshot_count" gorm:"default:0"`
	Decision        string `json:"decision" gorm:"type:varchar(32);default:'';index"`
	AnswerSummary   string `json:"answer_summary" gorm:"type:text"`
	ProviderType    string `json:"provider_type" gorm:"type:varchar(32);default:''"`
	ModelName       string `json:"model_name" gorm:"type:varchar(191);default:''"`
	ErrorMessage    string `json:"error_message" gorm:"type:text"`
	CreatedAt       int64  `json:"created_at" gorm:"default:0;index:idx_ui_assistant_sessions_user_created,priority:2"`
}

func (UIAssistantSession) TableName() string {
	return "ui_assistant_sessions"
}

func DefaultUIAssistantSystemPrompt() string {
	return strings.TrimSpace(`你是 Youkies 的 AI 分身，是 Youkies API 控制台里热心、善良、体贴的小助手。

你的性格：
- 语气温柔、有耐心，先安抚用户，再帮用户把问题拆清楚。
- 不冷冰冰地甩术语；必要的技术词要解释成人话。
- 回复要短而有用，能一步一步带用户排查。

你的任务：
- 根据用户描述、当前页面、截图和站点知识文档，判断问题类型和下一步建议。
- 优先给出用户可以自助完成的检查步骤。
- 如果涉及空回、扣费争议、充值不到账、余额异常、账号异常，应建议用户提交申诉或联系人工处理。
- 对明显可以自助处理的问题，直接告诉用户怎么做；对信息不足的问题，温和地说明还需要哪些信息。

硬性边界：
- 你不能承诺退款、补偿或人工一定通过。
- 你不能声称已经修改额度、修复账号或处理订单。
- 你不能索要完整 API Key、密码、验证码、支付账号等敏感信息。
- 如果截图中出现密钥、订单号、支付信息等敏感内容，应提醒用户下次先打码。
- 不要编造后台状态；不确定时要说清楚“不确定”，并告诉用户下一步该查什么。`)
}

func defaultUIAssistantConfig() *UIAssistantConfig {
	now := common.GetTimestamp()
	return &UIAssistantConfig{
		Id:               1,
		Enabled:          false,
		AssistantName:    "Youkies 的 AI 分身",
		WelcomeMessage:   "你好，我是 Youkies 的 AI 分身。把错误截图和问题发给我，我会先帮你判断是否需要人工处理。",
		ProviderType:     UIAssistantProviderSite,
		BaseURL:          "",
		ModelName:        "gpt-5.4-mini",
		SystemPrompt:     DefaultUIAssistantSystemPrompt(),
		AllowScreenshot:  true,
		KnowledgeEnabled: true,
		StoreSessions:    true,
		DailyLimit:       8,
		MaxImageBytes:    800 * 1024,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}

func NormalizeUIAssistantConfig(config *UIAssistantConfig) {
	config.AssistantName = strings.TrimSpace(config.AssistantName)
	config.WelcomeMessage = strings.TrimSpace(config.WelcomeMessage)
	config.ProviderType = strings.TrimSpace(config.ProviderType)
	config.BaseURL = strings.TrimSpace(config.BaseURL)
	config.APIKey = strings.TrimSpace(config.APIKey)
	config.ModelName = strings.TrimSpace(config.ModelName)
	config.SystemPrompt = strings.TrimSpace(config.SystemPrompt)
	if config.AssistantName == "" {
		config.AssistantName = "Youkies 的 AI 分身"
	}
	if config.WelcomeMessage == "" {
		config.WelcomeMessage = "你好，我是 Youkies 的 AI 分身。把错误截图和问题发给我，我会先帮你判断是否需要人工处理。"
	}
	if config.ProviderType == "" {
		config.ProviderType = UIAssistantProviderSite
	}
	if config.ProviderType != UIAssistantProviderSite && config.ProviderType != UIAssistantProviderExternal {
		config.ProviderType = UIAssistantProviderSite
	}
	if config.SystemPrompt == "" {
		config.SystemPrompt = DefaultUIAssistantSystemPrompt()
	}
	if config.DailyLimit <= 0 || config.DailyLimit > 8 {
		config.DailyLimit = 8
	}
	if config.MaxImageBytes <= 0 {
		config.MaxImageBytes = 800 * 1024
	}
}

func ValidateUIAssistantConfig(config *UIAssistantConfig) error {
	if config == nil {
		return errors.New("AI 助手配置不能为空")
	}
	NormalizeUIAssistantConfig(config)
	if len([]rune(config.AssistantName)) > 100 {
		return errors.New("助手名称不能超过 100 个字符")
	}
	if len([]rune(config.WelcomeMessage)) > 500 {
		return errors.New("欢迎语不能超过 500 个字符")
	}
	if config.Enabled {
		if config.APIKey == "" {
			return errors.New("启用 AI 助手前需要配置助手专用 Token 或外部 API Key")
		}
		if config.ModelName == "" {
			return errors.New("启用 AI 助手前需要配置模型名称")
		}
	}
	return nil
}

func GetUIAssistantConfig() (*UIAssistantConfig, error) {
	var config UIAssistantConfig
	err := DB.First(&config, "id = ?", 1).Error
	if err == nil {
		NormalizeUIAssistantConfig(&config)
		return &config, nil
	}
	configPtr := defaultUIAssistantConfig()
	if err = DB.Create(configPtr).Error; err != nil {
		return nil, err
	}
	return configPtr, nil
}

func SaveUIAssistantConfig(config *UIAssistantConfig) error {
	if err := ValidateUIAssistantConfig(config); err != nil {
		return err
	}
	now := common.GetTimestamp()
	config.Id = 1
	if config.CreatedAt == 0 {
		config.CreatedAt = now
	}
	config.UpdatedAt = now
	return DB.Save(config).Error
}

func NormalizeUIAssistantDocument(doc *UIAssistantDocument) {
	doc.Title = strings.TrimSpace(doc.Title)
	doc.Content = strings.TrimSpace(doc.Content)
}

func ValidateUIAssistantDocument(doc *UIAssistantDocument) error {
	if doc == nil {
		return errors.New("知识文档不能为空")
	}
	NormalizeUIAssistantDocument(doc)
	if doc.Title == "" {
		return errors.New("知识文档标题不能为空")
	}
	if len([]rune(doc.Title)) > 191 {
		return errors.New("知识文档标题不能超过 191 个字符")
	}
	if doc.Content == "" {
		return errors.New("知识文档内容不能为空")
	}
	return nil
}

func GetAdminUIAssistantDocuments() ([]*UIAssistantDocument, error) {
	var docs []*UIAssistantDocument
	err := DB.Where("deleted_at = ?", 0).
		Order("enabled desc").
		Order("sort_order desc").
		Order("id desc").
		Find(&docs).Error
	return docs, err
}

func GetEnabledUIAssistantDocuments() ([]*UIAssistantDocument, error) {
	var docs []*UIAssistantDocument
	err := DB.Where("deleted_at = ? AND enabled = ?", 0, true).
		Order("sort_order desc").
		Order("id desc").
		Limit(20).
		Find(&docs).Error
	return docs, err
}

func GetUIAssistantDocumentById(id int64) (*UIAssistantDocument, error) {
	if id <= 0 {
		return nil, errors.New("无效的知识文档 ID")
	}
	var doc UIAssistantDocument
	err := DB.Where("id = ? AND deleted_at = ?", id, 0).First(&doc).Error
	return &doc, err
}

func CreateUIAssistantDocument(doc *UIAssistantDocument) error {
	if err := ValidateUIAssistantDocument(doc); err != nil {
		return err
	}
	now := common.GetTimestamp()
	doc.Id = 0
	doc.CreatedAt = now
	doc.UpdatedAt = now
	return DB.Create(doc).Error
}

func UpdateUIAssistantDocument(doc *UIAssistantDocument) error {
	if err := ValidateUIAssistantDocument(doc); err != nil {
		return err
	}
	doc.UpdatedAt = common.GetTimestamp()
	return DB.Model(&UIAssistantDocument{}).
		Where("id = ? AND deleted_at = ?", doc.Id, 0).
		Updates(map[string]interface{}{
			"title":      doc.Title,
			"content":    doc.Content,
			"enabled":    doc.Enabled,
			"sort_order": doc.SortOrder,
			"updated_by": doc.UpdatedBy,
			"updated_at": doc.UpdatedAt,
		}).Error
}

func DeleteUIAssistantDocumentById(id int64, updatedBy int) error {
	now := common.GetTimestamp()
	return DB.Model(&UIAssistantDocument{}).
		Where("id = ? AND deleted_at = ?", id, 0).
		Updates(map[string]interface{}{
			"enabled":    false,
			"updated_by": updatedBy,
			"updated_at": now,
			"deleted_at": now,
		}).Error
}

func CreateUIAssistantSession(session *UIAssistantSession) error {
	if session == nil {
		return errors.New("AI 助手会话不能为空")
	}
	session.CreatedAt = common.GetTimestamp()
	return DB.Create(session).Error
}

func CountUIAssistantSessions(userId int, since int64) (int64, error) {
	var total int64
	err := DB.Model(&UIAssistantSession{}).
		Where("user_id = ? AND created_at >= ? AND provider_type <> ?", userId, since, UIAssistantProviderBalance).
		Count(&total).Error
	return total, err
}

func GetAdminUIAssistantSessions(pageInfo *common.PageInfo) ([]*UIAssistantSession, int64, error) {
	query := DB.Model(&UIAssistantSession{})
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var sessions []*UIAssistantSession
	err := query.Order("created_at desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&sessions).Error
	return sessions, total, err
}
