# uiweb 数据库与迁移

## 总原则

Zeabur 同一个项目内同时部署数据库服务和应用服务，数据库为 Zeabur MySQL，数据库名 `zeabur`。正式网站使用本地打包并推送到 GHCR 的 Docker 镜像；调试/验证部署使用 `NODE_TYPE=slave` 并随 GitHub push 自动构建。

`NODE_TYPE=slave` 会跳过 AutoMigrate；正式站也不能依赖自动迁移。所有新增表和字段上线前都需要按清单手动确认或迁移。

开发原则：

- 后端模型仍要加入 AutoMigrate，方便本地和非 slave 环境。
- 生产迁移要兼容 MySQL；项目代码还需兼容 SQLite 和 PostgreSQL。
- SQL 执行器可能不支持多语句，必要时逐条执行。
- 不把生产密码、token、`.env` 值写进文档或记忆库。

## 新增/扩展表总览

uiweb 相关表：

- `ui_announcements`
- `ui_announcement_acks`
- `ui_notifications`
- `ui_notification_reads`
- `ui_notification_settings`
- `ui_refund_appeals`
- `ui_refund_appeal_items`
- `ui_page_configs`
- `ui_playground_foods`
- `ui_assistant_configs`
- `ui_assistant_documents`
- `ui_assistant_sessions`
- `ui_assistant_conversations`
- `ui_assistant_conversation_messages`

用户表扩展：

- `users.avatar`
- `users.avatar_type`
- `users.created_at`
- `users.last_login_at`

官方 rc.4 新增：

- `perf_metrics`

配置项：

- `checkin_setting.group_quotas`
- `ui_page_config.membership_badges`
- `UserUsableGroupDetails`

## 公告表

`ui_announcements`：

- 标题、摘要、正文、正文格式。
- 类型、作用范围。
- `notify_enabled`、`notify_level`、`require_ack`。
- `force_popup`、`pinned`、`enabled`。
- `version`、`priority`、`starts_at`、`ends_at`。
- 创建/更新人、创建/更新时间、软删除时间。

`ui_announcement_acks`：

- `announcement_id`
- `announcement_version`
- `user_id`
- `dont_show_again`
- `acknowledged_at`

唯一约束：

- `announcement_id + announcement_version + user_id`

## 通知表

`ui_notifications`：

- 标题、摘要、正文、正文格式。
- 分类：`announcement`、`billing`、`appeal`、`system`。
- 级别：`info`、`success`、`warning`、`error`。
- 来源：公告、充值、兑换码、申诉、手动。
- 目标：全部、指定用户、指定分组、管理员。
- `popup`、`require_ack`、`pinned`、`enabled`。
- 生效时间、失效时间、优先级。

`ui_notification_reads`：

- `notification_id`
- `user_id`
- `read_at`
- `acknowledged_at`

唯一约束：

- `notification_id + user_id`

`ui_notification_settings`：

- 充值通知开关。
- 充值通知是否要求确认。
- 申诉提交、通过、驳回通知开关。
- 申诉通知是否要求确认。

缺表行为：

- 读取通知设置时返回默认值。
- 保存设置时需要表存在，否则提示先迁移。

## 空回申诉表

`ui_refund_appeals`：

- 用户、用户名。
- 状态：`pending`、`approved`、`rejected`。
- 总条数、补偿额度。
- 扫描窗口。
- 用户说明、审核备注。
- 审核人、审核时间。

`ui_refund_appeal_items`：

- 申诉批次 ID。
- 用户 ID。
- 日志 ID。
- 状态。
- 日志创建时间。
- 模型、令牌、Request ID、渠道、分组。
- 扣费、输入/输出 tokens、耗时、是否流式、内容快照。

唯一约束：

- `log_id`

环境变量：

- `UI_REFUND_APPEAL_START_AT`：排除上线前已经人工处理过的历史记录。支持 Unix timestamp、RFC3339、`YYYY-MM-DD HH:mm:ss`、`YYYY-MM-DD HH:mm`、`YYYY-MM-DD`。

## 页面配置表与 option

`ui_page_configs`：

- 固定 `id=1`。
- `api_urls` 存 JSON 字符串。

用户侧读取：

- 表不存在时回退默认 API 地址。

管理侧保存：

- 表必须存在。

`ui_page_config.membership_badges`：

- 保存在 options 中，不新增独立表。
- 用于覆盖普通、Standard、Pro、Super、Ultra 的会员铭牌文案。

`UserUsableGroupDetails`：

- 保存在 `options` 表中，不新增独立表或字段。
- 键为分组名称，值为价格页展示的分组详细介绍。
- 与既有 `UserUsableGroups` 分离：`UserUsableGroups` 保存短描述，`UserUsableGroupDetails` 保存长介绍。
- `/api/pricing` 返回时只暴露当前用户可见分组对应的详细介绍。
- 生产环境不需要手动建表或加列；如需上线前预置内容，只需向现有 `options` 表写入 key 为 `UserUsableGroupDetails` 的 JSON 值，或在 `/legacy/` 经典控制台保存分组设置自动生成。

