# uiweb 管理端与运营功能

## 总体边界

`uiweb` 管理端定位为轻量站点运营后台，不复刻官方完整管理设置页。

放在 `uiweb` 的内容：

- 公告管理
- 通知设置
- 空回补偿申诉审核
- 页面配置
- 游乐场菜品审核
- 调试 Key 记录
- AI 助手配置

不建议放在 `uiweb` 的内容：

- 大量渠道管理
- 模型全量配置
- 系统设置
- 复杂计费配置
- 需要频繁跟随官方后台变化的重管理功能

重管理优先走 `/legacy/` classic UI。

## 渠道高级设置

渠道编辑页支持思维链输出兼容选项：

- `thinking_to_content`：将上游 `reasoning_content` 转成正文中的 `<think>...</think>`，适合需要在客户端展示思考过程的场景。
- `strip_native_reasoning`：返回前移除 `reasoning_content` 和 `reasoning` 字段，适合 SillyTavern 等已有角色卡预设思维链的客户端，避免模型原生思维链与预设内容冲突。
- `strip_content_think_tags`：进一步移除正文 `content` 中的 `<think>...</think>` 内容块。该选项会影响角色卡主动要求输出的预设思维链，默认不要开启。
- `claude_assistant_prefill_compat`：仅 Anthropic / Claude 渠道使用；当上游不支持最后一条 `assistant` 作为 prefill 时，开启后服务端会追加一条用户继续消息，避免上游直接返回 400。

## 经典控制台保留能力

`/legacy/` classic UI 继续承担复杂计费与分组配置。

分组价格页相关配置：

- `GroupRatio`：分组倍率。
- `UserUsableGroups`：用户可见分组短描述，也用于令牌创建时的可选分组。
- `UserUsableGroupDetails`：价格页展示的分组详细介绍。

维护规则：

- `UserUsableGroups` 和 `UserUsableGroupDetails` 都保存在现有 `options` 表中，不新增迁移。
- 可视化分组表中的“说明/描述”对应短描述，“详细介绍”对应价格页长文案。
- 手动 JSON 模式也保留 `UserUsableGroupDetails` 输入区，适合批量粘贴或回滚配置。

支付配置：

- KPay 原生直连配置位于 `/legacy/` classic UI 的支付设置页 `KPay 设置` 标签。
- 必填项：`KPayEnabled=true`、`KPayApiBase`、`KPayApiKey`、`KPayApiSecret`。
- 默认 API 地址：`https://api.kpay.cc`。
- 回调地址：`<ServerAddress>/api/kpay/notify`，该域名需要在 KPay API Key 授权域名内完成校验；接口接收 JSON POST，请求到达后统一返回 HTTP 200，body 为 `ok` / `fail`。
- `KPaySelectStrategy` 默认 `lowest_fee`；`KPaySelectedMerchantId=0` 表示由 KPay 自动选商户。
- KPay 使用 `direct_qr` 模式，用户侧在 `uiweb` 与 classic 充值页展示二维码，不走外部收银台跳转。
- KPay 支付完成回跳地址为 `<ServerAddress>/topup?show_history=true`；旧 `/console/topup` 回跳也由 `uiweb` 兼容承接。
- 如果 KPay 与易支付同时配置，充值页优先展示 KPay 支付方式，不再把两套支付宝/微信入口同时展示给用户。
- `uiweb` 移动端发起 KPay 支付时，支付宝会优先直接打开支付链接；微信会展示二维码并提示用户保存二维码或截图后打开微信支付。

## 公告系统

页面：

- 用户历史公告：`/announcements`
- 管理公告：`/admin/announcements`

后端表：

- `ui_announcements`
- `ui_announcement_acks`

核心规则：

- 公告按 `announcement_id + version` 确认。
- 公告内容更新后递增 `version`，可重新触发确认。
- 强制公告进入 `AnnouncementProvider` 队列。
- 登录用户确认写服务端 ack；未登录或异常时可本地兜底。
- 公告可同步生成通知，相关字段包括 `notify_enabled`、`notify_level`、`require_ack`。

接口：

- `GET /api/ui/announcements`
- `GET /api/ui/announcements/active`
- `POST /api/ui/announcement_acks/:id`
- `GET/POST /api/ui/admin/announcements`
- `GET/PUT/PATCH/DELETE /api/ui/admin/announcements/:id`

## 通知中心

页面：

- 用户通知中心：`/notifications`
- 管理通知设置：`/admin/notifications`

后端表：

- `ui_notifications`
- `ui_notification_reads`
- `ui_notification_settings`

分类：

- `announcement`
- `billing`
- `appeal`
- `system`

目标范围：

- 全部用户
- 指定用户
- 指定分组
- 管理员

