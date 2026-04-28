# 项目核心知识库

## 会员身份展示

- 用户分组按四档展示：普通用户、Pro优、Super优、Ultra优；前端通过 `user.group` 识别，兼容 `super` 与历史可能出现的 `spuer` 拼写。
- 移动端顶部空间紧张，不放完整身份铭牌；头像使用身份色环与小角标作为轻量提示，完整身份信息放在控制台标题区与头像菜单身份卡中。
- 会员升级由外部项目自动处理，符合条件的用户会被移入对应分组；newapi 前端只读取当前 `user.group` 并展示身份，不提供升级入口。

## 协作偏好

- 用户偏好：功能/界面小迭代完成后直接提交并 push 到当前分支；执行前仍需快速核对 `git status` 和 diff 范围，避免带入无关改动。

## 部署架构

- 生产环境：Zeabur（Git 部署，GitHub push 自动构建）
- 数据库：Zeabur MySQL 服务，数据库名 `zeabur`
- NODE_TYPE=slave：跳过 AutoMigrate，新增列需手动 ALTER TABLE
- 测试用远程 MySQL：38.150.2.234:30502/zeabur
- 启动命令（bash）：`NODE_TYPE=slave SQL_DSN='root:...@tcp(38.150.2.234:30502)/zeabur' ./new-api.exe`
- 海外域名：newapi.youkies.space（DNS 指向 Zeabur）
- 国内中转域名：newapi.youkies.cn（已备案，Nginx 反代 → 海外服务器）
- 生产必须固定 `SESSION_SECRET`（不要用 `random_string`）：如果不配置，后端每次启动会随机生成 session secret，重新部署后旧登录 cookie 失效，用户需要重新登录；如需加密签名也稳定，可同步固定 `CRYPTO_SECRET`

## 国内中转

- 服务器：81.71.120.210（腾讯云，Ubuntu 24.04）
- Nginx 反代：/etc/nginx/sites-enabled/newapi.conf
- SSL：Let's Encrypt 自动续期（到期 2026-07-25）
- 关键配置：proxy_buffering off（SSE 流式）、proxy_read_timeout 1000s
- 同机还运行 lobe.youkies.cn（LobeChat）

## uiweb 技术选型（已敲定）

- 前端：Vite 5 + React 18 + JSX（不用 TypeScript）
- 样式：Tailwind CSS 3 + 自研 clay 组件
- 主题：新 UI 支持 `ThemeProvider`，本地存储 key 为 `uiweb.theme.mode`，模式为 `system` / `light` / `dark`；深色模式定调为 **Moon Clay 夜间黏土**，通过 `html[data-theme]` + CSS 变量驱动 clay 色板与阴影，不改经典控制台
- 图标：lucide-react（UI 图标）+ @lobehub/icons v2（供应商/模型图标）
- Logo/Favicon：自定义 PNG（uiweb/public/favicon.png），导航栏 logo 用 `<img>` 替代 lucide Box
- 供应商图标：`vendorIcon.jsx` 的 `getLobeHubIcon(iconName, size)` 解析点号字符串（如 `"Claude.Color"`）为 React 组件，fallback 为 AiMass
- @lobehub/icons stub：4 个 stub 模块（antd/antd-style/react-layout-kit/@lobehub/ui）通过 vite alias 屏蔽 Avatar/Combine 子组件的间接依赖
- 裁剪库：react-easy-crop（头像上传裁剪预览）
- 路由：react-router-dom 6，根路径（无 basename）
- Vite `base: '/'`，dev 端口 5174，代理 `/api` `/v1` → localhost:3001
- 包管理：开发机 npm/npx（bun 未装），Dockerfile 走 oven/bun:1

## 新 UI 前端调试模式

- 启用方式：`VITE_UI_DEBUG_MODE=true`，或 Vite 开发环境访问任意页面加 `?debug=1`；关闭本地开关可用左下角面板或 `?debug=0`
- 安全边界：普通生产构建默认关闭；`localStorage` 开关只在 `import.meta.env.DEV` 下生效，生产若需启用必须显式构建时设置 `VITE_UI_DEBUG_MODE=true`
- 调试能力：自动注入管理员 mock 用户，`services/api.js` 使用 axios adapter 返回 mock 状态、用户、令牌、日志、充值、公告、申诉、AI 助手、定价、模型状态等接口数据
- AI 助手：调试模式下用户侧流式聊天走前端 mock 流，不调用真实 `/api/ui/assistant/chat`，不消耗真实 Token
- UI 入口：左下角 `UI DEBUG` 快捷面板可跳转首页、控制台、公告、定价、状态、管理端、公告管理、申诉审核、AI 助手配置等页面

