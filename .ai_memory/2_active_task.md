# 当前任务

## 当前新增任务：AI 助手余额续聊分组 + 模型双选择（2026-04-29）
### 本轮实现进度
- 后端：新增 `GET /api/ui/assistant/models`，按当前用户可用分组返回各分组启用模型，并优先给出 `default_group=default`（若 default 有模型）；余额续聊 `POST /api/ui/assistant/chat` 新增接收 `group`，内部转发 `/pg/chat/completions` 时显式带上所选分组，避免 Pro/Super/Ultra 空模型分组导致无可用渠道。
- 前端：AI 助手 composer 从单一“余额模型”下拉改为 clay 风格“余额分组 + 余额模型”双选择；默认选择有模型的 default 分组，空模型身份分组显示为“无模型”且不可选；继续余额对话时同时提交 group/model。
- UI：桌面端新建对话、历史对话、关闭按钮收拢到标题栏右侧同一按钮组，移动端按钮视觉保持原有紧凑布局。
- 调试模式：补充 `/api/ui/assistant/models` mock，覆盖 Super优 用户但模型实际落在 default 的场景。
- 验证：`gofmt`、`git diff --check`、`go test ./controller ./model -run TestNonExistent`、前端 `esbuild.transformSync` 语法检查均通过；按偏好未跑完整前端构建。

## 当前新增任务：AI 助手历史对话、思考折叠与付费模型列表（2026-04-29）
### 本轮实现进度
- 后端：新增 `ui_assistant_conversations` 与 `ui_assistant_conversation_messages`，用户侧支持会话列表、新建、读取消息、删除；聊天流成功后返回 `X-Assistant-Conversation-Id` 并落库用户/助手消息。
- 思考内容：服务端把完整回复里的 `<think>...</think>` 拆分为 `reasoning` 与主内容；前端流式接收时识别思考段，思考中展开，结束后默认折叠为“思考过程”。
- 模型选择：用户侧配置返回后台免费模型名和今日已用次数；前端显示 `免费 · 后台模型 (已用/8)`，并从 `/api/user/models` 拉取当前用户可用模型作为余额续聊模型列表。
- UI：AI 助手新增新建对话按钮、历史对话面板、历史消息恢复、付费模型选择；调试模式同步 mock 历史对话、模型列表与思考折叠。
- 验证：`gofmt` 已执行；`git diff --check` 通过；`go test ./controller ./model -run TestNonExistent` 通过。按用户偏好未跑本地前端构建。

## 当前新增任务：签到日历详情与 gpt-5.5 匹配（2026-04-29）
### 本轮实现进度
- AI 助手历史：当前仅有管理端会话摘要列表，用户侧完整聊天历史/恢复对话尚未实现；如果要做正式历史，需要新增完整消息保存与用户侧会话列表接口。
- 模型匹配：补充 `gpt-5.5` 到 OpenAI/Codex 基础模型列表、默认模型倍率和缓存倍率；实际价格仍可在后台模型倍率中覆盖。
- 签到页：日历格子内直接显示已签到日期对应奖励额度，并在日历下方新增“本月签到详情”列表，逐日展示签到日期和领取金额。
- 调试模式：同步修正 `/api/user/checkin` mock 响应结构，返回真实页面需要的 `stats.records` 与 `quota_awarded`。
- 验证计划：执行 `git diff --check`、Go 定向测试；按用户偏好不跑本地前端构建。

## 当前新增任务：AI 助手免费次数与余额续聊（2026-04-29）
### 本轮实现进度
- 目标：AI 助手免费对话次数固定为 8 次/日；提示词调整为热心、善良、体贴的小助手；免费次数用完后提示用户可使用余额继续对话。
- 后端：AI 助手配置默认/归一化上限改为 8；免费耗尽返回 `assistant_free_limit_exceeded` 和 402；用户确认余额续聊后内部调用 `/pg/chat/completions`，复用站内用户认证、分组选择和余额计费链路；付费续聊记录为 `site_balance`，不占用免费次数。
- 前端：流式聊天错误读取支持 `code/data/status`；免费次数耗尽时在助手气泡中显示“使用余额继续”按钮，确认后复用原问题继续流式输出，不重复追加用户消息。
- 管理端：AI 助手配置页文案改为“每日每用户免费次数”，输入范围限制为 1-8，并说明免费次数由 `ai-assistant` 承担、超出后用户可用余额续聊。
- 验证计划：本轮优先执行 `git diff --check` 与 Go 定向编译测试；按用户偏好不跑本地前端构建。

