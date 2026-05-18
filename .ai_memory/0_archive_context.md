# 归档上下文

> 2026-05-01 已压缩：旧的逐条流水已折叠为主题索引。需要细查历史时优先看 git 历史和相关提交，而不是把完整聊天过程重新塞回记忆库。

## 2026-04-20 — 初始判断

- 项目是 Go + Gin + GORM 的 AI API 网关/代理，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等多类上游，前端包含经典 `web/` 与新建 `uiweb/`。
- 早期判断：4C4G、约 650 用户、峰值并发 9 的规模下，MySQL 与应用同机/同服务商部署可用；前端美化采用独立 `uiweb`，不在经典前端上做大面积 CSS 换皮。

## 2026-04-24~2026-04-27 — uiweb 基础成型

- 敲定 `uiweb`：Vite 5 + React 18 + Tailwind CSS 3 + JSX + 自研 Clay 组件，不使用 TypeScript。
- 已完成访客页、登录后控制台、令牌、日志、签到、定价、模型状态、API 地址页等主要页面，Go 端通过 `embed uiweb/dist` 与 SPA fallback 接入根路由。
- 路由重组：新 UI 挂根路径，经典前端挂 `/legacy/*`，`/legacy` 显式 301 到 `/legacy/`，`/u/*` 301 兼容旧链接。
- 关键经验：uiweb 改动上线链路是前端 build、Go build、停止旧进程、再启动新进程；旧进程占端口会让新二进制看似启动但实际未生效。

## 2026-04-26~2026-04-28 — 部署、头像、公告与空回申诉

- 部署转向 Zeabur Git 部署，GitHub push 自动构建；生产 `NODE_TYPE=slave` 不会 AutoMigrate，新表/新列必须手动建表或 `ALTER TABLE`。
- 国内中转为腾讯云 Nginx 反代 `newapi.youkies.cn` 到海外服务，SSE 需要 `proxy_buffering off` 与长 `proxy_read_timeout`。
- 头像功能完成：DB BLOB 存储、200KB 上限、`react-easy-crop` 裁剪、公开头像 API、CRC32 ETag + `no-cache`、前端 `_avatar_t` cache-bust。
- 新 UI 管理端第一阶段完成：公告管理、强制公告弹窗、历史公告页，使用 `ui_announcements` 与 `ui_announcement_acks`。
- 空回补偿申诉第一版完成：日志页检测 48 小时疑似空回，用户提交批量申诉，管理员人工审核，通过后事务补余额并写管理日志。

## 2026-04-28~2026-04-29 — AI 助手与会员展示

- AI 助手从悬浮球 MVP 演进为用户侧聊天工作台：支持截图、流式回复、后台配置、知识文档、免费次数、余额续聊、历史对话、思考过程折叠。
- AI 助手付费续聊固定走站内 `/pg/chat/completions` 计费链路；免费次数固定每用户 8 次/日，余额续聊需提交所选 `group` 与 `model_name`。
- 桌面端助手改为全屏聊天工作台，移动端改为近全屏聊天视图；模型/分组选择器改为自定义 Clay 弹层。
- 会员身份展示完成：按 `user.group` 展示普通、Pro优、Super优、Ultra优；升级由外部项目自动移组，newapi 只展示身份，不提供升级入口。
- Claude thinking 参数兼容修复完成：OpenAI 格式转 Claude extended thinking 时清洗 `temperature`、`top_k`、非法 `top_p` 与强制工具调用，避免 Anthropic 400。

## 2026-04-29~2026-04-30 — 体验收尾、镜像与非流转上游流式

- 完成签到日历移动端精简、关于页退款说明、常见报错 Q&A 文档、`gpt-5.5` 基础模型匹配。
- 已多次构建并推送 GHCR 镜像：`ghcr.io/youkies/new-api:latest`，最近一次对应提交 `20ce0426`。
- 新增渠道级 `non_stream_to_stream_enabled`：用户仍发非流请求、下游仍收非流 JSON，但服务内部可对 OpenAI-compatible 上游强制 `stream:true` 并聚合 SSE，绕开 Cloudflare 非流 100s 左右超时风险。
- 最新验证：`go test ./relay/channel/openai ./relay -count=1` 通过，`git diff --check` 通过；前端完整 build 被既有 `@douyinfe/semi-ui/dist/css/semi.css` package export 问题阻断。

## 2026-05-01 — 记忆库压缩

- 将旧的 `2_active_task.md` 中大量已完成任务移入本归档索引，只保留当前可接手状态。
- 将 `1_project_context.md` 改为稳定事实清单，移除重复的实现流水。
- 将 `3_work_log.md` 改为近期摘要，不再保留每天每轮的长日志。

