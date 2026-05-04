# 项目核心知识库

## 项目形态

- new-api 是 Go AI API 网关/代理，后端采用 Gin + GORM，前端包含经典 `web/` 与新建 `uiweb/`。
- 数据库需同时兼容 SQLite、MySQL、PostgreSQL；生产主要使用 Zeabur MySQL，且 `NODE_TYPE=slave` 会跳过 AutoMigrate。
- 代码约束：业务代码 JSON 编解码优先使用 `common/json.go` 包装函数；涉及新渠道时要确认 `StreamOptions` 支持情况；涉及表达式计费前先读 `pkg/billingexpr/expr.md`。

## 协作偏好

- 对功能/界面小迭代，用户通常希望完成后整理 diff，并在合适时提交到当前分支；执行提交/推送前必须先核对 `git status` 与 diff 范围，避免带入无关改动。
- 前端包管理原则上偏 Bun；当前开发机历史上主要使用 npm/npx，Dockerfile 构建阶段使用 `oven/bun:1`。
- 记忆文件默认用中文；代码、注释、命令、路径、API 名称保持英文。

## 部署与运行

- 生产环境：Zeabur Git 部署，GitHub push 触发自动构建；数据库名 `zeabur`。
- 海外域名：`newapi.youkies.space`；国内中转域名：`newapi.youkies.cn`。
- 国内中转服务器：腾讯云 `81.71.120.210`，Nginx 配置在 `/etc/nginx/sites-enabled/newapi.conf`，同机还运行 `lobe.youkies.cn`。
- SSE/长响应反代关键配置：`proxy_buffering off`，`proxy_read_timeout 1000s`。
- 生产必须固定 `SESSION_SECRET`，否则重新部署后旧 session cookie 会失效；如需加密签名稳定，可同步固定 `CRYPTO_SECRET`。
- `NODE_TYPE=slave` 生产不跑迁移：新增表/列要手动执行 SQL，后端模型仍应加入 AutoMigrate 方便本地与非 slave 环境。

## 路由策略

- `/*`：新 `uiweb` 根路由前端。
- `/legacy`：301 到 `/legacy/`。
- `/legacy/*`：经典 `web` 前端。
- `/u/*`：301 到根路径，兼容旧链接。
- `/v1/*` 与 `/api/*`：API 路由，不受前端 SPA fallback 影响。
- `FRONTEND_BASE_URL` 在 master 节点被忽略。

## uiweb 技术选型

- 前端：Vite 5 + React 18 + JSX；样式：Tailwind CSS 3 + 自研 Clay 组件。
- 主题：`ThemeProvider` 支持 `system` / `light` / `dark`，本地 key 为 `uiweb.theme.mode`；深色主题为 Moon Clay，通过 `html[data-theme]` 与 CSS 变量驱动。
- 图标：lucide-react 用于 UI 图标，`@lobehub/icons` v2 用于供应商/模型图标；因间接依赖过重，通过 vite alias stub 掉 `antd`、`antd-style`、`react-layout-kit`、`@lobehub/ui`。
- Logo/Favicon：`uiweb/public/favicon.png`，导航与认证布局使用 `<img>`。
- Dev 端口：5174，代理 `^/api(/|$)` 与 `^/v1(/|$)` 到后端 3001，避免 `/api-urls` 这类前端路由被误代理。

## 新 UI 功能概览

- 访客页：Home、Login、Register、Reset、OAuthCallback、Setup、About、UserAgreement、PrivacyPolicy、Pricing、ModelStatus、Forbidden、NotFound。
- 登录后页：Dashboard、TokenManage、LogList、TopUp、Checkin、PersonalSetting、Chat2Link、ApiUrls、PaymentReturn。
- 控制台导航：仪表盘、令牌、日志、充值、签到、设置。
- 业务约束：注册仅 QQ 邮箱；充值为兑换码 + ePay 在线充值；界面主要面向中文；不需要 2FA、Passkey、Turnstile、OAuth 绑定。
- 移动端适配优先用户端新 UI；管理端主要在电脑上使用，不作为移动端效率优化目标，只需保持基本可访问。

## 新 UI 调试模式

- 启用：`VITE_UI_DEBUG_MODE=true`，或 Vite 开发环境 URL 加 `?debug=1`；关闭可用左下角面板或 `?debug=0`。
- 能力：注入管理员 mock 用户，axios adapter mock 状态、用户、令牌、日志、充值、公告、申诉、AI 助手、定价、模型状态等接口。
- AI 助手在调试模式走前端 mock 流式回复，不调用真实 `/api/ui/assistant/chat`，不消耗真实 Token。

## 管理端与公告

- 新 UI 管理端定位为轻量“站点运营后台”，不复刻原版 new-api 管理设置页，降低与上游同步冲突。
- 页面配置页：`/admin/page-config` 管理 `/api-urls` 的公开地址列表；配置存储在 `ui_page_configs.api_urls` JSON 中，用户页通过 `GET /api/ui/page-config` 读取启用项。
- 第一阶段已实现公告系统：公共历史页 `/announcements`，管理页 `/admin/announcements`。
- 公告确认按 `announcement_id + version` 判断；公告内容更新后递增版本可重新触发确认。
- 新表：`ui_announcements`、`ui_announcement_acks`；生产 slave 环境需手动建表。

## 空回补偿申诉