## 当前新增任务：会员身份分层展示（2026-04-28）

### 本轮实现进度
- 目标：普通用户、Pro优、Super优、Ultra优四档身份需要在新 UI 中可见，但移动端顶部空间不足，不适合放完整身份铭牌。
- 前端：新增会员分层工具与展示组件，控制台头像使用身份色环/小角标；控制台标题区显示身份胶囊；用户头像菜单显示完整身份卡。
- 公共导航：登录头像同步使用会员头像样式，移动端仅以头像视觉状态提示身份。
- 升级链路：外部项目自动把符合条件的用户移入对应分组；newapi 前端只读取 `user.group` 展示当前身份，不提供升级按钮或跳转。
- 验证：首版实现时 `cd uiweb && npm run build` 通过，仅保留既有 vendor-icons chunk 偏大的 Vite 警告；本次边界调整后执行 `git diff --check`。

## 当前新增任务：Claude thinking 参数兼容修复（2026-04-28）
### 本轮实现进度
- 现象：用户以 OpenAI 格式调用反代 Claude 时，上游返回 `top_p must be greater than or equal to 0.95 or unset when thinking is enabled`，以及 `Request contains an invalid argument`。
- 根因：OpenAI 格式客户端常默认带 `temperature/top_p/top_k/tool_choice`；当模型后缀、`reasoning_effort` 或 `reasoning` 触发 Claude extended thinking 后，这些参数会与 Anthropic thinking 约束冲突。
- 后端：新增 `claude.NormalizeThinkingRequest`，thinking 启用时移除 `temperature`、`top_k`，当 `top_p` 不在 `[0.95, 1]` 时移除，并把强制工具调用 `tool_choice=any/tool` 降级为 `auto`。
- 覆盖路径：OpenAI→Claude 转换、原生 Claude 透传、Vertex Claude 透传均调用同一清洗逻辑。
- 验证：新增并通过 `go test ./relay/channel/claude -run "TestRequestOpenAI2ClaudeMessage_(RemovesInvalidThinkingParameters|PreservesValidThinkingTopP)"`；`git diff --check` 通过。完整 `go test ./relay/channel/claude` 仍有既有文件内容转换测试失败，未纳入本次修复范围。

## 当前新增任务：AI 助手桌面端全屏化（2026-04-28）
### 本轮实现进度
- 用户反馈桌面端继续使用居中大弹窗仍不好看，参考 LobeChat 桌面截图后决定改为桌面全屏聊天工作台。
- 前端：`AssistantWidget` 桌面端外层改为完整视口，取消桌面卡片最大宽度、圆角、阴影与背景虚化；顶部保留轻量标题栏，警告条与聊天列居中。
- 消息区：桌面端改为全屏滚动区内的 `920px` 阅读列，气泡最大宽度固定为约 `720-760px`，避免宽屏文字行过长。
- 输入区：桌面端 composer 固定在底部居中，宽度与聊天阅读列一致；移动端保持现有近全屏布局。
- 历史对话判断：当前后端已有 `ui_assistant_sessions` 摘要存储与管理端列表，但没有用户侧恢复完整历史对话的接口；建议后续做正式用户侧历史/继续对话，不建议只用前端 localStorage 做假历史。
- 验证：已执行 `git diff --check -- uiweb/src/components/assistant/AssistantWidget.jsx`，通过；按用户偏好未跑本地构建。

## 当前新增任务：AI 助手桌面端空间与回复流式体验优化（2026-04-28）
### 本轮实现进度
- 桌面端：`AssistantWidget` 弹窗从 `md:max-w-2xl / md:h-[760px]` 放大为最高约 `1200px` 宽、`84vh` 高的工作区，消息区与输入区 padding 同步放开；移动端近全屏布局保持不变。
- 消息气泡：桌面端气泡最大宽度收敛到 72%-76%，避免大屏下文字行过长，同时充分利用窗口空间。
- 流式体验：新增前端 typewriter 缓冲队列，真实接口返回的 chunk 先进入 `messageBuffersRef`，再按开场白同样的节奏逐字/小批量显示；长回复会轻微加速，避免等待过久。
- 验证：按用户偏好未跑本地构建，已做代码 diff 检查。