## 2026-05-08 — 官方 default UI 保留策略与管理边界

- 已合并官方 `v1.0.0-rc.4` 并推送 `origin/main`，路由长期策略明确：`uiweb` 继续作为根路径主 UI，`/legacy/` classic UI 承担重管理后台备用，`/default/` 官方新版 UI 仅保留为备用入口和功能参考。
- 三套 UI 是同一 Go 进程内嵌静态资源，不是三套服务同时运行；未访问时几乎不增加 CPU/DB 压力，主要成本是构建时间、镜像体积和静态资源体积。
- 用户明确不喜欢官方 default UI 的当前审美，但也不删除；后续官方 default 更新优先观察 API、逻辑和可借鉴功能，不主动替换主 UI。
- 已检查官方 `upstream/main` 在 `e8cfb546..c19d5aa6` 的后续 5 个提交，变动集中在 `web/default` 的 dashboard、theme token、chart 与性能指标展示，没有新的后端大功能。

## 2026-05-08 — 记忆库长细节转入项目文档

- 用户判断正确：`uiweb` 已经包含公告、通知、申诉、AI 助手、会员、页面配置、头像、API 地址、移动端策略等完整业务层，仅靠记忆库会越来越难维护。
- 从 git 历史中取回归档压缩前最后一个长记忆版本 `4f2a92bc`，与当前精简记忆合并，新增 `docs/project-handbook.md` 和 `docs/uiweb/` 专题文档。
- 后续原则：`.ai_memory` 保持索引和当前状态；完整功能、接口、迁移、部署、排障细节沉淀到 `docs/`，需要时查阅，不要求每次完整阅读。

## 2026-05-08 — 复盘后二次规范化

- 完整复核当前复盘材料后确认：`docs/project-handbook.md` 与 `docs/uiweb/` 已覆盖旧长记忆、当前三套 UI 策略、生产迁移、600s/SSE、通知、申诉、AI 助手等长期细节。
- 将 `1_project_context.md` 从半文档形态压缩为稳定索引和高风险导航；将 `2_active_task.md` 压缩为当前交接单，避免活动任务再次堆积历史流水。
- 规范后的原则：先读轻量记忆判断方向，需要细节时查专题文档；长期变化更新 docs，记忆库只追加短索引和当前状态。

## 2026-05-18 — KPay 到账可靠性收敛为四层兜底

- 起点：审查 KPay 适配现状（kpay-epay-api/references 与代码对照），确认下单/查单/回调/重复入账/金额/二维码/webhook 不可达兜底都已就位；主要剩官方未公开的 webhook 签名待签字符串、未接 crypto / 退款 / 结算等改进项。
- 用户决定方向：(1) 管理员端 KPay 到账总览 + 触发"按真实状态查单补单"；(2) 长期 pending 自动扫库补 query；(3) 下单后短期高频跟踪，覆盖用户切后台 / 关浏览器 / webhook 延迟。
- 在 controller 层把 `CheckKPayTopUp` 的核心查单+终态同步+入账逻辑抽出为 `reconcileKPayTopUp`，被前端 check、管理员 replay、全局 sweeper、下单后 watcher 四种调用方共用。这样新增触发器只需薄壳，幂等/原子性都集中在 `RechargeKPay` 与 `UpdatePendingTopUpStatus`。
- `StartKPayPendingSweepTask`（master 限定）每 5 分钟扫一次 `payment_provider=kpay AND status=pending AND provider_order_no<>''` 且创建时间落入 `[now-7d, now-2min]` 的订单，每轮 ≤50 单、50ms 限速；最小 2 分钟年龄是为了避免与刚下单的前端 5 秒轮询冲突。
- `SchedulePostCreateKPayWatch` 在 `RequestKPay` 保存平台单号后立刻启动一个 master goroutine，按 25s/35s/45s/60s/90s/90s/2m/2m/2m 退避序列查单约 12 分钟；并发上限 200 用 `atomic.Int64` 控制，超限直接放弃由全局扫描兜底。首次 25s 延迟故意大于前端 5s 轮询，避免重复打 KPay API。
- 退出条件：每次探测先 `LockOrder` + 重新 `GetTopUpByTradeNo`，状态不再 pending（webhook 入账 / check 入账 / failed / expired）立刻返回。`RechargeKPay` 用 `Where status IN (pending,failed,expired)` 原子切换，watcher 与 webhook 同时命中也只有一个能加额度。
- 管理员页面 `/admin/kpay-topups`（uiweb）只复用同一段 `reconcileKPayTopUp`，按 KPay 真实状态入账或同步终态，不提供"无视上游强制 success"按钮——避免与现有 `AdminCompleteTopUp` 风险面叠加。
- 血泪教训：用户在 `NODE_TYPE=slave` 测试机上测 watcher / sweeper 不生效。所有 KPay 后台兜底以及其他 master-only 任务（订阅 reset、Codex refresh、AutoTestChannels）都依赖 `common.IsMasterNode`，slave 节点会全部跳过。slave 只承担 API relay，验证后台任务必须在 master 节点。这一条已并入 `1_project_context.md` 部署约束。
- 发布产物：提交 `6feb0d81 新增 KPay 充值到账管理页与 pending 自动扫描` + `3bd0f87f 新增 KPay 下单后短期高频跟踪`；GHCR 镜像 `latest` 与 `:3bd0f87f` / `:kpay-post-create-watch-20260518`，digest `sha256:d34a9cb76551f4e81cc1d412737a2f7278c6cb81db66c26122ce38c49b561228`，platform `linux/amd64`。生产侧验证良好。

