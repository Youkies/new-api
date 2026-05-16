# 当前任务

## 当前可接手状态：Claude assistant prefill 渠道兼容开关（2026-05-16）

### 已完成

- 针对用户下载的调试日志定位到上游 400：`This model does not support assistant message prefill. The conversation must end with a user message.`，根因是 OpenAI 请求转换到 Claude 后最后一条 message 为 `assistant` prefill。
- 已用用户提供的真实渠道做验证：原始末尾 `assistant` 请求返回 400；追加一条 `user` continuation 消息后，同一模型非流式返回 200，流式也能正常开始输出。
- 新增渠道级开关 `settings.claude_assistant_prefill_compat`，默认关闭，新 UI 的 Anthropic / Claude 渠道表单和 classic `/legacy/` Claude 渠道编辑页均可配置。
- 开启后，OpenAI->Claude、Claude-native adaptor、Vertex Claude adaptor 都会在转换后的 Claude 请求末尾为纯文本 `assistant` prefill 追加一条短 `user` 继续消息。
- 末尾 `assistant` 含 `tool_use` 时不会改写，避免破坏工具调用链路。
- 已更新新 UI 渠道表单、classic `/legacy/` 渠道编辑页、类型定义、i18n 文案和 `docs/uiweb/admin.md`。

### 验证结果

- 真实渠道验证：末尾 `assistant` 原样请求为 400；追加 `user` continuation 后为 200。
- `go test ./relay/channel/claude ./relay/channel/vertex ./relay/channel/aws -run "AssistantPrefill|RequestOpenAI2ClaudeMessage|ConvertClaude" -count=1` 通过。
- `go test ./... -count=1` 通过。
- `npm run i18n:sync` 于 `web/default/` 通过；只保留既有未翻译计数。
- `npm run build` 于 `web/default/` 通过。
- `git diff --check` 通过。

### 下一步

- 若决定上线，先只提交本次相关文件；不要误加入未跟踪的问卷 xlsx、`cpa2/`、`kpay-epay-api/`、`log目录/`。
- 上线后只给确认存在 assistant prefill 400 的 Claude 类渠道打开该开关，不建议全局默认开启。

## 当前可接手状态：管理员调试 Key 记录（2026-05-16）

### 已完成

- 管理员在令牌管理 `/tokens` 新建或编辑自己的 Key 时，可以开启“调试 Key”；普通用户手工提交 `debug_enabled=true` 会被后端拒绝。
- 后端新增 `tokens.debug_enabled` 和 `debug_key_traces`，relay 仅在“管理员所属且已开启调试”的 Key 请求中写入调试记录。
- 调试记录会捕获原始请求、实际上游请求、下游返回、错误类型/错误码/错误消息、模型、分组、渠道、使用渠道链路、耗时和管理员排障信息。
- headers 与 JSON body 中明显的 token、secret、Authorization、API Key、Cookie、密码等字段会脱敏；图片/音频/文件/base64 类大字段会省略或截断；单段 body 最多保存 256KB。
- 后台新增 `/admin/debug-traces`，支持筛选、查看详情、删除记录。
- 调试记录详情和列表均支持直接下载 `.log` 文件，接口为 `GET /api/ui/admin/debug-traces/:id/download`。
- 已更新 `docs/uiweb/features.md`、`docs/uiweb/api-contracts.md`、`docs/uiweb/admin.md`、`docs/uiweb/database-and-migrations.md`。

### 验证结果