- 定位：疑似空回批量提交 + 管理员人工审核，不做自动补偿。
- 用户入口在新 UI 日志页，静默检测最近 48 小时且晚于 `UI_REFUND_APPEAL_START_AT` 的候选记录。
- 判定条件：消费日志、`quota > 0`、`completion_tokens = 0`、未出现在申诉明细表。
- 审核通过后事务内增加 `users.quota`，申诉与明细置为 `approved`，并写 `LogTypeManage`；驳回不改余额。
- 新表：`ui_refund_appeals`、`ui_refund_appeal_items`，其中 `ui_refund_appeal_items.log_id` 唯一防重复补偿。

## AI 助手

- 挂载点：用户控制台 `ClayConsoleShell`，名称默认 `Youkies 的 AI 分身`。
- 定位：问题预诊断/提交前整理；支持问题描述、手动上传/粘贴截图、当前页面路径；不承诺退款、不改余额、不代替管理员审核。
- 管理页：`/admin/assistant`，可配置启用、名称、欢迎语、模型来源、Base URL、Token/API Key、模型名、系统提示词、截图、知识文档、会话摘要、限流等。
- 推荐模型来源：手动创建站内 `ai-assistant` 用户，给独立分组/额度/专用 Token；也可填外部 OpenAI-compatible Base URL/API Key。
- 免费次数：每用户 8 次/日；耗尽后用户可确认用余额续聊，走站内 `/pg/chat/completions` 计费链路，记录为 `site_balance`，不占免费次数。
- 历史：`ui_assistant_conversations` 与 `ui_assistant_conversation_messages` 保存用户侧完整聊天历史；`<think>...</think>` 会拆成 `reasoning` 并默认折叠显示。
- 余额续聊模型：后端 `GET /api/ui/assistant/models` 返回用户可用分组与模型；前端默认用 `default` 中可用模型，提交 `group` 与 `model_name`，避免身份分组无模型导致无渠道。
- 生产新表：`ui_assistant_configs`、`ui_assistant_documents`、`ui_assistant_sessions`、`ui_assistant_conversations`、`ui_assistant_conversation_messages`。

## 模型与渠道注意事项

- Claude extended thinking：OpenAI 格式转 Claude 时，thinking 启用必须移除 `temperature`、`top_k`，非法 `top_p`，并把强制工具调用降级为 `auto`。
- `gpt-5.5` 已加入 OpenAI/Codex 基础模型列表、默认 `ModelRatio` 与 `CacheRatio`；后台模型倍率仍可覆盖实际定价。
- 渠道级 `non_stream_to_stream_enabled`：用于合适的 OpenAI 格式 chat completions、用户非流、非透传请求；已覆盖 OpenAI/OpenRouter/Xinference、Anthropic、Gemini/Vertex API 类型。上游强制流式，服务端聚合 SSE 后向用户返回标准非流 `chat.completion` JSON。
- relay 中下游客户端主动断开会归一化为 499，跳过重试和错误日志记录，避免误判为上游失败或触发渠道禁用逻辑。

## 头像与会员展示

- 头像存储：User 表 `avatar` LONGBLOB + `avatar_type` VARCHAR(32)，前端压缩 JPEG，上限 200KB。
- 头像 API：`POST/DELETE /api/user/avatar` 需登录；`GET /api/user/avatar/:id` 公开，ETag 使用 CRC32(data)，`Cache-Control: no-cache`。
- cache-bust：user 对象带 `_avatar_t`，头像 URL 加 `?t=`；`setUser` 会保留旧 `_avatar_t`，重新登录且 `has_avatar` 时自动生成时间戳。
- 会员身份：按 `user.group` 展示普通用户、Standard 优、Pro优、Super优、Ultra优；兼容历史 `spuer` 拼写；升级由外部项目移组，newapi 只展示身份。
- 签到奖励：`checkin_setting.min_quota` / `max_quota` 仍是默认范围；`checkin_setting.group_quotas` 可按用户 `group` 覆盖签到最小/最大额度，支持精确分组名以及 `standard`、`pro`、`super`/`spuer`、`ultra` 等会员语义 key。

## 关键前端细节

- 余额展示：`quotaToDisplay()` 读取 `localStorage` 中 `quota_per_unit` / `quota_display_type`；令牌创建/编辑用 `displayToQuota()` 反转为内部额度。
- 日志页筛选使用 draft/applied 双状态，避免输入条件时自动请求；时间选择使用自绘 `ClayDateTimeField`。
- 定价公式：按量 `model_ratio * 2 * groupRatio`（USD/1M tokens），按次 `model_price * groupRatio`（USD/次）。
- 定价 API：`res.data` 是模型数组，`res.vendors` / `res.group_ratio` / `res.usable_group` 与 `data` 同级。
- 模型状态 API：`GET /api/model-status?window=1h|6h|12h|24h`，公开无认证；注意 `LOG_SQL_DSN` 为空时 `LogSqlType` 可能仍为 SQLite，需用 `UsingMySQL`/`UsingPostgreSQL` 判断 SQL。

## 构建与已知问题

- `vendor-icons` 独立 chunk 约 4.2MB，gzip 约 810KB，属于已知体积成本。
- `uiweb` 最近一次 `npm run build` 可通过；当前环境未安装 `bun` 时可用 npm 作为验证 fallback。
- 经典 `web` 前端最近一次完整 `npm run build` 被既有依赖解析问题阻断：`@douyinfe/semi-ui/dist/css/semi.css` 缺少 package export；定向 JSX 语法检查可通过。