## 2026-05-18 — 用户模型别名存档 feature 的认知演变

### 起点：跨分组同名模型冲突

- 用户问：newapi 多个分组里有同名模型（如 default、premium 都有 gpt-4），用户希望同一把 key 能在不同分组之间切换，但 OpenAI 协议里 model 名是字符串，没法表达"哪个 group 的 gpt-4"。
- 第一反应（被否定）：用 `{group}/{model}` 前缀路由（OpenRouter 风格）。用户更想要"DIY 分组别名 + 可分享"。
- 关键升级：用户最终选择"自建分组存档 + 别名 + 短码分享"，且 UI 优先移动端。

### 设计分歧：别名命名空间

- 全局唯一 vs 存档内唯一。第一版选了全局，简单但冲突高。
- 用户决定改为"仅存档内唯一"：每个存档是独立命名空间，跨存档可重名。
- 引入"Key 绑定默认存档"机制消歧 → 请求带原始模型名按 key 绑定的存档查找；带前缀显式跨存档调用。
- 路由分隔符：第一版 `/`，但真实模型名常含 `/`（anthropic/claude-3-5-sonnet），改为 `@`。

### 实施分歧：错误处理

- 别名命中无权限源分组 → 创建时校验 + 运行时再校验（双层防御，存档创建后 group 权限可能被撤销）。
- 空别名要不要自动用源模型名 → 是。
- 冲突时要不要自动加前缀 → 后端 INSERT 撞唯一约束时自动用 `source_group/alias` 重试一次。
- 中文别名要不要支持 → 要。`unicode/utf8.RuneCountInString` + 排除 `@` 和空白即可。

### Clay UI 视觉学习

- 第一版用 `bg-clay-bg shadow-clay-inset text-clay-faint` 做小胶囊，视觉过于扁平苍白。
- 用户反馈"丑"后总结出 Clay 胶囊设计模式：**有色 pastel 背景 + outset shadow-clay 凸起 + lucide 图标 + font-black**。
- 图标-色彩对应固化：紫=分组(Layers)/别名(Tag)，蓝=令牌(KeyRound)/数量，黄=真实模型(Cpu)，emerald=分享/正向。
- 字体重量普遍提升：基础 `font-bold`，关键信息 `font-extrabold` 或 `font-black`。

### 工作流：feature 分支 + docker tag（已沉淀为偏好）

- 用户明确要求所有新 feature 走独立 `feature/*` 分支，不污染 main。
- 每次 commit 后立即在干净 `git worktree --detach` 里 `docker buildx --push` 到 GHCR，tag 格式 `feature-{name}-{commit_sha}`，永不动 `:latest`。
- 测试机部署 feature tag 镜像，过了再决定 merge。
- 7 轮迭代每轮独立 commit + 独立镜像，问题分析回滚都方便。

### Sub-feature: Clay 日志卡片化（一并完成）

- 用户先入为主以为日志要管理员视角的密集表格，反思后改判：**用户侧日志数量可控，应该用大卡片不是密集表格**。Admin 看日志走 legacy 不在 Clay 做新 UI。
- 后端追加 `RequestedModelName` 字段；`RecordConsumeLog`/`RecordErrorLog` 内部从 `ContextKeyUserInputAlias` 自动捕获，所有调用点零改动。
- 前端 LogList.jsx 删除桌面 table 分支，统一 grid 卡片流，删除 LogRow/LogSummary 死代码。

### 收敛点