## 用户业务约束

- 注册方式：仅 QQ 邮箱
- 充值方式：兑换码 + ePay 在线充值（支付宝/微信支付）；TopUp 页已移除“购买兑换码/购买额度”外链卡片
- 语言：仅中文，不需要 i18n
- 不需要：2FA、Passkey、Turnstile、OAuth 绑定

## 路由策略

- `/*` → uiweb（黏土风，根路由前端）
- `/legacy` → 301 重定向到 `/legacy/`（Gin wildcard 不匹配无斜杠）
- `/legacy/*` → 原 web 经典界面
- `/u/*` → 301 重定向到根路径（兼容旧链接）
- `/v1/*`, `/api/*` → API 路由不受影响
- FRONTEND_BASE_URL 在 master 节点被忽略

## 新 UI 管理端方向

- 新 UI 管理端定位为“站点运营后台”，不复刻、不改动原版 new-api 管理设置页，避免后续同步官方更新时产生高冲突
- 第一阶段优先做公告管理：强制弹窗公告 + 历史公告页
- 强制公告规则：每条强制公告必须被用户确认一次；用户可勾选“不再显示此公告”并点击“我已知晓”
- 公告确认应按 `announcement_id + version` 或等效版本号判断，公告内容更新后可重新触发确认
- 历史公告入口只放公共主页导航/主页子页面，不加入用户控制台导航
- 预留后续能力：空回申诉审核、页面文案配置、操作审计
- 第一版已实现：后端 API 前缀 `/api/ui`，公共历史页 `/announcements`，轻量管理端 `/admin` 与 `/admin/announcements`
- 公共公告接口：`GET /api/ui/announcements`、`GET /api/ui/announcements/active`、`POST /api/ui/announcement_acks/:id`
- 管理公告接口：`GET/POST /api/ui/admin/announcements`、`GET/PUT/PATCH/DELETE /api/ui/admin/announcements/:id`
- 前端 `AnnouncementProvider` 挂在 `main.jsx`，进入新 UI 后检查强制公告；登录用户写服务端 ack，未登录/本地兜底写 localStorage

## AI 助手方向

- 用户控制台右下角挂载 AI 助手悬浮球，名称默认 `Youkies 的 AI 分身`，挂载点为 `ClayConsoleShell`
- 第一版定位为“问题预诊断/提交前整理”：支持问题描述 + 手动上传/粘贴截图 + 当前页面路径，不自动承诺退款、不修改余额、不代替管理员审核
- 管理端配置页为 `/admin/assistant`，可配置启用状态、助手名称、欢迎语、模型来源、Base URL、助手专用 Token/API Key、模型名、系统提示词、截图开关、知识文档开关、会话摘要开关、每日限流和截图大小
- 模型来源第一版支持 OpenAI-compatible 接口；推荐“站内助手账号”：手动创建 `ai-assistant` 用户，分配独立分组/额度/专用 Token，再在配置页填入 Token 和模型名；也保留外部自定义 Base URL/API Key
- AI 助手免费对话上限固定为每用户 8 次/日，由 `ai-assistant` 专用 Token/配置承担；免费次数用完后，用户侧提示是否使用余额继续，确认后走站内 `/pg/chat/completions`，按当前用户可用模型、分组和余额正常计费；付费续聊记录为 `site_balance`，不占用免费次数
- 知识文档第一版存在 `ui_assistant_documents`，按排序取启用文档片段拼入模型上下文；历史对话不保存截图原图，只保存截图数量
- 用户侧完整聊天历史已通过 `ui_assistant_conversations` 与 `ui_assistant_conversation_messages` 保存，支持新建对话、历史对话列表、恢复消息；助手回复中的 `<think>...</think>` 会拆成 `reasoning` 字段，前端默认折叠显示
- AI 助手余额续聊模型选择不直接使用当前身份分组；后端 `GET /api/ui/assistant/models` 返回用户可用分组及各分组启用模型，前端以 `default` 且有模型的组合为默认，余额续聊 `POST /api/ui/assistant/chat` 会同时提交 `group` 与 `model_name`，避免 Pro优/Super优/Ultra优 身份分组未配置模型时报 “No available channel”。
- AI 助手接口：用户侧 `GET /api/ui/assistant/config`、`GET/POST/DELETE /api/ui/assistant/conversations`、`GET /api/ui/assistant/conversations/:id/messages`、`POST /api/ui/assistant/analyze`、`POST /api/ui/assistant/chat`；管理侧 `GET/PUT /api/ui/admin/assistant/config`、`GET/POST/PUT/DELETE /api/ui/admin/assistant/documents`、`GET /api/ui/admin/assistant/sessions`

