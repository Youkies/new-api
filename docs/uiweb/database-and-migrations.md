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
- `debug_key_traces`

用户表扩展：

- `users.avatar`
- `users.avatar_type`
- `users.created_at`
- `users.last_login_at`

令牌表扩展：

- `tokens.debug_enabled`
- `tokens.debug_connectivity_enabled`

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

## 调试 Key 记录表

`tokens.debug_enabled`：

- 管理员专用调试 Key 开关。
- 普通用户不能开启；relay 只对管理员所属且已开启的 token 写调试记录。

`tokens.debug_connectivity_enabled`：

- 管理员调试 Key 的子开关。
- 开启后该 Key 用于用户端连通性测试，普通 relay 请求会在渠道选择前短路返回检测完成，不请求上游、不扣费。
- 连通性测试时长配置保存到既有 `options` 表，键为 `debug_connectivity_setting.stream_probe_seconds`、`debug_connectivity_setting.stream_probe_interval_seconds`、`debug_connectivity_setting.non_stream_probe_seconds`，不需要新增表。

`debug_key_traces`：

- Request ID、用户、令牌、模型、分组。
- 请求 method/path、relay format/mode、是否流式。
- 渠道 ID/名称/类型、使用渠道链路。
- 状态、HTTP status、上游 status、错误类型/错误码/错误消息。
- 原始请求、上游请求、下游返回的脱敏 headers/body。
- body 截断标记、响应大小、耗时、管理员排障信息。

注意：

- 如果配置了 `LOG_SQL_DSN`，`debug_key_traces` 跟随日志库 `LOG_DB`，需要在日志库执行建表。
- 如果没有配置 `LOG_SQL_DSN`，`debug_key_traces` 与主库同库。
- 单段 body 代码侧最多保存 256KB，并会脱敏明显的密钥字段，但仍应只给管理员可见。

生产 `NODE_TYPE=slave` 不会自动补齐字段和表，MySQL 可手动执行：

```sql
ALTER TABLE tokens ADD COLUMN debug_enabled tinyint(1) DEFAULT 0;
CREATE INDEX idx_tokens_debug_enabled ON tokens (debug_enabled);
ALTER TABLE tokens ADD COLUMN debug_connectivity_enabled tinyint(1) DEFAULT 0;
CREATE INDEX idx_tokens_debug_connectivity_enabled ON tokens (debug_connectivity_enabled);

CREATE TABLE debug_key_traces (
  id bigint AUTO_INCREMENT PRIMARY KEY,
  request_id varchar(64) DEFAULT '',
  created_at bigint,
  user_id bigint DEFAULT 0,
  username varchar(191) DEFAULT '',
  token_id bigint DEFAULT 0,
  token_name varchar(191) DEFAULT '',
  model_name varchar(191) DEFAULT '',
  `group` varchar(191) DEFAULT '',
  request_method varchar(16) DEFAULT '',
  request_path varchar(512) DEFAULT '',
  relay_format varchar(64) DEFAULT '',
  final_relay_format varchar(64) DEFAULT '',
  relay_mode bigint DEFAULT 0,
  is_stream tinyint(1) DEFAULT 0,
  channel_id bigint DEFAULT 0,
  channel_name varchar(191) DEFAULT '',
  channel_type bigint DEFAULT 0,
  use_channel longtext,
  status varchar(32) DEFAULT '',
  http_status bigint DEFAULT 0,
  upstream_status bigint DEFAULT 0,
  error_type varchar(64) DEFAULT '',
  error_code varchar(128) DEFAULT '',
  error_message longtext,
  request_headers longtext,
  request_body longtext,
  request_body_truncated tinyint(1) DEFAULT 0,
  upstream_url longtext,
  upstream_headers longtext,
  upstream_body longtext,
  upstream_body_truncated tinyint(1) DEFAULT 0,
  response_headers longtext,
  response_body longtext,
  response_body_truncated tinyint(1) DEFAULT 0,
  response_size bigint DEFAULT 0,
  use_time bigint DEFAULT 0,
  admin_info longtext,
  INDEX idx_debug_key_traces_request_id (request_id),
  INDEX idx_debug_key_traces_created_at (created_at),
  INDEX idx_debug_key_traces_user_id (user_id),
  INDEX idx_debug_key_traces_token_id (token_id),
  INDEX idx_debug_key_traces_status (status),
  INDEX idx_debug_key_traces_channel_id (channel_id)
);
```