- 7 commits 完成全套实现 + 6 轮反馈微调。
- 最终镜像 `ghcr.io/youkies/new-api:feature-aliases-and-clay-logs-67e307ea`。
- 仍在 feature 分支，未 merge，等用户在测试机最终验收后再合并。

## 2026-05-18 — v4/v5 日志卡片二次重做 + Clay 阴影全局修正

### 起点：v4 主副标题层级（bab13de8）

- 用户提出新结构：**主标题=用户输入的模型 id**（绑定别名时即 alias 名；透传时即真实模型），**副标题=relay 实际命中的 group / real_model**，箭头 `→` 改 `/`，金额 4 位小数无 `+/-` 符号。
- 大图标按 type 统一（消费=Activity / 系统=Terminal），不再随 stream / 思考变化。
- 移除 token key 显示，指标行单行 chip 流：Clock 时间 · ↓入 · ↑出 · 缓读 / 缓写 · Zap 首字 · Timer 总。

### 发现：测试机视觉差距巨大

- 用户首张测试机截图与 mockup 完全不一致，初判为镜像未拉新；Zeabur 日志确认镜像已起，但视觉仍偏差。
- 真实数据触发了 mockup 没考虑的两个场景：
  - 用户别名叫"非思考"，对应的源分组也叫"非思考" → 副标题"非思考 / 非思考-model" 重复
  - 真实模型名 `「按次」claude-opus-4-6-渠道2` 比 mockup 的 `claude-haiku-4-5` 长很多，被 `break-all` 折成两行
- v5 修：`alias === group` 时跳过分组、长 id 改 `truncate` + tooltip、桌面网格 `xl:3` → `2xl:3` 给宽度。

### 关键认知突破：旧 `--clay-shadow` 是外凸内凹冲突

- 用户复诉"现在实装看着像向内凹陷，你给我的示例往外凸，差异非常大"。
- 对照 uiweb `--clay-shadow` 和 mockup `--shadow-convex` 发现：**外阴影都是凸起方向，但 uiweb 的 inset 是 `inset 5px 5px DARK + inset -5px -5px LIGHT`（CONCAVE 凹陷配方），mockup 的 inset 是 `inset 2px 2px LIGHT + inset -2px -2px DARK`（CONVEX 凸起配方）**。外凸内凹叠加是 uiweb 卡片"扁/像凹槽"的根因。
- 全局翻转 inset 方向 + 缩小到 2px/5px blur + 高光降到哑光范围（外光晕 0.85 → 0.55，内高光 0.65 → 0.40）。light + dark 双模式同步处理；`-active`/`-inset`/`-focus` 这三个本来就该凹陷的没动。
- 同时去掉 `.clay-card` 的 2px 24% 白边——这层在旧暗 inset 下会被吃掉，新亮 inset 下反而叠出光晕"脏边"。

### 小胶囊 / 操作按钮的黏土质感

- 用户："按钮没做成黏土风，密钥显示的胶囊质感也很廉价，其他的胶囊元素也非常扁平化"。
- 复盘原因：所有 chip 用了 `shadow-clay`（8-10px offset），shadow 散到 chip 外面去了，chip 本身反而显得平。
- 修：所有小胶囊改 `shadow-clay-sm`（3px offset 专门给小胶囊用）；`shadow-clay-sm` 内高光从 0.38 提到 0.55 强化凸起感。
- 操作按钮全部改成 `w-8 h-8` 圆形 clay icon-btn，按语义着色（启用=绿黏土、删除=粉黏土）。

### 副产品：日志页其它改进

- 错误日志加纯红色 `log.content` 显示（一开始做成红底胶囊，被用户判定"又把胶囊放进卡片里"，改纯文字）。
- 桌面端"卡片 / 列表"viewMode 切换，localStorage 持久化。
- TokenManage 名称下挂"绑定·{archive}"紫色 Tag chip；未绑定显示灰凹陷"+ 绑定存档" CTA。
- 状态从 pill 改成 dot + 加粗文字；已用额度 4 位小数 + font-black hero 数字。
- 去掉标题 / 副标题的 `font-mono`：CJK 在 mono fallback 下细瘦，改全局 Nunito + 系统中文字 + `tracking-tight`。

### 收敛点

- 13 commits 完成 v1 → v5.4，最终镜像 `ghcr.io/youkies/new-api:feature-aliases-and-clay-logs-aa428dbb`，digest `sha256:1aac137a81cb394d7c893d147d698df4f9d7445ffe4dd78414be7a2a774f6275`。
- **clay 阴影修正是全局影响**，其它页面（仪表盘 / 存档 / URL / 充值 / 签到 / 设置 / AI 助手 / 游乐场 / admin 后台）的视觉都会被波及。
- 下一步：用户明确要"对整个 uiweb 做一次全面 Clay 风格审查"。

