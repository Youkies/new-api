# 当前任务

## 状态：新 UI 管理端第一阶段（公告系统）第一版已实现并完成本地验证

## 当前新增任务：空回补偿申诉（2026-04-28）

### 本轮实现进度
- 后端：新增 `model/ui_refund_appeal.go`、`controller/ui_refund_appeal.go`，注册 AutoMigrate；新增用户侧候选检测/提交/自查列表 API 与管理侧列表/详情/通过/驳回 API
- 用户侧：`LogList` 静默检测最近 48 小时疑似空回，仅在有候选时显示“自助补空回”，提交后进入人工审核
- 管理侧：`ClayAdminShell` 新增“申诉”导航；新增 `/admin/refund-appeals` 审核页，支持查看明细、通过补偿、驳回说明
- 补偿方式：审核通过后事务内增加 `users.quota`，并写 `LogTypeManage` 管理日志，经典控制台无需改 UI
- 用户闭环：新 UI 日志页新增“申诉记录/申诉审核中”轻量入口，复用 `/api/ui/refund-appeals/self` 展示最近申诉、状态、补偿额度、审核说明
- 验证：`uiweb npm run build`、Go build、临时 SQLite 主节点启动验证通过；未登录访问用户/管理申诉接口返回 401

## 当前新增任务：新 UI 深色模式（Moon Clay，2026-04-28）

### 本轮实现进度
- 主题体系：新增 `ThemeProvider`，支持 `system` / `light` / `dark`，本地存储 `uiweb.theme.mode`，并在 `index.html` 预写入 `html[data-theme]` 避免首屏闪烁
- UI 入口：公共导航、用户控制台、管理端顶部加入主题切换按钮；个人设置 > 偏好中的“主题”配置改为跟随系统/浅色黏土/Moon Clay 夜间黏土
- 样式底座：`tailwind.config.js` 的 clay 色板与 `shadow-clay*` 改为 CSS variables；`index.css` 定义浅色/Moon Clay 两套色板、文字、阴影、凹陷输入框和焦点阴影
- 兼容处理：深色模式下覆盖常见 `bg-white/*`、`border-black/*`、硬编码品牌文字色与灰色类，减少旧页面片段在夜间主题下突兀发白/发黑
- 验证：`cd uiweb && npm run build` 通过；本地 dev server `http://127.0.0.1:5174/` 返回 200

### 生产前置
- 生产 `NODE_TYPE=slave` 需要手动创建 `ui_refund_appeals`、`ui_refund_appeal_items`
- 建议设置 `UI_REFUND_APPEAL_START_AT`，用于排除上线前已经手动补偿过的历史空回记录

## 新规划（2026-04-28）

### 新 UI 管理端第一阶段：公告系统
- 目标：做轻量“站点运营后台”，不动原版 new-api 管理设置页
- 首个模块：公告管理 + 强制公告弹窗 + 主页历史公告页
- 强制公告规则：每条公告按 ID/version 必须确认一次；弹窗按钮为“不再显示此公告”复选框 + “我已知晓”
- 历史公告入口只在公共主页/公共导航，不放进用户控制台导航
- 后端新增独立表设计：`ui_announcements`、`ui_announcement_acks`；生产 `NODE_TYPE=slave` 需要手动建表，用户已手动执行建表且无报错
- 后续模块：空回申诉审核、页面文案配置、操作审计

### 开发计划路线
1. 后端基础：新增公告模型、迁移注册、公开公告接口、管理员公告 CRUD 接口
2. 权限边界：复用现有登录态与管理员权限，新增 `AdminRoute` / 管理端入口可见性判断
3. 前端用户侧：新增 `AnnouncementProvider`，进入新 UI 时检查强制公告；未登录用 localStorage，登录用户走服务端 ack；弹窗只按每条公告版本确认一次
4. 历史公告页：新增 `/announcements`，接入公共导航，不加入控制台导航
5. 管理端第一版：新增 `/admin` 骨架与 `/admin/announcements`，支持列表、新建、编辑、启用/停用、置顶、强制弹窗、版本递增
6. 验证：本地 `uiweb build` + Go build + `NODE_TYPE=slave` 连接 MySQL 启动；检查新表存在、公开接口、管理员接口、弹窗确认逻辑
7. 后续迭代：空回申诉审核、页面文案配置、管理端操作审计

### 本轮实现进度（2026-04-28）
- 后端：新增 `model/ui_announcement.go`、`controller/ui_announcement.go`，注册 AutoMigrate；新增公开公告列表、强制公告列表、用户确认 ack、管理员公告 CRUD/PATCH/DELETE API
- 前端用户侧：新增 `AnnouncementProvider` 强制公告弹窗队列，按 `id + version` 本地/服务端确认；新增 `/announcements` 历史公告页，并只接入公共导航
- 前端管理侧：新增 `AdminRoute`、`ClayAdminShell`、`/admin`、`/admin/announcements`，支持公告列表、新建、编辑、启用/停用、置顶、删除
- 验证：`uiweb npm run build`、Go build、`NODE_TYPE=slave` + MySQL 短启动通过；`/api/ui/announcements` 与 `/api/ui/announcements/active` 返回 `success=true`

## 本次完成（2026-04-28）

### 充值页
- 移除 TopUp 页 `top_up_link` 对应的“购买额度 / 前往购买”卡片，仅保留兑换码充值与在线支付区域
- 清理不再使用的 `topUpLink`、`ShoppingCart`、`ExternalLink`

