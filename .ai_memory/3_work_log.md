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