## Claude 适配注意事项

- OpenAI 格式转 Claude extended thinking 时必须清洗不兼容参数：`temperature`、`top_k` 需移除，`top_p` 仅允许 `0.95-1` 否则移除，强制工具调用 `tool_choice=required/tool` 需降级为 `auto`，否则 Anthropic 会返回 400。
- 新表：`ui_assistant_configs`、`ui_assistant_documents`、`ui_assistant_sessions`；生产 `NODE_TYPE=slave` 不会 AutoMigrate，需要手动建表

## 模型匹配

- `gpt-5.5` 已加入 OpenAI/Codex 基础模型列表、默认 `ModelRatio` 与 `CacheRatio`；后台仍可通过系统设置里的模型倍率覆盖实际定价

## 空回补偿申诉方向

- 第一版定位为“疑似空回批量提交 + 管理员人工审核”，不做自动补偿，避免误判和额度漏洞
- 用户侧入口只放在新 UI 日志页：静默检测最近 48 小时疑似空回；仅在存在候选记录或待审核申诉时显示入口/状态，不主动弹窗提醒
- 检测范围：`max(now - 48h, UI_REFUND_APPEAL_START_AT)` 到当前时间；`UI_REFUND_APPEAL_START_AT` 用于排除历史手动补偿过的记录
- 疑似空回第一版判定：消费日志、扣费 `quota > 0`、输出 `completion_tokens = 0`、在时间窗口内，且该日志未出现在申诉明细表中
- 重复提交排除：`ui_refund_appeal_items.log_id` 唯一，用户再次提交时自动排除已提交/已处理日志
- 审核通过后补偿方式：后端事务内 `users.quota += refund_quota`，申诉和明细置为 `approved`，随后写 `LogTypeManage` 管理日志，经典控制台会自然显示为“管理”类型
- 审核驳回：申诉和明细置为 `rejected`，不改余额；新 UI 管理端保留驳回原因

### 空回补偿新表

- `ui_refund_appeals`：申诉批次表，记录用户、状态、总条数、补偿额度、扫描窗口、用户说明、审核人/时间/备注
- `ui_refund_appeal_items`：申诉明细表，记录日志 ID、模型、令牌、Request ID、扣费、token、耗时、内容快照；`log_id` 唯一防止重复补偿

### 公告系统新表

- `ui_announcements`：新 UI 公告主体表，字段覆盖标题、摘要、内容、类型、作用范围、强制弹窗、置顶、启用状态、版本号、优先级、生效/失效时间、创建/更新人和软删除时间
- `ui_announcement_acks`：登录用户公告确认记录表，按 `announcement_id + announcement_version + user_id` 唯一，记录 `dont_show_again` 与确认时间
- 生产环境 `NODE_TYPE=slave` 不会 AutoMigrate，新表需要手动执行 MySQL 建表 SQL；执行器可能不支持多语句，需要分两次执行 `CREATE TABLE`
- 后端模型仍应加入 AutoMigrate，方便非 slave 环境和后续本地测试，但生产以手动建表为准

## 头像功能

- 存储：User 表 `avatar` LONGBLOB + `avatar_type` VARCHAR(32)
- 上限：200KB，前端 canvas 压缩为 JPEG
- API：`POST/DELETE /api/user/avatar`（需登录）、`GET /api/user/avatar/:id`（公开，ETag=CRC32 + no-cache）
- 前端裁剪：react-easy-crop 圆形裁剪 + 缩放滑块 + 确认弹窗
- cache-bust：`_avatar_t` 时间戳挂在 user 对象上，所有头像 URL 带 `?t=`
  - 页面导航：setUser 自动保留旧 `_avatar_t`
  - 重新登录：setUser 发现 `has_avatar` 但无 `_avatar_t` 时自动生成 `Date.now()`
  - 服务端：ETag 用 CRC32(data) 内容哈希 + `Cache-Control: no-cache`（每次验证）