- `go test ./model ./controller ./middleware ./service ./relay/channel -run "TestToken|Debug|KPay|PaymentMethod" -count=1` 通过。
- `go test ./... -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过；仅有既有大 chunk 警告。
- `git diff --check` 通过。

### 下一步

- 生产 `NODE_TYPE=slave` 不会自动迁移；上线前需要给主库补 `tokens.debug_enabled`，并按是否配置 `LOG_SQL_DSN` 在日志库或主库创建 `debug_key_traces`，SQL 见 `docs/uiweb/database-and-migrations.md`。
- 提交前注意当前工作区仍有无关未跟踪文件：问卷 xlsx、`cpa2/`、`kpay-epay-api/`，不要误加入本次提交。

## 当前可接手状态：uiweb 游乐场与今天吃什么（2026-05-16）

### 已完成

- 用户头像下拉菜单中的“游乐场”已从 classic `/legacy/playground` 外链改为 `uiweb` 原生 `/playground`。
- 新增 `uiweb/src/pages/Playground.jsx`，第一版内置“今天吃什么呀”随机工具。
- `/playground` 已调整为独立小游戏列表页，当前展示 1 个已上线小游戏和 2 个待加入占位卡片；“今天吃什么呀”打开到独立页面 `/playground/what-to-eat`，便于移动端浏览和后续继续接小游戏。
- 支持分类筛选、开吃/再来一次、清空今日记录、我的菜单添加/删除、投稿菜品审核入池。
- 菜单候选由内置默认菜单、问卷收集的社区菜谱、服务端公共菜品池、用户自己的服务端私有菜单组成；今日记录仍使用浏览器 `localStorage`。
- 新增后端表 `ui_playground_foods`，`visibility=private` 用于用户自己的菜单，`visibility=public` 用于公共投稿/公共菜品池；公共投稿 `pending` 后由管理员审核为 `approved`。
- 新增用户接口：`GET /api/ui/playground/foods`、`POST /api/ui/playground/foods/private`、`DELETE /api/ui/playground/foods/private/:id`、`POST /api/ui/playground/foods/submissions`、`GET /api/ui/playground/foods/:id/image`。
- 新增管理接口和页面 `/admin/playground-foods`，管理员可筛选待审核/已入池/已驳回菜品，编辑名称、描述、分类、图片后批准入池或驳回/删除。
- `/playground/what-to-eat` 移动端已压缩：使用 `ClayConsoleShell` 紧凑标题，分类横向滑动，抽奖卡手机端只保留“开吃”主按钮，清空/自定义/投稿入口移到“今日记录”和“我的菜单”卡片。
- 手机内网调试入口已兜底：dev 登录页显示“进入调试模式”，可为当前 LAN origin 写入 debug localStorage 并跳回原页面；受保护路由跳登录时会保留 `?debug=1`。
- `/console/playground` 与 `/console/playground/:gameId` 兼容同一套页面。
- 已更新 `docs/uiweb/features.md`、`docs/uiweb/api-contracts.md`、`docs/uiweb/admin.md`、`docs/uiweb/database-and-migrations.md`。

### 验证结果

- `go test ./model ./controller -run "UIPlaygroundFood|KPay|RechargeKPay" -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过；仅有既有大 chunk 警告。
- `git diff --check` 通过。
- 本地 Vite 已启动在 `0.0.0.0:5178`，`/playground?debug=1` 返回 200。
- Playwright 验证通过：手机视口下 `/playground` 只显示小游戏列表，点击“今天吃什么呀”进入 `/playground/what-to-eat`，详情页有返回按钮；用户侧可打开“我的菜单”并保存服务器私有菜单，侧栏显示“已同步服务器”；可打开“投稿菜品”表单；管理侧 `/admin/playground-foods?debug=1` 可看到待审核投稿，打开审核弹窗并保存编辑。
- 2026-05-16 移动端压缩后复测 `/playground/what-to-eat?debug=1`，手机视口下分类不再多行堆叠，抽奖框只显示“开吃”，控制台无错误。
- 2026-05-16 复测未登录直接打开 `/playground/what-to-eat` 会进入登录页，登录页展示“进入调试模式”，点击后回到原页面并出现 `UI DEBUG` 面板。
- Playwright 手机视口 `390x844` 快速检查未见明显文字挤压。
- 2026-05-16 从 `000_快来丰富一下Youkies的菜谱_提交统计.xlsx` 提取问卷菜名，去重和基础规范化后新增 200 个社区菜单候选，其中包含用户临时追加的 `滨寿司`；`uiweb npm run build` 与 `git diff --check` 通过。
- 2026-05-16 发布前复查通过：`go test ./model ./controller -run "UIPlaygroundFood|KPay|RechargeKPay|PaymentMethod" -count=1`、`uiweb npm run build`、`web/classic npm run build` 通过；用 `.tmp/docker-context-release` 干净上下文排除 xlsx、`cpa2/`、`kpay-epay-api/` 后构建并推送 GHCR 镜像 `ghcr.io/youkies/new-api:latest` 与 `:release-20260516-2040`，digest `sha256:a10b71192f0f08bcfb74ea69b749ae5eed66e0e221cd111d0da19278241c559d`，平台 `linux/amd64`。

### 下一步

- 如需发布，先核对当前工作区已有的 KPay/classic/记忆文件等无关改动，避免和这次 `uiweb` 游乐场改动一起误提交。
- 生产 `NODE_TYPE=slave` 不会自动迁移；上线前需确认/创建 `ui_playground_foods` 表，字段清单见 `docs/uiweb/database-and-migrations.md`。