当前产品方向：

- 管理页主要用于“通知设置”，配置系统自动通知策略。
- 不默认把它做成大量手工通知列表。
- 充值到账通知和空回申诉状态通知已接入。
- 通知写入失败只记系统日志，不回滚充值或申诉主流程。

用户侧规则：

- 未读数进入头像红点。
- 需要确认的通知必须点击确认，不能被普通已读绕过。
- 公告确认会同步通知读/确认状态。

接口：

- `GET /api/ui/notifications`
- `GET /api/ui/notifications/unread-count`
- `POST /api/ui/notifications/read-all`
- `POST /api/ui/notifications/:id/read`
- `POST /api/ui/notifications/:id/ack`
- `GET/POST /api/ui/admin/notifications`
- `GET/PUT/PATCH/DELETE /api/ui/admin/notifications/:id`
- `GET /api/ui/admin/notifications/settings`
- `PUT /api/ui/admin/notifications/settings`

## 空回补偿申诉

页面：

- 用户入口：日志页 `/logs`
- 管理审核：`/admin/refund-appeals`

后端表：

- `ui_refund_appeals`
- `ui_refund_appeal_items`

定位：

- 疑似空回批量提交 + 管理员人工审核。
- 不做自动补偿，避免误判和额度漏洞。

候选条件：

- 消费日志。
- `quota > 0`。
- `completion_tokens = 0`。
- 在最近 48 小时窗口内。
- 晚于 `UI_REFUND_APPEAL_START_AT`。
- 日志未出现在 `ui_refund_appeal_items` 中。

限制：

- 每次最多处理 50 条。
- 查询扫描上限 200 条。
- `ui_refund_appeal_items.log_id` 唯一，防止重复补偿。

审核：

- 通过：事务内增加 `users.quota`，申诉和明细置为 `approved`，写 `LogTypeManage` 管理日志。
- 驳回：状态置为 `rejected`，不改余额。
- 支持管理员“一键通过所有待审核”。

接口：

- `GET /api/ui/refund-appeals/candidates`
- `GET /api/ui/refund-appeals/self`
- `POST /api/ui/refund-appeals`
- `GET /api/ui/admin/refund-appeals`
- `GET /api/ui/admin/refund-appeals/:id`
- `POST /api/ui/admin/refund-appeals/:id/approve`
- `POST /api/ui/admin/refund-appeals/:id/reject`
- `POST /api/ui/admin/refund-appeals/approve-all`

## 调试 Key 记录

页面：

- 令牌管理：`/tokens`
- 管理查看：`/admin/debug-traces`

后端表/字段：

- `tokens.debug_enabled`
- `debug_key_traces`

定位：

- 只给管理员使用，用于排查“只有一个错误提示，无法判断上游真实问题”的场景。
- 管理员在新建或编辑自己的 Key 时可开启“调试 Key”。
- 普通用户即使手工提交 `debug_enabled=true`，后端也会拒绝。

记录内容：

- 原始请求 method/path、脱敏 headers、截断后的 body。
- 实际上游请求 URL、脱敏 headers、截断后的 body。
- 下游返回 headers/body、HTTP status、上游 status。
- 错误类型、错误码、错误消息、模型、渠道、使用渠道链路、耗时。

安全边界：

- `Authorization`、`x-api-key`、`x-goog-api-key`、Cookie、token、secret 等敏感头会脱敏。
- JSON body 中明显的 `api_key`、`access_token`、`password`、`secret` 会脱敏。
- 图片、音频、文件和 base64 类大字段会被省略或截断。
- 单段 body 最多保留 256KB，避免调试记录无限膨胀。

接口：

- `GET /api/ui/admin/debug-traces`
- `GET /api/ui/admin/debug-traces/:id`
- `GET /api/ui/admin/debug-traces/:id/download`
- `DELETE /api/ui/admin/debug-traces/:id`

## Claude assistant prefill 兼容

页面：

- 渠道编辑页：Anthropic / Claude 渠道的高级设置。

字段：

- `settings.claude_assistant_prefill_compat`

语义：

- 默认关闭，仅对单个渠道生效。
- 开启后，如果转换后的 Claude 请求最后一条 message 是纯文本 `assistant`，服务端会在末尾追加一条极短的 `user` 继续消息，避免部分 Claude / Vertex Claude 上游返回 `This model does not support assistant message prefill. The conversation must end with a user message.`。
- 末尾 `assistant` 含 `tool_use` 时不会改写，避免破坏工具调用链路。
- 适合只在确认上游不支持 assistant prefill 的渠道上开启。

## 游乐场菜品审核

页面：

- 用户游乐场：`/playground/what-to-eat`
- 管理审核：`/admin/playground-foods`