- 批量查询（GetAllUsers/SearchUsers）omit avatar 字段避免性能问题
- 移动端：控制台导航只显示头像圆形（40px，无背景框无文字），首页登录只显示头像

## 组件体系

### Clay 组件（15 个）
ClayCard / ClayButton / ClayInput / ClayToggle / ClayCheckbox / ClayField / ClayAlert / ClayDivider / ClayLink / ClaySelect / ClayTabs / ClayStat / ClayModal / ClayProgress / ClayAvatar

### Layout 组件
ClayNav / ClayFooter / ClayPageShell / ClayAuthShell / ClayConsoleShell / ProtectedRoute

### Context（3 个）
StatusContext（含 persistStatusFields 调用）/ UserContext / ToastContext

## 页面清单

### 访客页（13 路由）
Home / Login / Register / ResetRequest / ResetConfirm / OAuthCallback / Setup / About / UserAgreement / PrivacyPolicy / Pricing / **ModelStatus** / Forbidden / NotFound

### 登录后页
Dashboard / TokenManage / LogList / TopUp / Checkin / PersonalSetting / Chat2Link / ApiUrls / PaymentReturn(/console/log)

### 公共导航（ClayNav）
首页 / 定价 / **状态** / 公告 / 关于；移动端首页 Hero 快捷入口包含价格、模型状态、站点公告

### 控制台导航（ClayConsoleShell NAV）
仪表盘 / 令牌 / 日志 / 充值 / 签到 / 设置

## Services 层

api.js / auth.js / tokens.js / logs.js / checkin.js / user.js / dashboard.js / topup.js / pricing.js / **modelStatus.js**

## 关键实现细节

- 余额转换：quotaToDisplay() 读 localStorage 的 quota_per_unit / quota_display_type
- 余额反转换：displayToQuota() 将展示金额转回内部额度值（令牌创建/编辑用）
- 签到 API 路径：`/api/user/checkin`（selfRoute 前缀 `/api/user/`）
- 签到刷新逻辑：服务器本地 `time.Now().Format("2006-01-02")` 判断，0 点刷新
- 签到倒计时：CountdownTimer 组件，今日已签到后显示到午夜 HH:MM:SS（浏览器本地时间）
- 日志页：筛选表单使用 draft/applied 双状态，避免输入筛选条件时自动请求；时间筛选使用自绘 ClayDateTimeField，非消费日志在桌面/移动端直接显示详细信息
- Moon Clay 深色模式：避免纯黑暗黑风；使用暗灰蓝泥面、低亮度马卡龙点缀、柔和高光和更深遮挡阴影；优先通过 `tailwind.config.js` 中的 clay CSS variables 与 `index.css` token 维护
- 定价公式：按量 `model_ratio * 2 * groupRatio`（USD/1M tokens），按次 `model_price * groupRatio`（USD/次）
- 定价 API 响应结构：`res.data` = 模型数组，`res.vendors` / `res.group_ratio` / `res.usable_group` 是 response 同级字段
- 模型状态 API：`GET /api/model-status?window=1h|6h|12h|24h`（公开，无需认证）
- 模型状态 SQL：abilities JOIN channels（status=1, enabled=true）获取模型列表，logs 表 FLOOR 分槽聚合
- LogSqlType 陷阱：LOG_SQL_DSN 为空时 LOG_DB=DB 但 LogSqlType 保持默认 SQLite，需用 `UsingMySQL`/`UsingPostgreSQL` 辅助判断

## 构建指标

- ~4166 modules，vendor-icons chunk ~4.2MB（gzip ~810KB）独立分块
- 主 JS ~373KB + CSS ~44KB + vendor-icons 独立 chunk

## Go 端接入

- main.go embed uiweb/dist + router/uiweb-router.go 根路由前端 + SPA fallback
- router/web-router.go — 经典前端挂载到 /legacy/*filepath
- controller/model_status.go — 模型状态监控端点
- controller/avatar.go — 头像上传/获取/删除
- Dockerfile 已接入 uiweb-builder 并行 stage
