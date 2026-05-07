# uiweb API 契约

> 本文记录 `uiweb` 相关 API 的入口和语义。具体字段以 controller/model 为准，本文用于快速查找与排障。

## 公共基础接口

- `GET /api/status`：站点状态、配置信息、额度展示配置等。
- `GET /api/pricing`：定价数据。`data` 是模型数组，`vendors`、`group_ratio`、`usable_group`、`group_details` 与 `data` 同级；`usable_group` 是分组短描述，`group_details` 是价格页选中分组后展示的详细介绍。
- `GET /api/model-status?window=1h|6h|12h|24h`：模型可用性状态，公开访问。
- `GET /api/ui/page-config`：页面配置，包含 API 地址与会员铭牌配置。

## 公告

用户侧：

- `GET /api/ui/announcements`
- `GET /api/ui/announcements/active`
- `POST /api/ui/announcement_acks/:id`

管理侧：

- `GET /api/ui/admin/announcements`
- `POST /api/ui/admin/announcements`
- `GET /api/ui/admin/announcements/:id`
- `PUT /api/ui/admin/announcements/:id`
- `PATCH /api/ui/admin/announcements/:id`
- `DELETE /api/ui/admin/announcements/:id`

语义：

- active 接口返回当前有效且需要关注的公告。
- ack 按公告版本确认，公告版本变化后需要重新确认。
- 管理侧 `PATCH` 适合快速启停、置顶、强制弹窗等局部状态调整。

## 通知

用户侧：

- `GET /api/ui/notifications`
- `GET /api/ui/notifications/unread-count`
- `POST /api/ui/notifications/read-all`
- `POST /api/ui/notifications/:id/read`
- `POST /api/ui/notifications/:id/ack`

管理侧：

- `GET /api/ui/admin/notifications`
- `POST /api/ui/admin/notifications`
- `GET /api/ui/admin/notifications/settings`
- `PUT /api/ui/admin/notifications/settings`
- `GET /api/ui/admin/notifications/:id`
- `PUT /api/ui/admin/notifications/:id`
- `PATCH /api/ui/admin/notifications/:id`
- `DELETE /api/ui/admin/notifications/:id`

语义：

- `read` 只做已读。
- `ack` 用于需要确认的通知。
- `read-all` 不会绕过需要确认的通知。
- 系统自动通知策略由 settings 控制。

## 空回补偿申诉

用户侧：

- `GET /api/ui/refund-appeals/candidates`
- `GET /api/ui/refund-appeals/self`
- `POST /api/ui/refund-appeals`

管理侧：

- `GET /api/ui/admin/refund-appeals`
- `GET /api/ui/admin/refund-appeals/:id`
- `POST /api/ui/admin/refund-appeals/:id/approve`
- `POST /api/ui/admin/refund-appeals/:id/reject`
- `POST /api/ui/admin/refund-appeals/approve-all`

语义：

- candidates 只返回当前窗口内可提交的疑似空回。
- 创建申诉后进入人工审核。
- approve 会补余额并写管理日志。
- reject 不改余额。

## AI 助手

用户侧：

- `GET /api/ui/assistant/config`
- `GET /api/ui/assistant/models`
- `GET /api/ui/assistant/conversations`
- `POST /api/ui/assistant/conversations`
- `GET /api/ui/assistant/conversations/:id/messages`
- `DELETE /api/ui/assistant/conversations/:id`
- `POST /api/ui/assistant/analyze`
- `POST /api/ui/assistant/chat`

管理侧：

- `GET /api/ui/admin/assistant/config`
- `PUT /api/ui/admin/assistant/config`
- `GET /api/ui/admin/assistant/documents`
- `POST /api/ui/admin/assistant/documents`
- `PUT /api/ui/admin/assistant/documents/:id`
- `DELETE /api/ui/admin/assistant/documents/:id`
- `GET /api/ui/admin/assistant/sessions`

语义：

- `chat` 是流式接口。
- 免费次数耗尽时返回 `assistant_free_limit_exceeded`。
- 余额续聊请求需要提交 `group` 与 `model_name`。
- 成功流式回复后，响应 header 可带 `X-Assistant-Conversation-Id`。

## 定价

用户侧：

- `GET /api/pricing`

响应语义：

- `data`：模型价格数组。
- `vendors`：模型供应商列表，主要用于图标和供应商信息展示；当前 `uiweb` 价格页不再提供供应商下拉筛选。
- `group_ratio`：分组到倍率的映射。
- `usable_group`：当前用户可使用分组的短描述，来自 `UserUsableGroups`。
- `group_details`：当前用户可使用分组的详细介绍，来自 `UserUsableGroupDetails`。

分组展示规则：

- `usable_group` 只暴露当前用户可见分组。
- `group_details` 会按 `usable_group` 过滤，避免把不可见分组的详细介绍暴露给用户。
- 没有详细介绍时前端允许为空，并使用默认提示兜底。

## 页面配置

用户侧：

- `GET /api/ui/page-config`

管理侧：

- `GET /api/ui/admin/page-config`
- `PUT /api/ui/admin/page-config`

语义：

- API 地址列表用于 `/api-urls` 页面。
- 会员铭牌配置用于用户侧会员身份展示。
- `ui_page_configs` 缺表时用户侧读取应回退默认值；保存配置需要先完成迁移。

## 头像

用户侧：

- `POST /api/user/avatar`
- `DELETE /api/user/avatar`
- `GET /api/user/avatar/:id`

语义：

- 上传和删除需要登录。
- 获取头像公开。
- 上传大小上限 200KB。
- 返回头像建议带 `?t=` cache-bust。

## 签到

用户侧：

- `GET /api/user/checkin`
- `POST /api/user/checkin`

语义：

- 日期按服务端签到时区计算，默认 `Asia/Shanghai`。
- 响应含 `server_now` 与 `next_checkin_at`，前端用于校正倒计时。
- 分组奖励范围由 `checkin_setting.group_quotas` 覆盖。

## 诊断接口

长流诊断：

- `GET /api/debug/long-stream?seconds=900&interval=5`

要求：

- `STREAM_DIAG_ENABLED=true`
- 请求 query `token` 或 header `X-Stream-Diag-Token` 匹配 `STREAM_DIAG_TOKEN`

用途：

- 不调用上游模型，只验证入口层、域名、反代、客户端是否会切断 SSE。
- 2026-05-08 对 `newapi-clay.youkies.space` 复测 900s，`elapsed=595/600/605` 均正常，最终 `TOTAL=901.670609`，未复现固定 600s 断开。
- `newapi.youkies.cn` 当前未暴露该诊断口，返回 404，需要单独配置国内链路诊断。
