# 当前任务

## 当前任务：分组签到额度配置（2026-05-04）

### 已完成

- 在原 `checkin_setting.min_quota` / `max_quota` 默认范围基础上新增 `checkin_setting.group_quotas`，支持按用户 `group` 配置签到最小/最大额度。
- 签到执行与签到状态接口都会读取用户真实分组；未命中分组配置时回退全局默认范围。
- 分组匹配支持精确分组名，也兼容 `standard`、`pro`、`super`、`spuer`、`ultra` 等会员语义 key。
- 经典后台“签到设置”页新增分组签到额度 JSON 编辑框，并在保存前校验 JSON；后端保存时校验额度非负且最大值不小于最小值。
- 新增 `setting/operation_setting/checkin_setting_test.go` 覆盖分组范围解析与非法配置校验。
- 新 UI 已补齐 `Standard 优` 会员徽章，位于普通与 Pro 之间，使用薄荷绿色 Clay 风格和 `BadgeCheck` 图标。
- 已修复分组签到配置 key 兼容：配置里写 `standard优`、`pro优`、`super优`、`ultra优` 也会归一化匹配对应会员分组，不再只能写 `standard/pro/super/ultra`。
- `/admin/page-config` 已扩展会员铭牌配置，可修改普通、Standard、Pro、Super、Ultra 的铭牌名称、短名与描述；配置通过 `ui_page_config.membership_badges` option 保存，不新增数据库表/列。
- 用户侧新 UI 会员徽章、头像角标和会员卡片会通过 `/api/ui/page-config` 加载 `membership_badges` 并覆盖默认文案；未配置或加载失败时继续使用内置默认文案。

### 验证

- `go test ./setting/operation_setting ./model ./controller ./router` 通过。
- `npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- `npx prettier src/pages/Setting/Operation/SettingsCheckin.jsx src/components/settings/OperationSetting.jsx --check`（`web`）通过。
- `git diff --check` 通过。
- 补齐 `Standard 优` 徽章后，`npm run build`（`uiweb`）与 `git diff --check` 通过。
- 修复中文后缀分组 key 后，`go test ./setting/operation_setting ./model ./controller ./router` 与 `git diff --check` 通过。
- 扩展页面配置会员铭牌后，`go test ./model ./controller ./router`、`npm run build`（`uiweb`）与 `git diff --check` 通过。

### 下一步

- 可在后台写入类似 `{"default":{"min_quota":...,"max_quota":...},"standard":...}` 的配置后上线；生产无需新增表或列，只会新增/更新 options 键。

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
- 用户确认管理端不需要移动端效率优化，后续移动端排查和改动聚焦用户端新 UI；管理端仅保持基本可访问。
- 已继续优化用户端移动端：`/logs` 今日消耗卡片的“自助补空回/申诉记录/刷新”按钮改为手机短文案与固定高度，筛选面板操作按钮手机纵向铺满；`ClayModal` footer 手机纵向铺满，`/tokens` 令牌弹窗的手写 footer 同步改为移动端纵向。
- 已修复 `/logs` 移动端页头挤压：普通 `ClayConsoleShell` 页头在手机上让标题/副标题/会员徽章独占一行，操作按钮下移；会员徽章增加不换行与图标防压缩，避免 Ultra 优被挤成两行。
- 已修复个人设置移动端选项卡：`ClayTabs` 改为可横向滑动，单个 tab 不换行，图标不压缩，避免“账号/安全/通知/偏好”被拆成竖排。
- 已调整 `/notifications` 通知卡片：正文默认折叠，仅展示摘要；有正文的通知需先点“展开正文”，展开后才显示“标记已读/我已知晓”，避免长公告撑爆移动端列表。
- 已收紧 `/tokens` 搜索区：搜索按钮改为固定小尺寸图标按钮，搜索输入移除默认底部空隙并与按钮居中对齐，避免移动端按钮过大。
- 调试模式 mock 已覆盖通知中心、通知设置、公告同步通知、充值通知、申诉状态通知和批量通过。

### 验证

- `go test ./service ./model ./controller ./router ./relay ./relay/channel/openai ./relay/channel/gemini` 通过。
- `npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次移动端 UI 修复中先尝试 `bun run build`，但当前环境未安装 Bun；已回退并通过 `npm run build`（`uiweb`）。
- 本次用户端移动端按钮/弹窗优化后，`npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次 `/logs` 页头与 Ultra 优徽章修复后，`npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次个人设置选项卡修复后，`npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次通知正文折叠与展开后已读修复后，`npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- 本次令牌搜索按钮修复后，`npm run build`（`uiweb`）通过；仍有既有 `vendor-icons` 大 chunk 警告。
- `git diff --check` 通过。

### 下一步

- 等用户确认后再提交；本次按用户要求先不推送。
- 生产 `NODE_TYPE=slave` 部署前需手动迁移：新增 `ui_notifications`、`ui_notification_reads`，并给 `ui_announcements` 增加 `notify_enabled`、`notify_level`、`require_ack` 列。
- 通知设置还需要新增 `ui_notification_settings` 表；如表缺失，读取设置会回退默认值，保存设置会提示先迁移。
