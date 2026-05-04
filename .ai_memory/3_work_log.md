# 工作日志

> 2026-05-01 已压缩：2026-04-20~2026-04-29 的详细流水已折叠进 `0_archive_context.md` 与 `1_project_context.md`。这里之后只记录高信号节点。

- [2026-04-20] 初始化记忆库，确认项目是 Go AI API 网关/代理，前端美化采用独立 `uiweb`。
- [2026-04-24] 完成 `uiweb` 基础骨架、访客页、登录后页面、Go embed 与 SPA fallback。
- [2026-04-25] 重做 Pricing 与日志/令牌/仪表盘移动端体验，引入供应商图标和 Clay 卡片体系。
- [2026-04-26] 完成根路由新 UI、`/legacy` 经典前端挂载、Zeabur Git 部署、头像功能、国内中转与 `system_prompt_to_user_prompt`。
- [2026-04-27] 完成 API URL 页面、签到时区修复、今日消耗卡片、模型状态页与定价页视觉优化。
- [2026-04-28] 完成公告系统、空回补偿申诉、Moon Clay 深色模式、新 UI 调试模式与 AI 助手第一版。
- [2026-04-29] 完成 AI 助手历史对话、余额续聊分组/模型双选择、会员身份展示、Claude thinking 参数清洗、签到页精简、退款说明与常见报错 Q&A。
- [2026-04-30 18:34] 新增渠道级“非流请求转上游流式”开关，服务端聚合上游 SSE 为非流 OpenAI JSON；`go test ./relay/channel/openai ./relay -count=1` 通过。
- [2026-04-30 22:38] 使用提交 `20ce0426` 构建 Docker 生产镜像，并推送 `ghcr.io/youkies/new-api:latest` 与 `ghcr.io/youkies/new-api:20ce0426` 到 GHCR。
- [2026-05-01 12:44] 压缩整理 `.ai_memory`：活动任务改为当前状态，项目上下文改为稳定知识，归档和工作日志改为主题索引。
- [2026-05-01 21:00] 扩展 `non_stream_to_stream_enabled` 到 OpenAI 转 Gemini/Gemini-on-Vertex 上游，新增 Gemini SSE 聚合为 OpenAI 非流 JSON；`go test ./relay ./relay/channel/gemini ./relay/channel/openai ./relay/channel/vertex -count=1` 通过。
- [2026-05-01 22:25] 新增 `empty_stream_diagnostic` 空流诊断日志，用户正常访问即可抓取首包前空关闭的渠道/模型/流状态/上游响应元信息；`go test ./relay ./relay/channel/openai ./relay/channel/gemini -count=1` 通过。
- [2026-05-03 21:03] 完成新 UI 页面配置页、API 地址自定义、令牌复制兼容 fallback、移动端模型名换行与 Vite `/api-urls` 代理冲突修复；`go test ./model ./controller ./router` 和 `uiweb npm run build` 通过。
- [2026-05-03 21:10] 复核并纳入 relay/error 客户端断开归一化改动，修复 channel affinity 测试唯一键碰撞；排除 `.tmp_mysql_migration/` 临时目录；`git diff --check`、相关 Go 测试和 `uiweb npm run build` 通过。
- [2026-05-04 00:45] 修复 `ui_page_configs` 生产缺表读取回退，提交并推送 `dc5a8db6`；构建并推送 GHCR 镜像 `latest` / `dc5a8db6`，digest `sha256:70cb97ac09d3a38a8e23a9fccabdb637cef02179e8986fac5c235278eb8b1cfc`。
- [2026-05-04 01:15] 完成通知中心体系、头像红点、公告/充值/申诉通知接入、通知管理后台和空回申诉一键通过所有；Go 相关测试、`uiweb npm run build` 与 `git diff --check` 通过。
- [2026-05-04 11:58] 按产品语义将 `/admin/notifications` 从手工通知列表调整为自动通知策略设置页，新增 `ui_notification_settings`，支持充值和空回申诉各事件独立启停与确认要求；`go test ./model ./controller ./router` 与 `uiweb npm run build` 通过。
- [2026-05-04 13:11] 压缩通知中心移动端 UI：短页头、横滑筛选、小统计条、紧凑通知卡，并在该页隐藏会员徽章与 AI 助手悬浮按钮；`uiweb npm run build` 与 `git diff --check` 通过。
- [2026-05-04 14:29] 明确移动端优化边界：管理端主要电脑使用，不做移动端效率优化；后续排查和改动聚焦用户端新 UI。
- [2026-05-04 14:35] 优化用户端移动端按钮与弹窗：日志页补空回/申诉记录按钮改短文案和固定高度，通用弹窗 footer 手机纵向铺满，令牌弹窗底部操作同步适配；`uiweb npm run build` 与 `git diff --check` 通过。
- [2026-05-04 18:36] 修复日志页移动端页头挤压：普通用户端页头移动端标题区独占一行，操作按钮下移；会员徽章不换行且图标不压缩；`uiweb npm run build` 与 `git diff --check` 通过，本次按用户要求暂不推送。
- [2026-05-04 18:37] 修复个人设置移动端选项卡：`ClayTabs` 支持横向滑动且单项不换行，避免账号/安全/通知/偏好被拆成竖排；`uiweb npm run build` 与 `git diff --check` 通过，暂不推送。
- [2026-05-04 18:42] 调整通知卡片移动端阅读流程：正文默认折叠，需展开正文后才显示已读/知晓按钮，避免长公告撑爆列表；`uiweb npm run build` 与 `git diff --check` 通过，暂不推送。
- [2026-05-04 19:02] 收紧令牌管理搜索区：搜索按钮改固定小尺寸图标按钮，输入框去掉默认底部空隙并垂直居中；`uiweb npm run build` 与 `git diff --check` 通过。
- [2026-05-04 21:23] 完成签到系统分组额度改造：新增 `checkin_setting.group_quotas`，签到按用户分组选择奖励范围，经典后台可编辑 JSON；Go 相关测试、`uiweb npm run build`、经典后台 JSX Prettier check 与 `git diff --check` 通过。
- [2026-05-04 21:34] 补齐新 UI `Standard 优` 会员标志：新增独立 membership tier、薄荷绿色徽章和 `BadgeCheck` 图标映射；`uiweb npm run build` 与 `git diff --check` 通过。
- [2026-05-04 21:48] 修复分组签到配置中文后缀 key 兼容：配置写 `standard优`、`pro优` 等也会归一化命中；Go 相关测试与 `git diff --check` 通过。
- [2026-05-04 22:01] 扩展新 UI 页面配置：`/admin/page-config` 支持编辑会员铭牌名称、短名和描述，保存到 `ui_page_config.membership_badges` option；用户侧会员展示从 `/api/ui/page-config` 加载覆盖；Go 相关测试、`uiweb npm run build` 与 `git diff --check` 通过。
