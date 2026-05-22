# 项目核心知识库

> 本文件只保留稳定索引和高优先级决策。完整细节查 `docs/project-handbook.md` 与 `docs/uiweb/`，不要把长流水重新塞回记忆库。

## 接手顺序

- 先读 `.ai_memory/2_active_task.md`，确认当前任务、阻塞和下一步。
- 再读本文件，确认稳定约束和长期决策。
- 涉及 `uiweb`、迁移、部署、SSE/600s、通知、申诉、AI 助手、头像、会员、页面配置时，按 `docs/project-handbook.md` 索引打开对应专题文档。
- 记忆库只写索引、当前状态和关键决策；可复用细节写入 `docs/`。

## 项目形态

- new-api 是 Go AI API 网关/代理，后端采用 Gin + GORM，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等多类上游。
- 数据库必须同时兼容 SQLite、MySQL、PostgreSQL；生产主要使用 Zeabur MySQL，且 `NODE_TYPE=slave` 会跳过 AutoMigrate。
- 业务代码 JSON 编解码优先使用 `common/json.go` 包装函数。
- 涉及新渠道时要确认 `StreamOptions` 支持情况。
- 涉及表达式计费前先读 `pkg/billingexpr/expr.md`。

## 文档体系

- 总入口：`docs/project-handbook.md`。
- uiweb 总览：`docs/uiweb/overview.md`。
- 用户侧功能：`docs/uiweb/features.md`。
- 管理端与运营：`docs/uiweb/admin.md`。
- API 契约：`docs/uiweb/api-contracts.md`。
- 数据库与迁移：`docs/uiweb/database-and-migrations.md`。
- 部署与排障：`docs/uiweb/deployment-and-troubleshooting.md`。
- 用户常见报错：`docs/user-error-qa.md`。
- AI 助手会员知识：`docs/membership-assistant-knowledge.md`。
- 记忆库迁移指南：`docs/memory-to-docs-migration-guide.md`。

## UI 主次边界

- `/`：用户自己的 `uiweb` 主 UI，承载用户侧和轻运营能力。
- `/legacy/`：官方 classic UI，作为重管理后台备用。
- `/default/`：官方新版 default UI，仅保留为备用入口和功能参考，不替换主 UI。
- `/classic` 与 `/classic/*`：301 到 `/legacy/`。
- `/u/*`：301 到根路径，兼容旧链接。
- 三套 UI 是同一个 Go 进程内嵌静态资源，不是三套服务；未访问时几乎无运行时 CPU/DB 负担，主要成本是构建时间、镜像体积和未来合并冲突。

## uiweb 稳定边界

- 技术选型：Vite 5 + React 18 + JSX + Tailwind CSS 3 + 自研 Clay 组件。
- `uiweb` 管理端定位为轻量“站点运营后台”，不要塞大量渠道、模型、系统设置等重管理功能。
- 用户端移动端体验优先优化；管理端主要按桌面使用场景维护，只需保持基本可访问。
- 官方 default UI 当前审美不符合用户偏好，先保留不删除；后续官方 default 更新优先借鉴 API/逻辑，不主动替换主 UI。
- 用户头像下拉菜单的“游乐场”当前指向 `uiweb` 原生 `/playground`；第一版是“今天吃什么呀”随机工具，支持内置菜单、用户私有服务器菜单和公共审核菜品池，今日记录仍存在浏览器 `localStorage`，细节查 `docs/uiweb/features.md`、`docs/uiweb/api-contracts.md` 和 `docs/uiweb/database-and-migrations.md`。
- **用户模型别名存档**：用户在 `/archives` 建多个存档，每存档含若干 alias→(group, model) 映射；token 可绑定默认存档；`logs.requested_model_name` 落库用户实际输入模型名。表 `user_model_archives` / `user_model_aliases`，2026-05-18 随 v6 merge main，slave 节点上线前须手动跑 SQL（清单见 `docs/uiweb/database-and-migrations.md`）。
- **Clay 设计 token**：tailwind.config 注册了 `text-clay-{pink,blue,purple,green,yellow}-ink` 语义 ink 色 + `shadow-clay-xs/inset-sm` 轻量阴影；基础组件 `ClayIconButton/ClayBadge/ClayInsetPanel/ClayEmptyState` + `ClayButton.size/variant`、`ClayCard.density/tone` 全部 admin/用户页面通用，避免 `!important` 透传。Clay 凹陷只用于输入/track/凹槽语义，展示数据用 hairline + 大字 hero。

## 支付边界