## 测试环境约定：云悠美国测试机（2026-05-13）

### 当前状态

- 使用服务器迁移前的云悠美国机器作为测试机。
- 测试域名：`newapi-test.youkies.space`。
- 测试机连接旧数据库，用于和正式站隔离验证。
- push 后由云悠服务器自动构建。
- 测试机运行 `NODE_TYPE=master`，不是东京 API-only 节点的 `slave` 模式。

### 注意事项

- 云悠美国测试机是上线前验证环境，不等同于正式站 Zeabur/GHCR 发布链路。
- 不要把旧数据库连接信息、服务器登录信息或环境变量 secret 写入 docs、memory、提交或回复。

## 当前可接手状态：KPay 原生二维码充值接入（2026-05-13）

### 已完成

- 后端新增 KPay 原生 API 充值链路：
  - 用户下单：`POST /api/user/kpay/pay`。
  - 用户查单兜底：`POST /api/user/kpay/check`。
  - 服务端回调：`POST /api/kpay/notify`。
- KPay 下单使用 `direct_qr` 模式，前端支付方式为 `kpay_alipay` / `kpay_wechat`，服务端映射为 KPay 的 `alipay` / `wechat`。
- 用户侧展示名不再带 `KPay` 前缀，只显示“支付宝 / 微信支付”；如果 KPay 与易支付同时配置，充值页优先展示 KPay，不再同时显示两套支付宝/微信入口。
- `uiweb` 移动端发起 KPay 支付时，支付宝优先直接跳转 `direct_pay_url`；微信保留二维码弹窗并提示保存二维码或截图后打开微信支付。
- `uiweb` 与 classic 的 KPay 二维码弹窗底部不再展示“打开支付 / 检查到账”按钮，到账仍靠 5 秒轮询查单。
- KPay 平台 `returnUrl` 已改为主 UI 的 `<ServerAddress>/topup?show_history=true`，并在 `uiweb` 兼容旧 `/console/topup` 回跳。
- `uiweb` 会把待支付 KPay 订单短期保存在浏览器本地，支付 App 回跳、页面重新聚焦或用户关闭浏览器进程后再次进入充值页时，会自动恢复扫码弹窗并立即调用 `/api/user/kpay/check` 查单一次，随后继续 5 秒轮询；成功到账后清理本地记录。
- `uiweb` 充值页下方新增最近充值订单历史，用户可刷新列表；对 KPay 待支付/待到账订单展示“检查到账”按钮，手动调用 `/api/user/kpay/check` 补偿查单并刷新余额。
- `uiweb` 订单列表加载后会对可见 KPay `pending` 订单静默查单一次；如果 KPay 返回已过期/失败/已支付，会刷新本地订单状态，避免过期订单长期显示“待支付/待到账”。
- 早期没有保存 `provider_order_no` 的 KPay 待支付单无法按 KPay 文档查单；用户触发查单时，超过 15 分钟的无平台订单号 KPay `pending` 单会按本地兜底标为 `expired`。若之后收到已支付回调或查到已支付，`RechargeKPay` 仍允许从 `failed` / `expired` 转为 `success`。
- KPay 查单会把 KPay 顶层订单状态或 `channels[].status` / `channels[].providerStatus` 明确返回的已支付映射为 `success` 并补偿入账；明确失败、取消或过期会同步本地订单为 `failed` / `expired`，不再继续停留在“待确认”语义。KPay 返回仍可继续支付/等待到账，或查单失败/无平台单号时，才保持 `pending`。
- 本地订单仍写入 `top_ups`，新增 `payment_provider=kpay`；KPay 平台订单号保存到 `top_ups.provider_order_no`，只作为查单参数，不作为本地入账主键。
- 2026-05-14 修复 KPay 并发查单/回调重复入账风险：`RechargeKPay` 改为数据库条件更新，只有把本地订单从 `pending` / `failed` / `expired` 原子切到 `success` 的请求才会增加用户额度、写充值日志和发到账通知；同一订单后续重复成功只幂等返回。
- 事故用户补充的高可信复现路径：支付后从支付 App/跳转页返回，刷新退出后的跳转页面多次，随后同一笔 4 元订单显示重复到账；这与用户侧 `/api/user/kpay/check` 查单补偿并发/重复触发、旧版 `RechargeKPay` 非原子幂等的判断一致，不是验签失败 webhook 直接入账。
- 回调入账已做：
  - `X-KPay-*` 签名头、body hash、时间窗口校验。
  - `merchantOrderNo`、本地订单支付网关、订单状态、金额校验。
  - 成功状态幂等处理，避免回调重试或手动查单重复加余额。
  - 按 KPay webhook 协议，请求到达 `/api/kpay/notify` 后统一 HTTP 200 返回，body 用 `ok` / `fail` 区分业务处理结果；验签失败、未启用或解析失败会记录日志但不再返回 400/403。