## 游乐场菜品表

`ui_playground_foods`：

- 菜品名称、描述、分类、图标。
- 图片二进制与图片 MIME 类型。
- `visibility`：`private` 为用户自己的菜单，`public` 为公共投稿/公共菜品池。
- `status`：`pending`、`approved`、`rejected`。私有菜单默认直接 `approved`，公共投稿需管理员审核。
- `source`、`submitted_by`、`submitted_username`。
- `reviewed_by`、`review_note`、`reviewed_at`。
- 创建/更新时间、软删除时间。

语义：

- 用户侧随机池读取公共已通过菜品 + 当前用户自己的私有菜品。
- 管理端只审核 `visibility=public` 的投稿。
- 图片当前保存在数据库中，单张限制 800KB，支持 jpeg/png/webp/gif。

## AI 助手表

`ui_assistant_configs`：

- 固定 `id=1`。
- 启用状态、名称、欢迎语。
- provider、Base URL、API Key、模型名。
- 系统提示词。
- 截图、知识库、会话存储开关。
- 每日免费次数、截图大小限制。

`ui_assistant_documents`：

- 标题、内容、启用状态、排序。
- 创建/更新人。
- 软删除。

`ui_assistant_sessions`：

- 用户、页面路径、问题、截图数量。
- 诊断决策、回复摘要。
- provider、模型名、错误信息。
- 用于管理端摘要查看。

`ui_assistant_conversations`：

- 用户、标题、最后消息、创建/更新时间、软删除。
- 用于用户侧历史对话列表。

`ui_assistant_conversation_messages`：

- 会话 ID、用户 ID。
- role、content、reasoning。
- 截图数量、创建时间。

## 用户头像字段

`users.avatar`：

- BLOB/LONGBLOB。
- 存储压缩后的头像图片。

`users.avatar_type`：

- `varchar(32)`。
- 存储 content type。

注意：

- 批量查询用户时应 omit `avatar`，避免列表接口读取大字段。
- 上传大小限制 200KB。
- 头像公开读取，ETag 使用 CRC32(data)。

## 用户时间字段

官方 rc.4 合并后需要确认：

- `users.created_at`
- `users.last_login_at`

这两个字段如果缺失，生产 `NODE_TYPE=slave` 不会自动补齐，需要手动 `ALTER TABLE`。

## perf_metrics

官方 rc.4 合并后新增模型性能指标能力，需要确认：

- `perf_metrics` 表存在。

如果云端构建成功但 default UI 或性能指标接口报错，优先检查该表是否已迁移。

## KPay 订单字段

KPay 原生充值会把平台订单号保存到：

- `top_ups.provider_order_no`

该字段用于服务端查单兜底：当支付 App 回跳、浏览器本地状态丢失或前端没有携带 `provider_order_no` 时，后端仍可通过本地充值订单找到 KPay 平台单号并调用查单接口。

生产 `NODE_TYPE=slave` 不会自动补齐字段，MySQL 可手动执行：

```sql
ALTER TABLE top_ups ADD COLUMN provider_order_no varchar(255) DEFAULT '';
CREATE INDEX idx_top_ups_provider_order_no ON top_ups (provider_order_no);
```

如果数据库面板提示列已存在，可忽略该 `ALTER TABLE`。

## 签到分组配置

`checkin_setting.group_quotas` 示例：

```json
{
  "default": { "min_quota": 1000, "max_quota": 10000 },
  "standard": { "min_quota": 2000, "max_quota": 12000 },
  "pro": { "min_quota": 3000, "max_quota": 15000 },
  "super": { "min_quota": 4000, "max_quota": 20000 },
  "ultra": { "min_quota": 5000, "max_quota": 30000 }
}
```

规则：

- 空字符串或 `null` 等价于无分组覆盖。
- 分组名不能为空。
- `min_quota` 与 `max_quota` 不能为负数。
- `max_quota` 不能小于 `min_quota`。
- 支持中文后缀和历史拼写归一化。

## 手动迁移检查清单

生产部署前至少确认：

- `ui_announcements`
- `ui_announcement_acks`
- `ui_notifications`
- `ui_notification_reads`
- `ui_notification_settings`
- `ui_refund_appeals`
- `ui_refund_appeal_items`
- `ui_page_configs`
- `ui_assistant_configs`
- `ui_assistant_documents`
- `ui_assistant_sessions`
- `ui_assistant_conversations`
- `ui_assistant_conversation_messages`
- `perf_metrics`
- `users.avatar`
- `users.avatar_type`
- `users.created_at`
- `users.last_login_at`
- `top_ups.provider_order_no`

如果数据库面板报多语句 SQL 错误，应拆成单条 `CREATE TABLE` 或单条 `ALTER TABLE` 执行。
