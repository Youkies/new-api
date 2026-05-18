# 当前任务

## 状态：feature 已合并 main（2026-05-18）

### 合并完成

- 分支 `feature/user-model-aliases-and-clay-logs` 累计 13+ commit（v1 → v6.10）合并入 `main`
- 最终 feature 提交：`ff5372b0`（PayMethodIcon SVG 内嵌双层 clay 图标修白球 bug）
- 镜像最后一版：`ghcr.io/youkies/new-api:feature-aliases-and-clay-logs-ff5372b0`
- `:latest` 仍未触碰；推 main 后由生产/测试发布流程自行触发

### 合并后 slave 节点手动迁移清单（必跑）

slave 不跑 AutoMigrate，必须在 master / Zeabur MySQL 上手动执行：

```sql
-- 新表 1：用户模型别名存档
CREATE TABLE IF NOT EXISTS `user_model_archives` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `description` text,
  `share_code` varchar(32) DEFAULT NULL,
  `share_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  `deleted_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_slug` (`user_id`, `slug`),
  UNIQUE KEY `uniq_share_code` (`share_code`),
  KEY `idx_user` (`user_id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 新表 2：存档内别名映射
CREATE TABLE IF NOT EXISTS `user_model_aliases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `archive_id` int unsigned NOT NULL,
  `alias_name` varchar(191) NOT NULL,
  `source_group` varchar(191) NOT NULL,
  `source_model` varchar(191) NOT NULL,
  `disabled_reason` text,
  `created_at` datetime(3) DEFAULT NULL,
  `updated_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_archive_alias` (`archive_id`, `alias_name`),
  KEY `idx_archive` (`archive_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 新列 1：Token 绑定默认存档
ALTER TABLE `tokens` ADD COLUMN `archive_id` int unsigned DEFAULT NULL;

-- 新列 2：用户实际请求的模型名（落库）
ALTER TABLE `logs` ADD COLUMN `requested_model_name` varchar(191) DEFAULT '';
```

执行顺序：
1. 在 Zeabur MySQL（生产库）跑上面 4 段 SQL，或让一个 master 节点启动一次 AutoMigrate 自动生成。
2. slave 节点 pull 新 main 构建的镜像即可启动；slave 不会建表 / 加列。
3. Token Redis 缓存：旧条目反序列化新 `archive_id` 字段会得到 nil → 自动降级"未绑定"，安全；缓存自然 TTL 过期后即更新。

如果数据库面板报"多语句 SQL 错误"，拆成单条 `CREATE TABLE` 或单条 `ALTER TABLE` 执行。

### 验收清单

- `/archives`：建存档、添加别名、生成分享码、跨用户导入
- `/tokens`：Token 绑定存档下拉框、桌面"列表/卡片"切换器
- `/logs`：充值 / 签到 / 错误三类卡高度一致；金额符号跟随全局货币；底部 10/20/50/100 切换；错误卡点击 → modal 内错误信息块点击复制
- `/topup`：双层 clay 支付图标（圆形外圈 + 品牌色内圈 + 白色 SVG）；订单桌面整张大卡内单行 + hairline；移动端独立小卡片
- 暗色模式所有 ink 色自动响应（不依赖 hex hack）

---

## 其它项目长期状态（已稳定，无需操作）

下列任务已完成 / 合并 / 上线，仅作上下文引用，详细见 git log 与 `docs/`：

- **KPay 充值四层兜底**：webhook + 前端 5s 轮询 + watcher 12 分钟退避 + 5 分钟全局扫描。详情 `docs/uiweb/admin.md` 与 `1_project_context.md` 支付边界。
- **东京 API-only 节点**：`newapi-jp.youkies.space`，`NODE_TYPE=slave`，Nginx 仅放行 `/v1` 和 `/api/status`。
- **测试机**：服务器迁移前的云悠美国机器 + 旧数据库，`newapi-test.youkies.space`，push 后由云悠自动构建，`NODE_TYPE=master`。
- **调试 Key + 连通性测试 Key**：`/admin/debug-traces` 已上线。
- **Claude assistant prefill 兼容开关**：渠道级 `claude_assistant_prefill_compat`，需手动给确认有 400 的渠道打开。
- **游乐场 / 今天吃什么呀**：`/playground` 已上线，包含问卷采集 200 条社区菜单 + 公共菜品池审核。
- **必吃榜（搁置）**：从 main revert，代码留在 `feature/youkies-must-eat-shelved`。**当前生产库不要执行必吃榜建表 SQL**。