- `uiweb` 充值页已支持站内展示 KPay 二维码、5 秒轮询查单、移动端支付回跳后恢复查单，旧易支付兼容链路仍保留。
- classic 充值页已支持 `enable_kpay_topup`、`kpay_alipay` / `kpay_wechat`、站内二维码弹窗和 5 秒轮询查单；不会再把 KPay 误判为未开启易支付。
- classic `/legacy/` 充值页已补齐 KPay 待支付订单本地保存与恢复：支付 App 回来、页面重新聚焦或重新进入充值页时会自动恢复订单并查单；充值账单会对用户自己的 KPay `pending` 单静默查单，并提供“检查到账”补偿按钮。
- classic `/legacy/` 支付设置新增 `KPay 设置` 标签，可配置 `KPayEnabled`、`KPayApiBase`、`KPayApiKey`、`KPayApiSecret`、`KPaySelectStrategy`、`KPaySelectedMerchantId`。
- KPay 创建平台订单失败日志已增强：会记录平台 `code/msg`、`notify_url`、`return_url`、选商户策略和指定商户 ID，便于区分授权域名、支付方式、商户通道或金额限制问题。
- 已更新 `docs/uiweb/features.md`、`docs/uiweb/api-contracts.md`、`docs/uiweb/admin.md`。

### 验证结果

- `go test ./... -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过；仅有既有大 chunk 警告。
- `npm run build` 于 `web/classic/` 通过；仅有既有大 chunk / circular chunk 警告。
- `git diff --check` 通过。
- 2026-05-13 针对 KPay 到账补偿修复，`go test ./controller -count=1`、`npm run build` 于 `uiweb/`、`git diff --check` 均通过。
- 2026-05-13 针对 KPay 到账补偿修复，`go test ./... -count=1` 未全量通过；失败点是既有 `relay/helper` 测试 `TestStreamScannerHandler_SkipsNonDataLines` 因 `time.NewTicker` 收到 0 间隔 panic，和本次 KPay 改动无关。
- `uiweb` Vite 已启动在 `0.0.0.0:5178`，`http://localhost:5178/console/topup` 返回 200。
- 2026-05-13 已从干净临时 worktree `1927d4ae` 构建并推送 GHCR：`ghcr.io/youkies/new-api:latest` 与 `ghcr.io/youkies/new-api:1927d4ae`，digest 均为 `sha256:05f563517cbf7b0e5554207dc294c23db7d09b962a7032040cfcdb099bc6cd63`，平台为 `linux/amd64`。
- 2026-05-14 针对 KPay 重复到账修复，从临时干净 Docker context 构建并推送 GHCR：`ghcr.io/youkies/new-api:latest` 与 `ghcr.io/youkies/new-api:kpay-idempotent-20260514-0104`，digest 均为 `sha256:e15991833ca54c8ae59620dffb47dbad43120cf3e835841ad9386058396056ce`，平台为 `linux/amd64`。
- 2026-05-13 针对用户自助查单订单历史和关闭浏览器后恢复弹窗立即查单，`npm run build` 于 `uiweb/` 通过，`git diff --check` 通过。
- 2026-05-13 针对 KPay 失败/取消/过期状态映射，`go test ./controller -run KPay -count=1`、`npm run build` 于 `uiweb/`、`git diff --check` 均通过。
- 2026-05-13 对照 KPay 在线文档补齐 `channels[].status` / `channels[].providerStatus` 查单映射，`go test ./controller -run KPay -count=1`、`npm run build` 于 `uiweb/` 均通过。
- 2026-05-13 针对过期订单仍显示待到账，`uiweb` 订单列表新增可见 KPay 待支付订单静默查单刷新。
- 2026-05-13 针对无 `provider_order_no` 的旧 KPay 订单，新增 15 分钟本地过期兜底，并允许 KPay 已支付回调覆盖本地 `failed` / `expired` 状态。
- 2026-05-14 针对 KPay 重复到账事故，`go test ./model -run "TestRechargeKPay|TestUpdatePendingTopUpStatus" -count=1`、`go test ./controller -run KPay -count=1`、`git diff --check` 均通过。
- 2026-05-16 针对 classic `/legacy/` KPay 回跳兜底，`npm run build` 于 `web/classic/` 通过；`git diff --check -- web/classic/src/components/topup/index.jsx web/classic/src/components/topup/modals/TopupHistoryModal.jsx` 通过。

