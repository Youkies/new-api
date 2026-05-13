# 项目核心知识库

> 本文件只保留稳定索引和高优先级决策。完整细节查 `docs/project-handbook.md` 与 `docs/uiweb/`，不要把长流水重新塞回记忆库。

## 接手顺序

- 先读 `.ai_memory/2_active_task.md`，确认当前任务、阻塞和下一步。
- 再读本文件，确认稳定约束和长期决策。
- 涉及 `uiweb`、迁移、部署、SSE/600s、通知、申诉、AI 助手、头像、会员、页面配置时，按 `docs/project-handbook.md` 索引打开对应专题文档。
- 记忆库只写索引、当前状态和关键决策；可复用细节写入 `docs/`。

## 项目形态

- new-api 是 Go AI API 网关/代理，后端采用 Gin + GORM，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等多类上游。
- 数据库必须同时兼容 SQLite、MySQL、PostgreSQL；生产主要使用 Zeabur MySQL，且 `NODE_TYPE=slave` 会跳过 AutoMigrate。
- 业务代码 JSON 编解码优先使用 `common/json.go` 包装函数。
- 涉及新渠道时要确认 `StreamOptions` 支持情况。
- 涉及表达式计费前先读 `pkg/billingexpr/expr.md`。

## 文档体系

- 总入口：`docs/project-handbook.md`。
- uiweb 总览：`docs/uiweb/overview.md`。
- 用户侧功能：`docs/uiweb/features.md`。
- 管理端与运营：`docs/uiweb/admin.md`。
- API 契约：`docs/uiweb/api-contracts.md`。
- 数据库与迁移：`docs/uiweb/database-and-migrations.md`。
- 部署与排障：`docs/uiweb/deployment-and-troubleshooting.md`。
- 用户常见报错：`docs/user-error-qa.md`。
- AI 助手会员知识：`docs/membership-assistant-knowledge.md`。
- 记忆库迁移指南：`docs/memory-to-docs-migration-guide.md`。

## UI 主次边界

- `/`：用户自己的 `uiweb` 主 UI，承载用户侧和轻运营能力。
- `/legacy/`：官方 classic UI，作为重管理后台备用。
- `/default/`：官方新版 default UI，仅保留为备用入口和功能参考，不替换主 UI。
- `/classic` 与 `/classic/*`：301 到 `/legacy/`。
- `/u/*`：301 到根路径，兼容旧链接。
- 三套 UI 是同一个 Go 进程内嵌静态资源，不是三套服务；未访问时几乎无运行时 CPU/DB 负担，主要成本是构建时间、镜像体积和未来合并冲突。

## uiweb 稳定边界

- 技术选型：Vite 5 + React 18 + JSX + Tailwind CSS 3 + 自研 Clay 组件。
- `uiweb` 管理端定位为轻量“站点运营后台”，不要塞大量渠道、模型、系统设置等重管理功能。
- 用户端移动端体验优先优化；管理端主要按桌面使用场景维护，只需保持基本可访问。
- 官方 default UI 当前审美不符合用户偏好，先保留不删除；后续官方 default 更新优先借鉴 API/逻辑，不主动替换主 UI。

## 部署与生产约束

- Zeabur 同一个项目内同时部署数据库服务和应用服务；数据库为 Zeabur MySQL，数据库名 `zeabur`。
- 正式网站使用本地打包 Docker 镜像并推送到 GHCR 后部署。
- 调试/验证部署使用 `NODE_TYPE=slave`，每次 GitHub push 后由 Zeabur 自动构建。
- 海外域名：`newapi.youkies.space`；国内中转域名：`newapi.youkies.cn`。
- 国内中转服务器：腾讯云 `81.71.120.210`，Nginx 配置在 `/etc/nginx/sites-enabled/newapi.conf`，同机还运行 `lobe.youkies.cn`。
- SSE/长响应反代关键配置：`proxy_buffering off`，`proxy_read_timeout 1000s`。
- 生产必须固定 `SESSION_SECRET`；如需加密签名稳定，可同步固定 `CRYPTO_SECRET`。
- `NODE_TYPE=slave` 不跑迁移；正式站也不能依赖自动迁移，新表/新列上线前必须手动确认或执行 SQL，完整清单查 `docs/uiweb/database-and-migrations.md`。
- 官方 `v1.0.0-rc.4` 合并后生产需确认 `perf_metrics` 表，以及 `users.created_at`、`users.last_login_at` 两列。

## 高风险排障索引

- 600s/SSE：优先查 `docs/uiweb/deployment-and-troubleshooting.md`。2026-05-08 对 `newapi-clay.youkies.space` 900s 无模型 SSE 复测完整返回 `done`，未复现固定 600s；`newapi.youkies.cn` 诊断口当时为 404。
- 非流请求转上游流式：渠道级 `non_stream_to_stream_enabled`，用户侧非流、上游强制流式、服务端聚合为 OpenAI 非流 JSON；细节查部署排障文档。
- Claude extended thinking：OpenAI 格式转 Claude 时需清洗 `temperature`、`top_k`、非法 `top_p`，强制工具调用降级为 `auto`。
- 头像缓存：User 对象 `_avatar_t` + 头像 URL `?t=` + 服务端 CRC32 ETag + `no-cache`。
- 定价公式、模型状态 SQL、日志筛选、签到时区、分组签到、通知/申诉/AI 助手等细节均已沉淀到 `docs/uiweb/`。

## 协作偏好

- 对功能/界面小迭代，用户通常希望完成后整理 diff，并在合适时提交到当前分支。
- 功能修改完成后，本地 debug/验收固定流程：关闭旧的测试浏览器和旧 dev server；用 `--host 0.0.0.0 --port 5178` 启动 `uiweb` Vite；选择当前物理局域网 IPv4 作为访问地址；用前台可见浏览器打开并按需调成手机视口；跑完 smoke test 后不要主动关闭浏览器或 dev server，留给用户继续电脑和手机手测。
- 如果 `uiweb` dev server 已经在跑，UI 微调优先依赖 Vite HMR 热更新：保持前台浏览器和手机页面打开，修改文件后让用户直接看实时效果；只有 HMR 未生效、页面状态异常、依赖/环境/Vite 配置变化时才刷新或重启 dev server。
- 手机同网验收优先使用形如 `http://<LAN_IP>:5178/logs?debug=1` 的地址；若手机打不开，优先提醒检查 Windows 防火墙是否允许 Node.js/npm 在专用网络访问。
- 如果前端 debug/mock 模式不足以复现问题，可改用本地完整构建，并按 `NODE_TYPE=slave` 连接现有数据库做联调；本地应通过已被 git 忽略且后端会自动读取的 `.env` 持久保存 `SESSION_SECRET`、`CRYPTO_SECRET`、`SQL_DSN` 等配置，避免每次重复提供，具体 secret 值不写入记忆库、文档或提交。
- 执行提交/推送前必须先核对 `git status` 与 diff 范围，避免带入无关改动、诊断临时文件或未确认文档。
- 本地临时诊断、截图、trace 和临时日志统一放在 git 忽略的 `.tmp/` 目录，不要散落在仓库根目录。
- 前端包管理原则上偏 Bun；当前开发机历史上主要使用 npm/npx，Dockerfile 构建阶段使用 `oven/bun:1`。
- 记忆文件默认用中文；代码、注释、命令、路径、API 名称保持英文。