- KPay 原生充值走服务端 API 下单和回调：用户侧 `POST /api/user/kpay/pay` 创建 `direct_qr` 订单，`uiweb` 站内展示二维码，`POST /api/kpay/notify` 回调入账，`POST /api/user/kpay/check` 仅作为用户当前订单查单兜底。
- KPay 平台回跳地址使用主 UI `/topup?show_history=true`；`uiweb` 兼容旧 `/console/topup` 回跳，并会短期保存待支付 KPay 订单,支付 App 回跳或页面重新聚焦后自动恢复 `/api/user/kpay/check` 补偿查单；KPay 平台订单号保存到 `top_ups.provider_order_no`，用于服务端查单兜底。
- classic `/legacy/` 充值页同样会短期保存待支付 KPay 订单，支付 App 返回、页面重新聚焦或重新进入充值页时会自动恢复并查单；legacy 账单弹窗也会对用户自己的 KPay `pending` 单静默查单并提供"检查到账"按钮。
- KPay 配置入口在 `/legacy/` classic 支付设置的 `KPay 设置` 标签；密钥只保存到 option，不写入 docs、memory、提交或回复。
- 旧易支付兼容链路仍保留，KPay 只是新增站内二维码链路，用于减少外部收银台跳转失败。
- KPay 到账可靠性按四层兜底：(1) KPay webhook `/api/kpay/notify`（主路径，幂等 + 签名校验）；(2) 用户在线时前端 5 秒 `/api/user/kpay/check` 轮询；(3) 下单成功后 `SchedulePostCreateKPayWatch` 启动 master 节点 goroutine，按 25s/35s/45s/60s/90s/90s/2m/2m/2m 退避序列查单约 12 分钟，并发上限 200，订单脱离 pending 即提前退出；(4) `StartKPayPendingSweepTask` 每 5 分钟全局扫描 `payment_provider=kpay AND status=pending AND provider_order_no<>''` 且创建时间在 [now-7d, now-2min] 的订单，每轮上限 50 单、50ms 限速。三套兜底全部在后端 `RechargeKPay` / `reconcileKPayTopUp` 共用同一段原子幂等入账逻辑，前端入口（uiweb / classic）无关。
- 后台 `/admin/kpay-topups`（uiweb）支持按状态搜索全站 KPay 订单，并对未到账订单一键触发查单补单（`POST /api/ui/admin/topups/kpay/:trade_no/replay`），仅按 KPay 真实状态入账，不强制把订单标为 success。

## 部署与生产约束

- Zeabur 同一个项目内同时部署数据库服务和应用服务；数据库为 Zeabur MySQL，数据库名 `zeabur`。
- 正式网站使用本地打包 Docker 镜像并推送到 GHCR 后部署。
- 调试/验证部署使用 `NODE_TYPE=slave`，每次 GitHub push 后由 Zeabur 自动构建。
- 测试机使用服务器迁移前的云悠美国机器与旧数据库，域名 `newapi-test.youkies.space`；push 后由云悠服务器自动构建，运行模式使用 `NODE_TYPE=master`，用于上线前验证，不要混同正式站 Zeabur/GHCR 发布链路。
- 海外域名：`newapi.youkies.space`；国内中转域名：`newapi.youkies.cn`。
- 东京 API-only 节点：`newapi-jp.youkies.space`，部署在东京国际线路服务器，使用 `ghcr.io/youkies/new-api:latest`、`NODE_TYPE=slave`、同一套 Zeabur MySQL；Nginx 只放行 `/v1`、`/v1/*` 和 `/api/status`，根路径返回 404。真实连接信息和 secret 只保存在 git 忽略的 `.local/deployments/newapi-jp/`。
- 国内中转服务器：腾讯云 `81.71.120.210`，Nginx 配置在 `/etc/nginx/sites-enabled/newapi.conf`，同机还运行 `lobe.youkies.cn`。
- SSE/长响应反代关键配置：`proxy_buffering off`，`proxy_read_timeout 1000s`。
- 生产必须固定 `SESSION_SECRET`；如需加密签名稳定，可同步固定 `CRYPTO_SECRET`。
- `NODE_TYPE=slave` 不跑迁移；正式站也不能依赖自动迁移，新表/新列上线前必须手动确认或执行 SQL，完整清单查 `docs/uiweb/database-and-migrations.md`。
- `NODE_TYPE=slave` 不跑任何后台兜底/定时任务（KPay watcher、KPay 全局扫描、订阅 quota reset、Codex 凭据刷新、AutoTestChannels 等都依赖 `common.IsMasterNode`）。验证后台任务必须在 `NODE_TYPE=master` 节点上跑，slave 节点只承担 API relay。
- 官方 `v1.0.0-rc.4` 合并后生产需确认 `perf_metrics` 表，以及 `users.created_at`、`users.last_login_at` 两列。

## 高风险排障索引

- 600s/SSE：优先查 `docs/uiweb/deployment-and-troubleshooting.md`。2026-05-08 对 `newapi-clay.youkies.space` 900s 无模型 SSE 复测完整返回 `done`，未复现固定 600s；`newapi.youkies.cn` 诊断口当时为 404。
- 非流请求转上游流式：渠道级 `non_stream_to_stream_enabled`，用户侧非流、上游强制流式、服务端聚合为 OpenAI 非流 JSON；细节查部署排障文档。
- Claude extended thinking：OpenAI 格式转 Claude 时需清洗 `temperature`、`top_k`、非法 `top_p`，强制工具调用降级为 `auto`。
- 头像缓存：User 对象 `_avatar_t` + 头像 URL `?t=` + 服务端 CRC32 ETag + `no-cache`。
- 定价公式、模型状态 SQL、日志筛选、签到时区、分组签到、通知/申诉/AI 助手等细节均已沉淀到 `docs/uiweb/`。

