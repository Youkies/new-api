# 归档上下文

> 2026-05-01 已压缩：旧的逐条流水已折叠为主题索引。需要细查历史时优先看 git 历史和相关提交，而不是把完整聊天过程重新塞回记忆库。

## 2026-04-20 — 初始判断

- 项目是 Go + Gin + GORM 的 AI API 网关/代理，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等多类上游，前端包含经典 `web/` 与新建 `uiweb/`。
- 早期判断：4C4G、约 650 用户、峰值并发 9 的规模下，MySQL 与应用同机/同服务商部署可用；前端美化采用独立 `uiweb`，不在经典前端上做大面积 CSS 换皮。

## 2026-04-24~2026-04-27 — uiweb 基础成型

- 敲定 `uiweb`：Vite 5 + React 18 + Tailwind CSS 3 + JSX + 自研 Clay 组件，不使用 TypeScript。
- 已完成访客页、登录后控制台、令牌、日志、签到、定价、模型状态、API 地址页等主要页面，Go 端通过 `embed uiweb/dist` 与 SPA fallback 接入根路由。
- 路由重组：新 UI 挂根路径，经典前端挂 `/legacy/*`，`/legacy` 显式 301 到 `/legacy/`，`/u/*` 301 兼容旧链接。
- 关键经验：uiweb 改动上线链路是前端 build、Go build、停止旧进程、再启动新进程；旧进程占端口会让新二进制看似启动但实际未生效。

## 2026-04-26~2026-04-28 — 部署、头像、公告与空回申诉

- 部署转向 Zeabur Git 部署，GitHub push 自动构建；生产 `NODE_TYPE=slave` 不会 AutoMigrate，新表/新列必须手动建表或 `ALTER TABLE`。
- 国内中转为腾讯云 Nginx 反代 `newapi.youkies.cn` 到海外服务，SSE 需要 `proxy_buffering off` 与长 `proxy_read_timeout`。
- 头像功能完成：DB BLOB 存储、200KB 上限、`react-easy-crop` 裁剪、公开头像 API、CRC32 ETag + `no-cache`、前端 `_avatar_t` cache-bust。
- 新 UI 管理端第一阶段完成：公告管理、强制公告弹窗、历史公告页，使用 `ui_announcements` 与 `ui_announcement_acks`。
- 空回补偿申诉第一版完成：日志页检测 48 小时疑似空回，用户提交批量申诉，管理员人工审核，通过后事务补余额并写管理日志。

## 2026-04-28~2026-04-29 — AI 助手与会员展示

- AI 助手从悬浮球 MVP 演进为用户侧聊天工作台：支持截图、流式回复、后台配置、知识文档、免费次数、余额续聊、历史对话、思考过程折叠。
- AI 助手付费续聊固定走站内 `/pg/chat/completions` 计费链路；免费次数固定每用户 8 次/日，余额续聊需提交所选 `group` 与 `model_name`。
- 桌面端助手改为全屏聊天工作台，移动端改为近全屏聊天视图；模型/分组选择器改为自定义 Clay 弹层。
- 会员身份展示完成：按 `user.group` 展示普通、Pro优、Super优、Ultra优；升级由外部项目自动移组，newapi 只展示身份，不提供升级入口。
- Claude thinking 参数兼容修复完成：OpenAI 格式转 Claude extended thinking 时清洗 `temperature`、`top_k`、非法 `top_p` 与强制工具调用，避免 Anthropic 400。

## 2026-04-29~2026-04-30 — 体验收尾、镜像与非流转上游流式

- 完成签到日历移动端精简、关于页退款说明、常见报错 Q&A 文档、`gpt-5.5` 基础模型匹配。
- 已多次构建并推送 GHCR 镜像：`ghcr.io/youkies/new-api:latest`，最近一次对应提交 `20ce0426`。
- 新增渠道级 `non_stream_to_stream_enabled`：用户仍发非流请求、下游仍收非流 JSON，但服务内部可对 OpenAI-compatible 上游强制 `stream:true` 并聚合 SSE，绕开 Cloudflare 非流 100s 左右超时风险。
- 最新验证：`go test ./relay/channel/openai ./relay -count=1` 通过，`git diff --check` 通过；前端完整 build 被既有 `@douyinfe/semi-ui/dist/css/semi.css` package export 问题阻断。

## 2026-05-01 — 记忆库压缩

- 将旧的 `2_active_task.md` 中大量已完成任务移入本归档索引，只保留当前可接手状态。
- 将 `1_project_context.md` 改为稳定事实清单，移除重复的实现流水。
- 将 `3_work_log.md` 改为近期摘要，不再保留每天每轮的长日志。
