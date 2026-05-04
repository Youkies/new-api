# 当前任务

## 当前任务：通知中心与空回申诉批量审核（2026-05-04）

### 已加载状态

- 上一阶段已完成新 UI 页面配置、API 地址后台化、生产 `ui_page_configs` 缺表读取回退，并推送提交 `dc5a8db6` 与 GHCR 镜像。
- 关键判断：公告继续作为正式内容归档；通知中心负责个人送达、头像红点、未读/确认状态。红点不等于公告页有新内容，只等于当前用户有未读通知。
- 生产约束：`NODE_TYPE=slave` 会跳过 AutoMigrate，新表/新列上线前仍需手动迁移。

### 本轮实现状态

- 已新增通知体系后端模型：`ui_notifications` 与 `ui_notification_reads`，支持 `announcement`、`billing`、`appeal`、`system` 类型，目标范围支持全部用户、指定用户、分组和管理员。
- 已新增用户通知接口：通知列表、未读数量、单条已读、单条确认、全部已读；需要确认的通知不能被普通“已读”绕过。
- 已新增通知管理后台接口与新 UI `/admin/notifications`；用户反馈后已调整为“通知设置”页，专门配置系统自动通知策略，不再默认做成手工通知列表。
- 公告已接入通知中心：公告管理新增“进通知”“需确认”“通知级别”；公告版本更新会同步新通知，公告确认会同步通知已读/确认。
- 充值已接入 `billing` 通知：兑换码充值、易支付回调、Stripe、Creem、Waffo、Waffo Pancake、管理员补单成功后可按设置生成到账通知；通知写入失败只记系统日志，不回滚充值。
- 空回补偿申诉已接入 `appeal` 通知：提交、审核通过、驳回可分别按设置给用户写通知，并可分别要求确认。
- 已新增管理员“一键通过所有”待审核空回申诉：`POST /api/ui/admin/refund-appeals/approve-all`，前端在 `/admin/refund-appeals` 提供按钮，逐单事务补偿并汇总成功/失败。
- 前端已新增 `/notifications` 通知中心，头像红点和菜单未读数接入通知未读数；打开页面不自动已读，必须点击“标记已读”或“我已知晓”。
- 已按移动端反馈压缩 `/notifications`：`ClayConsoleShell` 新增紧凑页头、隐藏会员徽章和隐藏 AI 助手开关；通知页移动端改为短标题、图标操作、一行横滑筛选、小统计条和更紧凑的通知卡片，目标是首屏优先看到列表。
- 调试模式 mock 已覆盖通知中心、通知设置、公告同步通知、充值通知、申诉状态通知和批量通过。

### 验证

- `go test ./service ./model ./controller ./router ./relay ./relay/channel/openai ./relay/channel/gemini` 通过。
- `npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次移动端 UI 修复中先尝试 `bun run build`，但当前环境未安装 Bun；已回退并通过 `npm run build`（`uiweb`）。
- `git diff --check` 通过。

### 下一步

- 提交并推送当前通知中心移动端 UI 修复。
- 生产 `NODE_TYPE=slave` 部署前需手动迁移：新增 `ui_notifications`、`ui_notification_reads`，并给 `ui_announcements` 增加 `notify_enabled`、`notify_level`、`require_ack` 列。
- 通知设置还需要新增 `ui_notification_settings` 表；如表缺失，读取设置会回退默认值，保存设置会提示先迁移。