## 搁置功能

- Youkies 必吃榜第一版已从 `main` 撤回，撤回提交为 `7ac0b9a9`。
- 必吃榜代码保留在远端分支 `feature/youkies-must-eat-shelved`，需要恢复时从该分支继续。
- 当前主线不要依赖 `/must-eat`、`/admin/model-reviews` 或 `ui_model_review_*` 表；相关迁移 SQL 暂不执行。

## 促销活动 / 充值活动体系（2026-05-20 后台化）

- 数据模型：`promotion_campaigns`（活动主表，slug 全局唯一、soft delete）+ `promotion_skus`（SKU 子表，sku_key 全局唯一被 `top_ups.promotion_sku_id` 引用，无 soft delete 但有 enabled 字段）。表结构在 `docs/uiweb/database-and-migrations.md`。
- 关键不变量：**`top_ups.promotion_sku_id` 字段是 varchar(64) 字符串，对齐 `promotion_skus.sku_key`**（不用 int FK，因为历史订单稳定引用）。SKU 软删不真删，硬删前后端检查订单引用。
- 入账路径：`model.RechargeKPay` 检测 `topUp.PromotionSkuId != ""` 时调 `model.FindSkuByKey` 拿 SKU 配置（**不看 enabled**，让已禁用 SKU 的历史订单仍能解析），按 `SKU.DeliveredYuan × QuotaPerUnit` 落账，绕过通用 Amount 公式。
- 缓存：`ListActiveCampaigns` / `FindCampaignBySlugCached` / `ListSkusByCampaignCached` 走 30 秒 TTL 进程内缓存；`FindSkuByKey` 走 60 秒 sync.Map（入账高频）。Admin 任意写操作主动 `InvalidatePromotionCache`。
- Seed：master 启动 AutoMigrate 后检测 `promotion_campaigns` Unscoped count==0 时自动写入 520 默认数据（sku_key `p520-sku-1..4` 与历史订单对齐）。再次启动不重复 seed。
- Admin UI：classic `/console/promotion`（已注册 AdminRoute），列表 + 编辑 modal + SKU 子表 + 销售统计页。SKU 排序用上下箭头（v1 不引入 dnd 库）。
- 公开 API：`/api/user/promotion/:slug`、`/api/user/promotion/:slug/order`、`/api/user/promotions/active` 都改为读 DB。前端 API 契约不变（`sku.id` 仍是 sku_key 字符串）。
- Admin API：`/api/ui/admin/promotions[/...]`（GET/POST/PUT/DELETE + clone + skus + stats）。
- 显示尾零：SKU 加 `PriceDisplay` / `DeliveredDisplay` 两个可选字符串字段，让 "5.20" "52.0" 这种带尾零写法不被通用 `fmtAmount` 吃掉。

## 协作偏好

- 对功能/界面小迭代，用户通常希望完成后整理 diff，并在合适时提交到当前分支。
- 功能修改完成后，本地 debug/验收固定流程：关闭旧的测试浏览器和旧 dev server；用 `--host 0.0.0.0 --port 5178` 启动 `uiweb` Vite；选择当前物理局域网 IPv4 作为访问地址；用前台可见浏览器打开并按需调成手机视口；跑完 smoke test 后不要主动关闭浏览器或 dev server，留给用户继续电脑和手机手测。
- 如果 `uiweb` dev server 已经在跑，UI 微调优先依赖 Vite HMR 热更新：保持前台浏览器和手机页面打开，修改文件后让用户直接看实时效果；只有 HMR 未生效、页面状态异常、依赖/环境/Vite 配置变化时才刷新或重启 dev server。
- 手机同网验收优先使用形如 `http://<LAN_IP>:5178/logs?debug=1` 的地址；若手机打不开，优先提醒检查 Windows 防火墙是否允许 Node.js/npm 在专用网络访问。
- 如果前端 debug/mock 模式不足以复现问题，可改用本地完整构建，并按 `NODE_TYPE=slave` 连接现有数据库做联调；本地应通过已被 git 忽略且后端会自动读取的 `.env` 持久保存 `SESSION_SECRET`、`CRYPTO_SECRET`、`SQL_DSN` 等配置，避免每次重复提供，具体 secret 值不写入记忆库、文档或提交。
- 执行提交/推送前必须先核对 `git status` 与 diff 范围，避免带入无关改动、诊断临时文件或未确认文档。
- 本地临时诊断、截图、trace 和临时日志统一放在 git 忽略的 `.tmp/` 目录，不要散落在仓库根目录。
- 前端包管理原则上偏 Bun；当前开发机历史上主要使用 npm/npx，Dockerfile 构建阶段使用 `oven/bun:1`。
- 记忆文件默认用中文；代码、注释、命令、路径、API 名称保持英文。