## 当前新增任务：重新部署后登录态失效提示优化（2026-04-28）

### 本轮实现进度
- 根因确认：后端 `common.SessionSecret` 默认使用随机 UUID，若生产未配置固定 `SESSION_SECRET`，每次重新部署/重启都会导致旧 session cookie 无法解码，从而出现“未登录且未提供 access token”。
- 前端：`services/api.js` 对 401 统一处理，清理本地 `user`，记录当前路径，直接跳转 `/login?expired=1`，避免控制台页面渲染后端权限错误红条。
- 登录页：识别登录态过期标记，显示温和提示“登录状态已过期，请重新登录。”；重新登录后优先回到过期前页面。
- 生产建议：Zeabur 设置固定 `SESSION_SECRET`，必要时同步固定 `CRYPTO_SECRET`，这样重新部署后无需重新登录。
- 验证：按用户偏好未跑本地构建。

## 当前新增任务：AI 助手移动端聊天布局继续优化（2026-04-28）

### 本轮实现进度
- 用户参考 LobeChat 移动端布局反馈 AI 助手仍拥挤，核心问题是移动端仍像“表单卡片”而不是真聊天视图。
- 前端：`AssistantWidget` 移动端改为近全屏聊天布局，外层去掉大圆角厚卡片；顶部固定、警告提示缩成一行胶囊、消息区直接滚动占满剩余空间。
- Composer：输入框、上传截图、发送按钮和用量提示合并到底部输入栏，去掉单独的上传/发送按钮行与 textarea resize handle；底部兼容 `safe-area-inset-bottom`。
- 桌面端：仍保留弹窗和黏土卡片质感，仅复用更紧凑的 composer。
- 验证：本次按用户偏好未跑本地构建；调试模式已可用于后续本地界面查看。

## 当前新增任务：新 UI 前端调试模式（2026-04-28）

### 本轮实现进度
- 目标：没有数据库/后端联调环境时，也能进入新 UI 用户控制台和轻量管理端检查界面。
- 前端：新增 `VITE_UI_DEBUG_MODE` / Vite 开发环境 `?debug=1` 调试开关；`UserContext` 在调试模式自动注入管理员 mock 用户。
- API：`services/api.js` 在调试模式通过 axios adapter 返回 mock `/api/status`、用户、令牌、日志、充值、公告、申诉、AI 助手、定价、模型状态等关键接口数据。
- AI 助手：调试模式下 `/api/ui/assistant/chat` 不走真实 fetch，上屏 mock 流式回复，不消耗真实 Token。
- 入口：新增左下角 `UI DEBUG` 快捷面板，可跳转首页、控制台、公告、定价、状态、管理端、公告管理、申诉审核、AI 助手配置等页面。
- 文档：更新 `uiweb/README.md` 的挂载路径、dev proxy 和调试模式使用方式。
- 验证：`cd uiweb && npm run build` 通过，仅保留既有 `vendor-icons` chunk 偏大的 Vite 警告。

## 当前新增任务：AI 助手移动端对话体验优化（2026-04-28）

### 本轮实现进度
- 用户反馈 AI 助手顶部欢迎说明在移动端拥挤，决定把欢迎说明改成聊天区第一条助手开场白。
- 前端：`AssistantWidget` 移除标题区长欢迎文案，新增本地逐字输出的开场消息；移动端压缩弹窗 padding、警告条、聊天气泡、截图缩略图、输入框和底部按钮布局。
- 体验边界：开场白只做前端打字效果，不调用模型、不消耗助手 Token；真实用户提问仍走 `/api/ui/assistant/chat` 流式接口。
- 验证：`cd uiweb && npm run build` 通过，仅保留既有 `vendor-icons` chunk 偏大的 Vite 警告。

## 状态：新 UI 管理端第一阶段（公告系统）第一版已实现并完成本地验证

## 当前新增任务：空回补偿申诉（2026-04-28）