### 日志页体验修复
- 桌面端时间筛选从浏览器原生 `datetime-local` 改为自绘 `ClayDateTimeField`：黏土风输入框 + 月历弹层 + 时间输入 + “今天 0 点 / 现在 / 清空”快捷按钮
- 筛选卡片加 `!overflow-visible`，避免自绘时间弹层被 `.clay-card` 截断
- 桌面端日志表：消费日志继续展示模型、令牌、Token、额度、耗时；非消费日志改为合并详情行，直接显示 `content` 与模型/令牌/分组/Request ID/额度 chip
- 移动端日志卡：非消费日志详情不再 `line-clamp` 或 `truncate`，完整显示详细信息
- 刷新速度优化：拆分“正在编辑的筛选条件”和“已应用筛选条件”，避免每次输入/改时间都自动请求日志；新增列表“刷新”按钮；增加请求序号保护，避免旧请求覆盖新结果
- 延迟显示修复：新 UI 日志页默认结束时间改为空，避免页面打开后固定旧 `end_timestamp`；顶部刷新与今日卡片刷新统一回到第一页拉最新日志，并同步刷新今日消耗与空回候选
- 空回申诉闭环：日志页新增用户端申诉记录弹窗，提交成功、手动刷新、打开记录时都会刷新记录状态；无历史记录时不展示入口
- 验证：`cd uiweb && npm run build` 通过，仅保留 vendor-icons chunk 偏大的既有 Vite 警告

### 本地 slave + MySQL 构建验证
- `uiweb` 执行 `npm run build` 通过
- Go 执行本地编译，产物 `bin/new-api-local-test.exe` 生成成功
- 使用 `NODE_TYPE=slave` + 远程 MySQL 启动本地服务成功，日志确认 `using MySQL as database`，且未出现 `database migration started`
- 公开页面/API 验证：`/`、`/logs`、`/topup`、`/console/log`、`/api/status`、`/api/setup`、`/api/model-status?window=1h` 均返回 200
- 静态资源验证：favicon、主 JS、vendor-icons JS、CSS 均返回 200
- 未登录请求 `/api/log/self` 返回 401，符合预期
- 测试完成后已停止本地进程并释放 3000 端口

## 本次完成（2026-04-27）

### 新页面：API URL 子界面 (/api-urls)
- 双卡片展示：通用地址 (newapi.youkies.space) + 国内优化 (newapi.youkies.cn)
- 一键复制 + 弹窗提醒"地址不带 /v1，部分软件需自行追加"
- "不再提示" 复选框：localStorage `uiweb.apiUrls.suppressV1Notice=1`
- 修复 ClayCheckbox 双触发 bug：`<span>` 上冗余 onClick 与 `<label>→<input>` 冲突

### 签到时区修复（核心 bug）
- 根因：Docker 容器默认 UTC，`time.Now().Format("2006-01-02")` 取 UTC 日期；UTC 0:00 = 北京 8:00，用户反馈"凌晨刷新不准"
- 修复 1（应用层）：`controller/checkin.go` + `model/checkin.go` 增加 `checkinTimezone()`，读 `CHECKIN_TIMEZONE` env，默认 `Asia/Shanghai`；`HasCheckedInToday`/`UserCheckin`/`next_checkin_at` 全部按该时区
- 修复 2（容器层）：`Dockerfile` 加 `ENV TZ=Asia/Shanghai`
- 修复 3（前端时钟漂移补偿）：`GetCheckinStatus` 返回 `server_now` + `next_checkin_at`，前端按 `skew = clientNow - server_now` 校正后倒计时

### 日志页：今日消耗卡片
- LogList 顶部新增"今日消耗（自 0:00 起）"粉色渐变卡片
- 调用 `/api/log/self/stat?type=2&start_timestamp=<今日0点>` 独立拉取，与列表筛选解耦
- `services/logs.js#getUserLogsStat` 增加参数支持

### 日志列表 UI 优化
- 桌面表格：行高 py-5→py-3、padding px-5→px-4、表头加 `bg-clay-bg/50` 浅底 + uppercase
- 移动卡片：4 行结构（类型+流标↔额度 / 模型 / Token / 时间↔用时+令牌名），额度右上突出，删除 `ml-10` 缩进

### 模型与价格页视觉重做
- 卡片三段式：①带渐变着色的品牌头部（按量蓝粉渐变 / 按次黄渐变） ②输入/输出双栏（蓝/粉色调 + 方向箭头图标） ③缓存独立行
- 头部信息提示 chip：单位 /1M tokens · 实际扣费按渠道倍率

### 模型状态页四大优化
- OverviewBanner：状态指示器（脉冲 ping）+ 加权 SLA + 4 列指标卡 + 立即刷新按钮
- ModelCard：hover 上浮、底部分隔线、最新桶请求数显示
- Uptime 柱条：hover scale-y-105、白底箭头 tooltip、时间轴标签
- StatusLegend：底部凹陷信息卡，三档阈值说明（≥95%/60-95%/<60%）
- Tooltip 跟随柱条对齐：`leftPct = (i+0.5)/N*100`，clamp 8-92%
- 修复 tooltip 被 .clay-card 全局 `overflow-hidden` 截断：ModelCard 加 `!overflow-visible`

## 下一步
- 需要真实管理员账号进入 `/admin/announcements` 新建一条强制公告，线上验证弹窗确认链路
- 后续可继续做空回申诉审核、页面文案配置与管理端操作审计