### 下一步

- 生产先核对并修正用户 `230` 的订单 `KPAYUSR230NOf96dtz1778691302`：确认 `top_ups`、`logs`、`ui_notifications` 是否出现两条到账记录，按实际多加额度扣回一次后再发布修复。
- 上线前在 `/legacy/` 填 KPay 配置，并确认 KPay API Key 授权域名包含 `<ServerAddress>` / 回调域名。
- KPay 回调地址为 `<ServerAddress>/api/kpay/notify`。
- 测试环境要确认 `ServerAddress` 或 `CustomCallbackAddress` 指向 `https://newapi-test.youkies.space`，并在 KPay API Key 授权域名中放行该域名；否则平台下单或回调可能失败。
- 线上测试曾出现 KPay 下单 `code=7`、`msg=创建订单失败，请稍后再试`；结合 `kpay-epay-api` 本地文档，优先排查 API Key 调用 IP 白名单、`notifyUrl` / `returnUrl` 授权域名归属/合规，以及 `KPaySelectedMerchantId` 是否误填非绑定/非自有商户。已验证测试环境日志实际发出 `selected_merchant_id=45`，下一步应先在 `/legacy/` KPay 设置把“指定商户 ID”改为 `0`，让 KPay 自动选商户后再测。
- 首次生产联调时重点看 KPay webhook 日志；KPay 文档示例列出了签名头但未给出明确待签字符串，当前实现按常见 header/body-hash 组合兼容校验。上游要求 webhook 必须 5 秒内返回 2xx，当前实现同步做验签和入账，一般只包含 DB 事务，若生产 DB 慢需重点观察。
- 如需发布，先核对 `git status`，避免带入当前工作区已有的 `.ai_memory`、`.gitignore`、`cpa2/` 等无关改动。

### 注意事项

- 不要把 `KPayApiKey` / `KPayApiSecret` 写进文档、记忆、提交或回复。
- `KPayEnabled=true` 但密钥或 API 地址为空时，不会向用户展示 KPay 充值入口。
- 本实现目标是减少用户侧外部收银台跳转失败；实际扫码支付仍依赖 KPay 平台生成二维码和回调通知。

## 当前可接手状态：东京 API-only 节点（2026-05-10）

### 已完成

- 已在东京国际线路服务器部署 `newapi-jp.youkies.space` API-only 节点。
- 远程目录：`/opt/newapi-jp`。
- 镜像：`ghcr.io/youkies/new-api:latest`。
- 容器：`newapi-jp`，`NODE_TYPE=slave`，`NODE_NAME=newapi-jp-api`。
- Nginx 策略：
  - `/v1` 与 `/v1/*` 反代到 `127.0.0.1:3000`。
  - `/api/status` 用于健康检查。
  - 根路径和其他路径返回 404，不承接网页、登录、充值或后台。
- 已签发 Let's Encrypt 证书，当前有效期至 2026-08-08。
- 已给低配服务器新增 1G swap，并设置较保守的 SQL/relay 连接池与 Go 内存参数。
- 本地私有部署记录已整理在 git 忽略目录：`.local/deployments/newapi-jp/`。

### 验证结果

- `https://newapi-jp.youkies.space/api/status` 返回 200，证书校验通过。
- `https://newapi-jp.youkies.space/` 返回 404，符合 API-only 预期。
- `https://newapi-jp.youkies.space/v1/models` 未带 token 返回 401，说明请求进入 relay 鉴权层。
- 容器健康状态为 `healthy`，初始内存占用约 21MiB。

### 下一步

- 后续升级东京节点：SSH 到服务器后执行 `cd /opt/newapi-jp && docker compose pull && docker compose up -d`。
- 如主站 `SESSION_SECRET`、`CRYPTO_SECRET`、`SQL_DSN` 或其他生产环境变量变化，需要同步更新远程 `/opt/newapi-jp/.env` 和本地 `.local/deployments/newapi-jp/`。
- 若需要 Redis 能力，再补 `REDIS_CONN_STRING`；当前东京节点日志显示未启用 Redis。

