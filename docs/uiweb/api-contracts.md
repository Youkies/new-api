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

## 充值

用户侧：

- `GET /api/user/topup/info`：返回充值配置。KPay 开启时包含 `enable_kpay_topup` 与 `kpay_pay_methods`。
- `GET /api/user/topup/self`：返回当前用户充值订单分页列表；`uiweb` 充值页会展示最近订单，并允许用户对 KPay 待确认订单手动查单。
- `POST /api/user/amount`：按当前充值数量估算实付金额，KPay 与易支付共用现有本币计价逻辑。
- `POST /api/user/kpay/pay`：创建 KPay `direct_qr` 充值订单，返回 `trade_no`、`provider_order_no`、二维码图片地址或 data URI、`direct_pay_url`、金额和过期时间。
- `POST /api/user/kpay/check`：用户侧检查本次 KPay 订单状态；如果传入 `provider_order_no` 或本地 `top_ups.provider_order_no` 已保存，且 KPay 已支付，会按本地 `trade_no` 补偿入账。
- KPay 下单传给平台的 `returnUrl` 指向主 UI `/topup?show_history=true`；`uiweb` 也兼容旧的 `/console/topup` 回跳，避免移动端支付后无法恢复查单。

回调：

- `POST /api/kpay/notify`：KPay 支付成功回调。服务端校验 `X-KPay-*` 签名头、body hash、时间窗口、订单号、金额和本地订单支付网关后入账。为兼容 KPay webhook 协议，接口已到达时统一返回 HTTP 200，body 用 `ok` / `fail` 表示业务处理结果，失败原因写入服务端日志。

语义：

- KPay 前端支付方式使用 `kpay_alipay` / `kpay_wechat`，服务端下单时映射为 KPay 的 `alipay` / `wechat`。
- 本地订单号是 `merchantOrderNo`，KPay 平台订单号保存到 `top_ups.provider_order_no`，只用于查单兜底，不作为本地入账主键。
- `uiweb` 会把待支付 KPay 订单短期保存在浏览器本地，支付 App 回跳或页面重新聚焦后自动调用 `/api/user/kpay/check`。
- 仍保留 `/api/user/pay` 易支付兼容链路，方便回滚或继续使用旧供应商。

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
