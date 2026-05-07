# 项目手册

> 本手册用于承接归档前 `.ai_memory` 的长细节，以及当前精简记忆库里的最新决策。日常接手时先读本页，需要细节时再进入专题文档。

## 文档来源

- 归档前长记忆版本：`4f2a92bc` 提交中的 `.ai_memory/*`。
- 当前精简记忆：本地 `.ai_memory/0_archive_context.md`、`1_project_context.md`、`2_active_task.md`、`3_work_log.md`。
- 当前代码确认点：`router/api-router.go`、`router/web-router.go`、`router/diagnostic-router.go`、`model/ui_*.go`、`uiweb/src/*`。

## 项目定位

new-api 是 Go + Gin + GORM 的 AI API 网关/代理，聚合 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等上游。当前项目在官方能力之上维护了一套独立的用户侧新 UI：`uiweb`。

三套前端的长期定位：

- `/`：`uiweb`，用户自己的主 UI，也是用户侧和轻运营功能的主入口。
- `/legacy/`：官方 classic UI，保留为重管理后台备用。
- `/default/`：官方新版 default UI，保留为备用入口和功能参考，不替换主 UI。

三套 UI 是同一个 Go 进程内嵌静态资源，不是三套服务同时运行。未访问时几乎没有 CPU/DB 负担，主要成本是构建时间、镜像体积和未来合并冲突。

## 必读索引

- [uiweb 总览](./uiweb/overview.md)：技术选型、路由、页面清单、设计边界。
- [用户侧功能](./uiweb/features.md)：Dashboard、令牌、日志、充值、签到、定价、状态、API 地址、头像、会员、AI 助手。
- [管理端与运营功能](./uiweb/admin.md)：轻管理后台、公告、通知、申诉、页面配置、AI 助手配置。
- [API 契约](./uiweb/api-contracts.md)：`/api/ui`、`/api/model-status`、头像、诊断接口。
- [数据库与迁移](./uiweb/database-and-migrations.md)：新增表、字段、生产 `NODE_TYPE=slave` 手动迁移事项。
- [部署与排障](./uiweb/deployment-and-troubleshooting.md)：Zeabur、Docker、Nginx、SSE/600s、登录态、构建问题。
- [记忆库迁移指南](./memory-to-docs-migration-guide.md)：把其他项目从长记忆库迁移到“轻量记忆 + 项目文档”的通用流程。

## 日常接手顺序

1. 先读 `.ai_memory/2_active_task.md`，确认当前正在处理的事。
2. 再读 `.ai_memory/1_project_context.md`，确认稳定约束。
3. 如果涉及 `uiweb` 细节，按上方索引查专题文档，不要把完整历史重新塞回记忆库。
4. 如果涉及数据库、生产部署、长流问题，优先查 [数据库与迁移](./uiweb/database-and-migrations.md) 和 [部署与排障](./uiweb/deployment-and-troubleshooting.md)。

## 维护原则

- `.ai_memory` 只保留索引、当前状态、关键决策和下一步。
- `docs/` 保存完整细节、接口、迁移、排障流程和长期可查知识。
- 新功能完成后，如果是一次性实现流水，写入工作日志即可；如果会长期影响接手或生产运维，应同步更新对应专题文档。
- 不把 secrets、token、密码、`.env` 值写进文档；必要时用 `[REDACTED]`。