### 注意事项

- 不要把 `.local/deployments/newapi-jp/` 里的真实凭据写入 docs、memory、提交或回复。
- 东京节点只优化 API 调用；用户主站、充值、管理、OAuth 和支付仍走 `newapi.youkies.space`。
- `NODE_TYPE=slave` 不会自动迁移数据库，上线新表/新列仍以主库手动迁移清单为准。

## 搁置功能：Youkies 必吃榜第一版（2026-05-13）

### 当前状态

- 必吃榜已从 `main` 撤回，撤回提交：`7ac0b9a9 Revert "新增 Youkies 必吃榜评价积分体系"`。
- 必吃榜代码已保留在分支：`feature/youkies-must-eat-shelved`。
- 当前主线不包含 `/must-eat`、`/admin/model-reviews`、`ui_model_review_*` 后端模型/API/页面文件。
- 不要在当前生产库执行必吃榜相关建表 SQL，除非后续明确恢复该功能。

### 原第一版内容

原第一版已完成内容如下，仅作恢复分支时的参考：

- 新增用户侧 `Youkies 必吃榜` 页面：
  - 路由：`/must-eat`
  - 文件：`uiweb/src/pages/ModelReviews.jsx`
  - 顶部导航和控制台导航均已加入入口。
- 新增模型评价能力：
  - 用户对某模型有至少一次成功消费日志后即可评价。
  - 同一用户同一模型只保留一条评价，可修改。
  - 支持五星、场景、标签、优点、不足、一句话评价。
  - 支持匿名评价。
  - 支持隐藏真实使用次数；不隐藏时显示“已使用 N 次”，隐藏时显示“已验证使用”。
  - 其他用户可点“有帮助”。
- 新增食评积分体系：
  - 首次有效评价奖励。
  - 高质量评价补差额奖励。
  - 有帮助追加奖励。
  - 管理员精选奖励。
  - 每日/每周积分封顶。
  - 食评积分可兑换用户余额额度。
- 新增后台管理页：
  - 路由：`/admin/model-reviews`
  - 文件：`uiweb/src/pages/admin/AdminModelReviews.jsx`
  - 可配置开关、先审后显、兑换比例、最低起兑、各类奖励、每日封顶、每周封顶、开榜倍率。
  - 可隐藏/公开评价，可精选评价。
- 新增后端模型/API：
  - `model/ui_model_review.go`
  - `controller/ui_model_review.go`
  - 路由挂载在 `/api/ui/model-reviews*` 与 `/api/ui/admin/model-reviews*`。
  - 新表加入 `migrateDB()` 与 `migrateDBFast()`。
- 已更新调试模式 mock：
  - `uiweb/src/utils/debugMode.js`
  - `?debug=1` 下可查看必吃榜、提交评价、后台调整设置。
- 已更新文档：
  - `docs/uiweb/features.md`
  - `docs/uiweb/admin.md`
  - `docs/uiweb/api-contracts.md`
  - `docs/uiweb/database-and-migrations.md`

### 默认奖励参数

- `1000` 食评积分兑换 `¥1` 等值额度。
- 首次有效评价：`500` 积分。
- 高质量评价最高：`1500` 积分。
- 有帮助：`20` 积分/次。
- 单条评价有帮助奖励上限：`500` 积分。
- 管理员精选：`3000` 积分。
- 每日封顶：`3000` 积分。
- 每周封顶：`10000` 积分。
- 开榜倍率：默认 `100%`，后台可调高到开榜期倍率。

### 验证结果

- `go test ./model ./controller ./router -count=1` 通过。
- `go test ./... -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过；仍有既有大 chunk 警告。
- `git diff --check` 通过。

### 若后续恢复

- 从 `feature/youkies-must-eat-shelved` 分支恢复或 cherry-pick。
- 恢复后再确认是否执行 `ui_model_review_*` 建表 SQL。
- 如要开榜期奖励更大，优先在 `/admin/model-reviews` 调整 `开榜倍率` 或单项积分，不需要改代码。

### 注意事项

- 积分奖励不按五星正负倾向发放，只按评价是否有效、内容质量、被点有帮助和管理员精选发放。
- 匿名只影响前台展示，后台仍能看到真实用户，便于风控和撤下评价。
- 兑换额度时会增加 `users.quota` 并写积分流水和系统日志。