### 本轮实现进度
- 后端：新增 `model/ui_refund_appeal.go`、`controller/ui_refund_appeal.go`，注册 AutoMigrate；新增用户侧候选检测/提交/自查列表 API 与管理侧列表/详情/通过/驳回 API
- 用户侧：`LogList` 静默检测最近 48 小时疑似空回，仅在有候选时显示“自助补空回”，提交后进入人工审核
- 管理侧：`ClayAdminShell` 新增“申诉”导航；新增 `/admin/refund-appeals` 审核页，支持查看明细、通过补偿、驳回说明
- 补偿方式：审核通过后事务内增加 `users.quota`，并写 `LogTypeManage` 管理日志，经典控制台无需改 UI
- 用户闭环：新 UI 日志页新增“申诉记录/申诉审核中”轻量入口，复用 `/api/ui/refund-appeals/self` 展示最近申诉、状态、补偿额度、审核说明
- 验证：`uiweb npm run build`、Go build、临时 SQLite 主节点启动验证通过；未登录访问用户/管理申诉接口返回 401

## 当前新增任务：新 UI 深色模式（Moon Clay，2026-04-28）

### 本轮实现进度
- 主题体系：新增 `ThemeProvider`，支持 `system` / `light` / `dark`，本地存储 `uiweb.theme.mode`，并在 `index.html` 预写入 `html[data-theme]` 避免首屏闪烁
- UI 入口：公共导航、用户控制台、管理端顶部加入主题切换按钮；个人设置 > 偏好中的“主题”配置改为跟随系统/浅色黏土/Moon Clay 夜间黏土
- 样式底座：`tailwind.config.js` 的 clay 色板与 `shadow-clay*` 改为 CSS variables；`index.css` 定义浅色/Moon Clay 两套色板、文字、阴影、凹陷输入框和焦点阴影
- 兼容处理：深色模式下覆盖常见 `bg-white/*`、`border-black/*`、硬编码品牌文字色与灰色类，减少旧页面片段在夜间主题下突兀发白/发黑
- 验证：`cd uiweb && npm run build` 通过；本地 dev server `http://127.0.0.1:5174/` 返回 200

### 生产前置
- 生产 `NODE_TYPE=slave` 需要手动创建 `ui_refund_appeals`、`ui_refund_appeal_items`
- 建议设置 `UI_REFUND_APPEAL_START_AT`，用于排除上线前已经手动补偿过的历史空回记录

## 新规划（2026-04-28）

### 新 UI 管理端第一阶段：公告系统
- 目标：做轻量“站点运营后台”，不动原版 new-api 管理设置页
- 首个模块：公告管理 + 强制公告弹窗 + 主页历史公告页
- 强制公告规则：每条公告按 ID/version 必须确认一次；弹窗按钮为“不再显示此公告”复选框 + “我已知晓”
- 历史公告入口只在公共主页/公共导航，不放进用户控制台导航
- 后端新增独立表设计：`ui_announcements`、`ui_announcement_acks`；生产 `NODE_TYPE=slave` 需要手动建表，用户已手动执行建表且无报错
- 后续模块：空回申诉审核、页面文案配置、操作审计

### 开发计划路线
1. 后端基础：新增公告模型、迁移注册、公开公告接口、管理员公告 CRUD 接口
2. 权限边界：复用现有登录态与管理员权限，新增 `AdminRoute` / 管理端入口可见性判断
3. 前端用户侧：新增 `AnnouncementProvider`，进入新 UI 时检查强制公告；未登录用 localStorage，登录用户走服务端 ack；弹窗只按每条公告版本确认一次
4. 历史公告页：新增 `/announcements`，接入公共导航，不加入控制台导航
5. 管理端第一版：新增 `/admin` 骨架与 `/admin/announcements`，支持列表、新建、编辑、启用/停用、置顶、强制弹窗、版本递增
6. 验证：本地 `uiweb build` + Go build + `NODE_TYPE=slave` 连接 MySQL 启动；检查新表存在、公开接口、管理员接口、弹窗确认逻辑
7. 后续迭代：空回申诉审核、页面文案配置、管理端操作审计