## 2026-05-18 — 记忆库二次压缩 + 沉淀到 docs/

- 用户判断：feature 分支 9 轮 → 13 轮迭代细节、6 个旧"当前可接手状态"段（必吃榜搁置、KPay 多轮、调试 Key 多轮、playground 多轮等）让 `2_active_task.md` 长到 540 行，不适合做"当前交接单"。
- 沉淀：
  - 完整 feature 实现细节 + 13 轮 commit 表 + Clay 设计模式 + 阴影修正原理 → `docs/feature-archive-and-clay-logs.md`
  - 新表 / 新列 + slave 手动 SQL → 追加到 `docs/uiweb/database-and-migrations.md`
  - 旧已完成任务剥离，仅在 `2_active_task.md` 末尾留一行索引
- `2_active_task.md` 压缩到 76 行：当前分支 + 镜像 + slave 迁移清单 + 验收清单 + **下一步：全 uiweb Clay 风格审查**。


## 2026-05-18 — v6 全 uiweb Clay 风格审查 + 适配（最终合并 main）

### 触发
v5.x 系列把 LogList / TokenManage / ArchiveList 等核心页改成了 Clay 凸起 + 紫=分组、黄=真实模型、蓝=令牌、绿=启用收入的语义色板。但其余 25+ 页面（特别是 admin 与 GPT 5.5 写过的 Pricing/Notifications/About/Checkin/Playground/ModelStatus）仍残留 Tailwind 默认色（emerald/amber/rose/red/gray）、border-2 粗实线、shadow-clay 用在小元素、wide pill 状态条等违规。

### 关键决策路径

1. **基础组件库杠杆最高**：admin 6+ 页重复手写 `w-10 h-10 rounded-full bg-clay-bg shadow-clay flex...`、自定义 IconButton/Stat。新增 `ClayIconButton` + `ClayBadge` + `ClayInsetPanel` + `ClayEmptyState`，增强 ClayButton 加 size/danger/warning variant + ClayCard 加 density/tone，一次性消除大量 `!important` 透传。
2. **设计 token 注册**：把 `text-clay-pink-ink/blue-ink/purple-ink/green-ink/yellow-ink` 5 个 ink 色 + `shadow-clay-xs/inset-sm` 进 tailwind.config.js，让 26 个文件批量 sed 替换硬编码 `text-[#8a4860]` 等。**收益**：暗色模式自动响应（不再依赖 index.css 选择器 hack），HMR 实时切换。
3. **凹陷只用于输入/凹槽语义**：用户截图反馈 TopUp "实付金额" 凹槽"丑发昏"，全面清理非输入框的 `shadow-clay-inset` 误用 → hairline/divide-y 替代。Clay 规范确认：inset 仅给 input/textarea/track/viewtoggle/QR 槽用，展示数据无 shadow，纯文本布局。
4. **货币符号统一**：充值/签到 content 字符串里历史 ¥ 符号是后端写入时的全局货币（CNY 时写 ¥），切换到 USD 不会重写历史。最终选择**始终用前端 `getCurrencyConfig()` 推断 symbol，content 数字保留** — 跟 quotaToDisplay 行为对齐。
5. **PayMethodIcon SVG 内嵌 vs CSS 嵌套**：v6.9 用 `p-[12%]` 百分比 padding 做双层圆，**CSS 中 padding percent 相对父元素宽度** — pay-btn 父 200+px 时 padding ≈ 24px 直接吞掉 28px 图标，内圈坍缩呈白球 bug。最终改单个 SVG 内嵌 viewBox 24×24 三圆同坐标系 + 唯一 gradient id 防冲突，跟 className 100% 同步缩放无任何 padding 计算。

### 不要再做
- 凹陷 (`shadow-clay-inset`) 用于非输入数据展示（用户明确反馈"丑发昏"）
- `bg-[#xxx]` 硬编码品牌色—除非确实是品牌色（Alipay #1677FF/WeChat #07C160），其余统一用 token
- 百分比 padding 做嵌套圆/方比例计算—永远用 SVG viewBox / Tailwind 固定尺寸类
- modal 内错误信息显示时不复制功能—用户期望"错误信息点击复制"

### 沉淀文档
- `docs/feature-archive-and-clay-logs.md` 追加 v6.x → v6.10 完整 commit 链（13 commits）。
- `docs/uiweb/clay-design-tokens.md` 不存在，本次决策沉淀在本归档 block 即可。