后端表：

- `ui_playground_foods`

定位：

- 用户自己的“我的菜单”保存到服务器，作为当前用户私有候选，不需要管理员审核。
- 用户“投稿菜品”进入公共投稿池，管理员编辑名称、描述、分类和图片后批准，才会进入公共菜品池。

接口：

- `GET /api/ui/playground/foods`
- `POST /api/ui/playground/foods/private`
- `DELETE /api/ui/playground/foods/private/:id`
- `POST /api/ui/playground/foods/submissions`
- `GET /api/ui/admin/playground-foods`
- `GET/PUT/DELETE /api/ui/admin/playground-foods/:id`
- `POST /api/ui/admin/playground-foods/:id/approve`
- `POST /api/ui/admin/playground-foods/:id/reject`

规则：

- 私有菜单 `visibility=private`，只返回给提交用户。
- 公共投稿 `visibility=public`，初始 `status=pending`。
- 批准后写为 `status=approved`，用户随机池会自动读取。
- 图片单张限制 800KB，支持 jpeg/png/webp/gif。

## 页面配置

页面：`/admin/page-config`

后端存储：

- API 地址列表：`ui_page_configs.api_urls`
- 会员铭牌：`ui_page_config.membership_badges` option

API 地址配置：

- 最多 10 个。
- 至少启用 1 个。
- URL 仅支持 `http` / `https`。
- icon 支持 `globe`、`zap`、`link`。
- tone 支持 `pink`、`blue`、`green`、`yellow`。

默认地址：

- `https://newapi.youkies.space`
- `https://newapi.youkies.cn`

会员铭牌默认档位：

- `default`
- `standard`
- `pro`
- `super`
- `ultra`

接口：

- `GET /api/ui/page-config`
- `GET /api/ui/admin/page-config`
- `PUT /api/ui/admin/page-config`

## AI 助手管理

页面：`/admin/assistant`

后端表：

- `ui_assistant_configs`
- `ui_assistant_documents`
- `ui_assistant_sessions`
- `ui_assistant_conversations`
- `ui_assistant_conversation_messages`

配置项：

- 启用状态
- 助手名称
- 欢迎语
- 模型来源
- Base URL
- Token/API Key
- 模型名
- 系统提示词
- 截图开关
- 知识文档开关
- 会话摘要开关
- 每日免费次数
- 截图大小限制

模型来源：

- `site`：推荐。手动创建站内 `ai-assistant` 用户，给独立分组、额度和专用 Token。
- `external`：外部 OpenAI-compatible Base URL + API Key。
- `site_balance`：用户免费次数耗尽后确认使用余额续聊时的内部计费记录类型。

免费次数：

- 默认和上限均为 8 次/日。
- 免费次数由助手专用 Token/配置承担。
- 超出后返回 `assistant_free_limit_exceeded`，用户确认后可用余额续聊。

知识文档：

- 存储于 `ui_assistant_documents`。
- 按排序取启用文档片段拼入上下文。
- 不保存截图原图，只保存截图数量。
- 已有面向助手的会员知识文档：`docs/membership-assistant-knowledge.md`。

会话：

- `ui_assistant_sessions` 保存管理侧摘要和诊断结果。
- `ui_assistant_conversations` 与 `ui_assistant_conversation_messages` 保存用户侧完整历史。
- 历史标题由前端根据用户问题本地生成，不额外调用总结模型。

接口：

- 用户侧：`GET /api/ui/assistant/config`
- 用户侧：`GET /api/ui/assistant/models`
- 用户侧：`GET/POST/DELETE /api/ui/assistant/conversations`
- 用户侧：`GET /api/ui/assistant/conversations/:id/messages`
- 用户侧：`POST /api/ui/assistant/analyze`
- 用户侧：`POST /api/ui/assistant/chat`
- 管理侧：`GET/PUT /api/ui/admin/assistant/config`
- 管理侧：`GET/POST/PUT/DELETE /api/ui/admin/assistant/documents`
- 管理侧：`GET /api/ui/admin/assistant/sessions`

## 调试模式

启用：

- `VITE_UI_DEBUG_MODE=true`
- 或 Vite dev 环境 URL 加 `?debug=1`

能力：

- 自动注入管理员 mock 用户。
- mock `/api/status`、用户、令牌、日志、充值、公告、申诉、AI 助手、定价、模型状态等接口。
- AI 助手聊天走前端 mock 流，不调用真实 `/api/ui/assistant/chat`，不消耗 Token。
- 左下角 `UI DEBUG` 面板可快速跳转主要页面。

安全边界：

- 普通生产构建默认关闭。
- `localStorage` 开关只在 `import.meta.env.DEV` 下生效。