### 本轮实现进度（2026-04-28）
- 后端：新增 `model/ui_announcement.go`、`controller/ui_announcement.go`，注册 AutoMigrate；新增公开公告列表、强制公告列表、用户确认 ack、管理员公告 CRUD/PATCH/DELETE API
- 前端用户侧：新增 `AnnouncementProvider` 强制公告弹窗队列，按 `id + version` 本地/服务端确认；新增 `/announcements` 历史公告页，并只接入公共导航
- 前端管理侧：新增 `AdminRoute`、`ClayAdminShell`、`/admin`、`/admin/announcements`，支持公告列表、新建、编辑、启用/停用、置顶、删除
- 验证：`uiweb npm run build`、Go build、`NODE_TYPE=slave` + MySQL 短启动通过；`/api/ui/announcements` 与 `/api/ui/announcements/active` 返回 `success=true`

## 本次完成（2026-04-28）

### AI 助手第一版
- 后端：新增 `model/ui_assistant.go`、`controller/ui_assistant.go`，注册 AutoMigrate；新增配置、知识文档、会话摘要三组模型和用户/管理 API
- 用户侧：`ClayConsoleShell` 挂载右下角 AI 助手悬浮球，支持对话式消息、问题描述、上传/粘贴截图、当前页面路径，并通过流式接口边生成边展示回复
- 管理侧：新增 `/admin/assistant` 配置页，支持启用开关、助手名称/欢迎语、站内助手账号或外部自定义模型来源、Token/API Key、模型名、系统提示词、截图/知识库/会话开关、每日限流、截图大小、知识文档 CRUD、最近会话查看
- 模型来源策略：推荐手动创建 `ai-assistant` 站内用户并给专用 Token；配置页也保留外部 OpenAI-compatible Base URL/API Key
- 隐私与边界：不保存截图原图，仅保存会话摘要；内置系统提示词限制 AI 不承诺退款、不修改额度、不代替管理员审核
- 验证：`go build ./...` 与 `cd uiweb && npm run build` 通过，仅保留 vendor-icons chunk 偏大的既有 Vite 警告
- 生产前置：`NODE_TYPE=slave` 需要手动创建 `ui_assistant_configs`、`ui_assistant_documents`、`ui_assistant_sessions`
- 新增流式聊天接口：`POST /api/ui/assistant/chat`，后端以 OpenAI-compatible `stream: true` 调用上游并将增量文本转发给前端

### 移动端首页公告入口
- 移动端首页 Hero 操作区新增 `/announcements` “站点公告”快捷按钮，使用 lucide `Megaphone` 图标，与现有“模型状态”移动端入口同层级
- 桌面端仍沿用公共导航中的“公告”入口，不加入用户控制台导航
- 验证：`cd uiweb && npm run build` 通过，仅保留 vendor-icons chunk 偏大的既有 Vite 警告

### 充值页
- 移除 TopUp 页 `top_up_link` 对应的“购买额度 / 前往购买”卡片，仅保留兑换码充值与在线支付区域
- 清理不再使用的 `topUpLink`、`ShoppingCart`、`ExternalLink`

### 日志页体验修复
- 桌面端时间筛选从浏览器原生 `datetime-local` 改为自绘 `ClayDateTimeField`：黏土风输入框 + 月历弹层 + 时间输入 + “今天 0 点 / 现在 / 清空”快捷按钮
- 筛选卡片加 `!overflow-visible`，避免自绘时间弹层被 `.clay-card` 截断
- 桌面端日志表：消费日志继续展示模型、令牌、Token、额度、耗时；非消费日志改为合并详情行，直接显示 `content` 与模型/令牌/分组/Request ID/额度 chip
- 移动端日志卡：非消费日志详情不再 `line-clamp` 或 `truncate`，完整显示详细信息
- 刷新速度优化：拆分“正在编辑的筛选条件”和“已应用筛选条件”，避免每次输入/改时间都自动请求日志；新增列表“刷新”按钮；增加请求序号保护，避免旧请求覆盖新结果
- 延迟显示修复：新 UI 日志页默认结束时间改为空，避免页面打开后固定旧 `end_timestamp`；顶部刷新与今日卡片刷新统一回到第一页拉最新日志，并同步刷新今日消耗与空回候选
- 空回申诉闭环：日志页新增用户端申诉记录弹窗，提交成功、手动刷新、打开记录时都会刷新记录状态；无历史记录时不展示入口
- 验证：`cd uiweb && npm run build` 通过，仅保留 vendor-icons chunk 偏大的既有 Vite 警告

