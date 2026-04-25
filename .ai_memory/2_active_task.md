# 当前任务

## 状态：Clay 风格打磨中，等用户验收

## 已完成

### Stage 1（访客页）— 13 路由
Home / Login / Register / ResetRequest / ResetConfirm / OAuthCallback / Setup / About / UserAgreement / PrivacyPolicy / Pricing / ModelStatus / Forbidden + NotFound

### Stage 2（登录后页）— 7 路由
Dashboard / TokenManage / LogList / TopUp / Checkin / PersonalSetting / Chat2Link

### Stage 2++（页面打磨 + 新功能）
- Pricing 页分组展示
- Token 页增加详细列
- Log 页合并 token 用量列、额度着色、错误行红底
- TopUp 页增加购买链接卡片，兑换码+购买卡片并排等高布局
- ModelStatus 公开页面（/u/status）：60s 自动刷新，2 列卡片网格
- Go 端 controller/model_status.go + /api/model-status

### Bug 修复
- 余额显示 token 数而非货币：StatusContext persistStatusFields
- 签到 404：API 路径修正
- 模型状态 SQL：LogSqlType/FLOOR 兼容
- 构建部署链：vite build → go build → 杀进程 → PowerShell 启动

### Stage 3（日志页增强）
- LogList Token 用量列增加缓存读写 token（从 other JSON 解析 cache_tokens / cache_creation_tokens）
- 耗时列改为"用时/首字"：显示 use_time(秒) + frt(首字延迟，毫秒转换)，流/非流标签
- 详情列移除，改为行点击弹出 ClayModal 详情弹窗（基本信息 + Token 用量含缓存 + 耗时含首字 + 额度 + 内容）
- 筛选面板对齐（ClaySelect 手动加 label 包裹与 ClayField 统一高度）
- 时间范围默认今天 00:00 到当前时间

### Bug 修复（Stage 3）
- use_time 单位是秒不是毫秒
- frt 负值（-1000）需过滤，仅正值显示
- parseOther/getCacheTokens 空值保护（JSON.parse 可能返回 null）

### Stage 3+（日志页视觉重构 + 移动端适配）
- LogList 视觉重构：从独立 grid 卡片改为 table 布局（对齐令牌管理页风格），行高增加
- 移动端适配：新增 useIsMobile hook + LogCard 组件，<767px 自动切换为卡片列表
- Token 用量图标全部改为文字标签（入/出/缓读/缓写），桌面+移动+详情弹窗三处同步

## 下一步

待用户验收后决定：
- A：PersonalSetting 精简（去绑定 tab、去 Passkey/2FA）
- B：Stage 3（Midjourney / Task 页面）
- C：Stage 4（Playground 15 组件 + Chat）
- D：跑完整端到端验收

## 风险 / 未做

- PersonalSetting 密码修改、2FA 管理仍桥接经典控制台
- Dashboard 用量图是自制柱状条
- 未做管理员路由守卫
- Playground 仍跳经典控制台
