# 归档上下文

## 2026-04-20 — 项目初始认知

- NewAPI 是一个 AI API 网关/代理，聚合 40+ 上游 AI 提供商
- 技术栈：Go + Gin + GORM（后端），React 18 + Vite + Semi Design（前端）
- 部署环境：4C4G 服务器，MySQL 数据库，650 用户，峰值并发 9
- 前端美化方案确定为独立 uiweb 而非 CSS 换皮

## 2026-04-24 — uiweb 黏土风 Stage 1-2+ 全部完成

- 敲定 Vite 5 + React 18 + Tailwind CSS 3 + 自研 clay 组件体系
- Stage 1：12 个访客页 + 9 个 clay 组件 + 4 个 layout + 3 个 Context + services
- Stage 2：4 个登录后页面（Dashboard/TopUp/Personal/Chat2Link）+ 6 个新组件 + ClayConsoleShell
- Stage 2+：3 个新页面（TokenManage/LogList/Checkin）
- Bug 修复：余额显示（StatusContext persistStatusFields）、签到 API 路径
- Go 端 embed + SPA fallback 路由已接入，构建通过

## 2026-04-24 — Stage 2++ 页面打磨 + 模型状态监控

- Pricing 页增加分组展示（原 web 前端逻辑迁移）
- Token 页增加创建时间/分组/模型限制/过期时间列
- Log 页合并 token 用量列、增加额度±着色、错误行红底
- TopUp 页增加购买链接卡片（从 status.top_up_link 读取）
- 新增模型状态监控：Go 端 controller/model_status.go（abilities JOIN channels + logs 时间窗口分槽聚合）
- 新增前端 ModelStatus.jsx 公开页面（/u/status）：Clay 风格、60s 自动刷新、4 种时间窗口、搜索、状态卡片网格
- 关键坑：LogSqlType 默认 SQLite 但 LOG_SQL_DSN 为空时实际用主 DB（MySQL），FLOOR/CAST 语法不兼容
- 关键坑：启动时旧 newapi.exe 占端口导致新 new-api.exe 静默失败

## 2026-04-24 — Clay 风格打磨：布局密度调整 + 部署链总结

- ModelStatus 页从 3 列改为 2 列网格（用户反馈太密集）
- TopUp 页兑换码+购买卡片从纵向堆叠改为并排等高（grid-cols-1 sm:grid-cols-2），与上方统计卡片宽度对齐
- 总结部署链教训：uiweb 改动生效必须 vite build → go build → 杀旧进程 → PowerShell 启动；bash 后台进程不可靠（shell 退出即死）；浏览器缓存需 Ctrl+F5
- 记入 Claude Code memory（feedback_build_deploy.md）避免重复踩坑