如果数据库面板提示字段、表或索引已存在，可忽略对应语句。

如果升级前已存在 `debug_key_traces`，且启动日志出现 `Data too long for column 'request_body'` 或 `ALTER TABLE debug_key_traces MODIFY COLUMN request_body text`，说明旧版本自动迁移正在尝试把大字段降级为 `TEXT`。先在 `debug_key_traces` 所在数据库执行：

```sql
ALTER TABLE debug_key_traces
  MODIFY COLUMN request_body LONGTEXT,
  MODIFY COLUMN response_body LONGTEXT,
  MODIFY COLUMN upstream_body LONGTEXT,
  MODIFY COLUMN request_headers LONGTEXT,
  MODIFY COLUMN response_headers LONGTEXT,
  MODIFY COLUMN upstream_headers LONGTEXT,
  MODIFY COLUMN upstream_url LONGTEXT,
  MODIFY COLUMN error_message LONGTEXT,
  MODIFY COLUMN admin_info LONGTEXT,
  MODIFY COLUMN use_channel LONGTEXT;
```

`debug_key_traces` 跟随 `LOG_SQL_DSN`：配置了日志库就在日志库执行；未配置日志库则在主库执行。

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

## 促销活动后台化（promotion_campaigns + promotion_skus）

`top_ups.promotion_sku_id` 列在更早的 520 活动 v1 已加入；本次后台化新增两张配置表：