### 本地 slave + MySQL 构建验证
- `uiweb` 执行 `npm run build` 通过
- Go 执行本地编译，产物 `bin/new-api-local-test.exe` 生成成功
- 使用 `NODE_TYPE=slave` + 远程 MySQL 启动本地服务成功，日志确认 `using MySQL as database`，且未出现 `database migration started`
- 公开页面/API 验证：`/`、`/logs`、`/topup`、`/console/log`、`/api/status`、`/api/setup`、`/api/model-status?window=1h` 均返回 200
- 静态资源验证：favicon、主 JS、vendor-icons JS、CSS 均返回 200
- 未登录请求 `/api/log/self` 返回 401，符合预期
- 测试完成后已停止本地进程并释放 3000 端口

## 本次完成（2026-04-27）

### 新页面：API URL 子界面 (/api-urls)
- 双卡片展示：通用地址 (newapi.youkies.space) + 国内优化 (newapi.youkies.cn)
- 一键复制 + 弹窗提醒"地址不带 /v1，部分软件需自行追加"
- "不再提示" 复选框：localStorage `uiweb.apiUrls.suppressV1Notice=1`
- 修复 ClayCheckbox 双触发 bug：`<span>` 上冗余 onClick 与 `<label>→<input>` 冲突

### 签到时区修复（核心 bug）
- 根因：Docker 容器默认 UTC，`time.Now().Format("2006-01-02")` 取 UTC 日期；UTC 0:00 = 北京 8:00，用户反馈"凌晨刷新不准"
- 修复 1（应用层）：`controller/checkin.go` + `model/checkin.go` 增加 `checkinTimezone()`，读 `CHECKIN_TIMEZONE` env，默认 `Asia/Shanghai`；`HasCheckedInToday`/`UserCheckin`/`next_checkin_at` 全部按该时区
- 修复 2（容器层）：`Dockerfile` 加 `ENV TZ=Asia/Shanghai`
- 修复 3（前端时钟漂移补偿）：`GetCheckinStatus` 返回 `server_now` + `next_checkin_at`，前端按 `skew = clientNow - server_now` 校正后倒计时

### 日志页：今日消耗卡片
- LogList 顶部新增"今日消耗（自 0:00 起）"粉色渐变卡片
- 调用 `/api/log/self/stat?type=2&start_timestamp=<今日0点>` 独立拉取，与列表筛选解耦
- `services/logs.js#getUserLogsStat` 增加参数支持

### 日志列表 UI 优化
- 桌面表格：行高 py-5→py-3、padding px-5→px-4、表头加 `bg-clay-bg/50` 浅底 + uppercase
- 移动卡片：4 行结构（类型+流标↔额度 / 模型 / Token / 时间↔用时+令牌名），额度右上突出，删除 `ml-10` 缩进

### 模型与价格页视觉重做
- 卡片三段式：①带渐变着色的品牌头部（按量蓝粉渐变 / 按次黄渐变） ②输入/输出双栏（蓝/粉色调 + 方向箭头图标） ③缓存独立行
- 头部信息提示 chip：单位 /1M tokens · 实际扣费按渠道倍率

### 模型状态页四大优化
- OverviewBanner：状态指示器（脉冲 ping）+ 加权 SLA + 4 列指标卡 + 立即刷新按钮
- ModelCard：hover 上浮、底部分隔线、最新桶请求数显示
- Uptime 柱条：hover scale-y-105、白底箭头 tooltip、时间轴标签
- StatusLegend：底部凹陷信息卡，三档阈值说明（≥95%/60-95%/<60%）
- Tooltip 跟随柱条对齐：`leftPct = (i+0.5)/N*100`，clamp 8-92%
- 修复 tooltip 被 .clay-card 全局 `overflow-hidden` 截断：ModelCard 加 `!overflow-visible`

## 下一步
- 需要真实管理员账号进入 `/admin/announcements` 新建一条强制公告，线上验证弹窗确认链路
- 后续可继续做空回申诉审核、页面文案配置与管理端操作审计