```sql
-- 1. 活动主表（GORM soft delete 用 deleted_at）
CREATE TABLE IF NOT EXISTS `promotion_campaigns` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(64) NOT NULL,
  `title` varchar(191) NOT NULL,
  `subtitle` varchar(255) DEFAULT '',
  `emoji` varchar(16) DEFAULT '',
  `theme_color` varchar(16) DEFAULT 'pink',
  `starts_at` bigint NOT NULL,
  `ends_at` bigint NOT NULL,
  `enabled` tinyint(1) DEFAULT 0,
  `require_email_verified` tinyint(1) DEFAULT 0,
  `min_account_age_days` int DEFAULT 0,
  `total_limit` int DEFAULT 0,
  `per_user_limit` int DEFAULT 0,
  `show_topup_banner` tinyint(1) DEFAULT 1,
  `show_dashboard_card` tinyint(1) DEFAULT 0,
  `sort_order` int DEFAULT 0,
  `created_time` bigint DEFAULT NULL,
  `updated_time` bigint DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_promo_slug` (`slug`),
  KEY `idx_enabled` (`enabled`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. SKU 子表（无 soft delete，硬删前后端检查订单引用）
CREATE TABLE IF NOT EXISTS `promotion_skus` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `sku_key` varchar(64) NOT NULL,
  `campaign_id` int unsigned NOT NULL,
  `sort_order` int DEFAULT 0,
  `label` varchar(64) NOT NULL,
  `subtitle` varchar(128) DEFAULT '',
  `emoji` varchar(16) DEFAULT '',
  `price_yuan` decimal(10,2) NOT NULL,
  `delivered_yuan` decimal(10,2) NOT NULL,
  `price_display` varchar(32) DEFAULT '',
  `delivered_display` varchar(32) DEFAULT '',
  `highlight` tinyint(1) DEFAULT 0,
  `total_limit` int DEFAULT 0,
  `per_user_limit` int DEFAULT 0,
  `enabled` tinyint(1) DEFAULT 1,
  `created_time` bigint DEFAULT NULL,
  `updated_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_promo_sku_key` (`sku_key`),
  KEY `idx_promo_sku_campaign` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> ⚠️ slave 节点需要手动跑这两段 SQL。master 节点 AutoMigrate 会建表，并在
> `promotion_campaigns` 表 Unscoped count == 0 时自动 seed 520 默认数据
> （sku_key 与历史 `top_ups.promotion_sku_id` "p520-sku-1..4" 对齐）。
>
> **从硬编码版本升级路径**：
> 1. master 先发新代码 → AutoMigrate 建表 + seed 520（如果 DB 表空）
> 2. 历史订单的 `top_ups.promotion_sku_id = "p520-sku-1"` 等仍能解析
>    （`model.FindSkuByKey` 不看 enabled，按 sku_key 直接匹配即可）
> 3. slave 上线前在 Zeabur MySQL 跑上面两段 SQL；不需要 seed（slave 不跑
>    后台任务，seed 也是 master 启动时触发的）
> 4. 后续运营改活动直接走 /legacy/promotion 后台 UI，不再依赖发版

## Pioneer 优先锋计划字段

slave 节点访问门票，与会员分组 / 计费完全解耦：

- `users.pioneer` `tinyint(1) DEFAULT 0` — 1 表示该账号属于 Pioneer 计划

slave 手动 SQL（master 启动一次后会自动添加，slave 只跑 SQL）：

```sql
ALTER TABLE `users` ADD COLUMN `pioneer` tinyint(1) NOT NULL DEFAULT 0;
```

slave 节点环境变量：

| 变量 | 示例 | 作用 |
|------|------|------|
| `SLAVE_NODE_PIONEER_ONLY` | `true` | 开启 Pioneer gate：`users.pioneer=false` 的用户 `/v1` 返回 403，uiweb 自动重定向到主站 |
| `PRIMARY_SITE_URL` | `https://newapi.youkies.space` | 错误消息与 uiweb"返回主站"按钮的目标 URL |

> ⚠️ 仅在 slave 节点（`NODE_TYPE=slave`）上启用 `SLAVE_NODE_PIONEER_ONLY=true`。master 节点忽略该变量。  
> 已有 Redis 用户缓存条目反序列化时 `pioneer` 缺失会得到 `false`（安全降级到非 Pioneer），缓存 TTL 后自动刷新。

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
- `debug_key_traces`
- `perf_metrics`
- `users.avatar`
- `users.avatar_type`
- `users.created_at`
- `users.last_login_at`
- `top_ups.provider_order_no`
- `tokens.debug_enabled`
- `tokens.debug_connectivity_enabled`

## 用户模型别名存档（feature 分支，**尚未 merge main**）

> 来源分支：`feature/user-model-aliases-and-clay-logs`。完整功能与 Clay UI 设计沉淀见 `docs/feature-archive-and-clay-logs.md`。
> **当前仅用 feature 镜像在测试机验证**，main 分支生产暂不需要执行下面的迁移。merge main 时同步本节并入"手动迁移检查清单"。

#### 新表：`user_model_archives`

用户级模型别名存档，每用户可建多个。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int unsigned PK | |
| `user_id` | int unsigned | |
| `name` | varchar | 用户可见名称 |
| `slug` | varchar | `slugify(name)`，冲突自动加 `-2/-3/...` |
| `description` | text | 可空 |
| `share_code` | varchar | 10 位短码，全局唯一（nullable） |
| `share_enabled` | bool | |
| `created_time` / `updated_time` | bigint | 秒级时间戳 |
| `deleted_at` | datetime | GORM soft-delete |

约束：
- `(user_id, slug)` 复合唯一索引。
- `share_code` 全局唯一（nullable）。

#### 新表：`user_model_aliases`

存档内的别名 → 真实 (group, model) 映射。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int unsigned PK | |
| `archive_id` | int unsigned | 外键 → `user_model_archives.id` |
| `alias_name` | varchar | 别名（支持中文，禁用 `@` 与空白） |
| `source_group` | varchar | relay 实际使用的分组 |
| `source_model` | varchar | relay 实际使用的真实模型名 |
| `disabled_reason` | text | 分享导入后无权限时打标 |
| `created_time` / `updated_time` | bigint | 秒级时间戳（无 soft-delete） |

约束：
- `(archive_id, alias_name)` 复合唯一索引（仅存档内唯一，跨存档可重名）。

#### 新列：`tokens.archive_id`

Token 绑定的默认存档（nullable int unsigned）。relay 在请求未带显式 `slug@alias` 前缀时使用该存档解析别名。

#### 新列：`logs.requested_model_name`

落库用户实际输入的模型名（在 relay 改写为真实模型之前捕获）。展示在日志卡片主标题位置，与实际命中的 `model_name` 分别展示。

#### `NODE_TYPE=slave` 手动 SQL

MySQL 示例（PostgreSQL / SQLite 同等替换列类型即可，AutoMigrate 在 master 上跑就会生成对应建表语句，slave 只需对照执行）：

```sql
CREATE TABLE IF NOT EXISTS `user_model_archives` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `description` text,
  `share_code` varchar(32) DEFAULT NULL,
  `share_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_time` bigint DEFAULT NULL,
  `updated_time` bigint DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_slug` (`user_id`, `slug`),
  UNIQUE KEY `uniq_share_code` (`share_code`),
  KEY `idx_user` (`user_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_model_aliases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `archive_id` int unsigned NOT NULL,
  `alias_name` varchar(191) NOT NULL,
  `source_group` varchar(191) NOT NULL,
  `source_model` varchar(191) NOT NULL,
  `disabled_reason` text,
  `created_time` bigint DEFAULT NULL,
  `updated_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_archive_alias` (`archive_id`, `alias_name`),
  KEY `idx_archive` (`archive_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tokens` ADD COLUMN `archive_id` int unsigned DEFAULT NULL;
ALTER TABLE `logs` ADD COLUMN `requested_model_name` varchar(191) DEFAULT '';
```

> ⚠️ 关键：archive/alias 表的时间列名是 `created_time` / `updated_time`（bigint 秒级时间戳），不是 `created_at` / `updated_at`（datetime）。`user_model_archives` 走 GORM soft-delete 保留 `deleted_at`；`user_model_aliases` 没有 soft-delete，**不要建 `deleted_at` 列**。
>
> 如果之前已经按错误列名建表，修复 SQL：
>
> ```sql
> ALTER TABLE `user_model_archives`
>   DROP COLUMN `created_at`, DROP COLUMN `updated_at`,
>   ADD COLUMN `created_time` bigint DEFAULT NULL,
>   ADD COLUMN `updated_time` bigint DEFAULT NULL;
>
> ALTER TABLE `user_model_aliases`
>   DROP COLUMN `created_at`, DROP COLUMN `updated_at`, DROP COLUMN `deleted_at`,
>   ADD COLUMN `created_time` bigint DEFAULT NULL,
>   ADD COLUMN `updated_time` bigint DEFAULT NULL;
> ```
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_archive_alias` (`archive_id`, `alias_name`),
  KEY `idx_archive` (`archive_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `tokens` ADD COLUMN `archive_id` int unsigned DEFAULT NULL;
ALTER TABLE `logs` ADD COLUMN `requested_model_name` varchar(191) DEFAULT '';
```

slave 节点上线顺序：

1. 在 master（或日志库的写入侧）执行上述 SQL（或让 master 启动一次 AutoMigrate 自动生成）。
2. 再 pull 新镜像启动 slave；slave 自身不会建表 / 加列。
3. Token Redis 缓存：旧条目反序列化新 `archive_id` 字段会得到 nil → 自动降级为"未绑定"，安全；缓存自然 TTL 过期后即更新。


如果数据库面板报多语句 SQL 错误，应拆成单条 `CREATE TABLE` 或单条 `ALTER TABLE` 执行。
