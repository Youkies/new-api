# uiweb 部署与排障

## 生产部署

当前生产形态：

- Zeabur 同一个项目内同时部署数据库服务和应用服务。
- 数据库：Zeabur MySQL，数据库名 `zeabur`。
- 正式网站：使用本地打包 Docker 镜像并推送到 GHCR 后部署。
- 调试/验证部署：使用 `NODE_TYPE=slave`，每次 GitHub push 后由 Zeabur 自动构建，用于验证更新链路。
- 海外域名：`newapi.youkies.space`。
- 国内中转域名：`newapi.youkies.cn`。
- 国内中转服务器：腾讯云 `81.71.120.210`，Nginx 配置在 `/etc/nginx/sites-enabled/newapi.conf`。

生产关键环境变量：

- `NODE_TYPE=slave`：调试/验证部署使用，跳过 AutoMigrate；正式站也不能依赖自动迁移，新增表/列上线前按迁移清单手动确认。
- `SESSION_SECRET`：必须固定，否则重新部署后旧 session cookie 失效。
- `CRYPTO_SECRET`：如需加密签名稳定，也应固定。
- `CHECKIN_TIMEZONE=Asia/Shanghai`：签到日期计算。
- `TZ=Asia/Shanghai`：容器时区。
- `UI_REFUND_APPEAL_START_AT`：空回申诉扫描起点。
- `STREAM_DIAG_ENABLED` / `STREAM_DIAG_TOKEN`：长流诊断接口，仅排障时开启。

## 构建链路

当前有两条应用部署链路：

- 正式站链路：本地使用根目录 `Dockerfile` 打包生产镜像，推送到 `ghcr.io/youkies/new-api`，Zeabur 正式网站服务部署该 GHCR 镜像。
- 调试/验证链路：GitHub push 后 Zeabur 自动构建，服务以 slave/调试方式运行，用于验证最新代码和迁移缺口。

Dockerfile 构建内容：

- 经典 `web/classic`。
- 官方新版 `web/default`。
- 用户主 UI `uiweb`。
- Go 后端二进制。

本地历史命令：

- `cd uiweb && npm run build`
- `cd web/default && npm run build`
- `cd web/classic && npm run build`
- Go 测试按改动范围执行。

当前环境偏好：

- 前端原则上偏 Bun。
- 当前开发机历史上主要使用 npm/npx。
- Dockerfile 构建阶段使用 `oven/bun:1`。

已知构建问题：

- `vendor-icons` chunk 偏大是已知成本。
- classic 曾因 Semi CSS package exports 与 `SiLinkedin` 图标不存在阻断，已通过 alias 与 `FaLinkedin` 映射修复。
- 本地无 Bun 时可用 npm fallback 做验证。

## 路由排查

预期：

- `/` 返回 `uiweb`。
- `/default/` 返回官方新版 default UI。
- `/legacy/` 返回 classic UI。
- `/classic` 和 `/classic/*` 301 到 `/legacy/`。
- `/u/*` 301 到根路径。
- `/api/*`、`/v1/*` 不应被 SPA fallback 接管。

常见问题：

- `/legacy` 不带斜杠 404：需要显式 301 到 `/legacy/`。
- classic 白屏：检查 `web/classic` 的 base/basename 和静态资源路径。
- `/api-urls` 被 dev proxy 误判：Vite dev 代理应匹配 `^/api(/|$)` 与 `^/v1(/|$)`，避免 `/api-urls` 被代理到后端。

## 登录态失效

现象：

- 重新部署后用户被踢到未登录。
- 页面报“未登录且未提供 access token”。

根因：

- 未固定 `SESSION_SECRET` 时，后端启动会生成随机 secret，旧 cookie 无法解码。

处理：

- 在生产环境固定 `SESSION_SECRET`。
- 必要时同步固定 `CRYPTO_SECRET`。
- 前端已经对 401 做统一处理：清理本地用户，跳转 `/login?expired=1`，登录后回原页面。

## 生产缺表/缺列

现象：

- 本地正常，生产报表不存在或字段不存在。
- 管理页保存失败。
- default UI 或性能指标接口报错。

根因：

- 生产 `NODE_TYPE=slave` 跳过 AutoMigrate。

处理：

- 查 [数据库与迁移](./database-and-migrations.md) 的手动迁移清单。
- 数据库面板不支持多语句时逐条执行。
- 对读取类配置，部分接口会回退默认值；保存类操作通常要求表存在。

## SSE 与 600s 排障

反代关键配置：

- `proxy_buffering off`
- `proxy_read_timeout 1000s`

诊断接口：

- `GET /api/debug/long-stream?seconds=900&interval=5`
- 需要 `STREAM_DIAG_ENABLED=true`
- 需要 query `token` 或 header `X-Stream-Diag-Token`

排障层次：

1. 无模型 SSE 诊断：确认入口层/域名/反代是否固定切断。
2. 同域名真实模型流式请求：确认 relay 与上游链路。
3. 同模型同渠道直连上游：确认上游是否切断。
4. 不同客户端对比：确认客户端是否有总时长限制。
5. 国内/海外域名对比：确认国内 Nginx 或网络链路。

当前已知结果：

- 2026-05-04，`newapi-clay.youkies.space` 曾在 `TOTAL=600.500145` 断开，最后服务端事件 `elapsed=595`。
- 2026-05-05，同诊断接口复测 900s 完整返回 `done`，`TOTAL=901.044056`。
- 2026-05-08，再次复测 900s，`elapsed=595/600/605` 均正常，最终 `TOTAL=901.670609`。
- `newapi.youkies.cn` 当前未暴露该诊断口，返回 404；如果用户走国内域名，需要单独配置国内链路诊断。

代码层判断：

- `RELAY_TIMEOUT` 默认 `0`，表示 Go `http.Client` 不设置总超时。
- `STREAMING_TIMEOUT` 默认 `300`，是上游 SSE idle timeout，不是总请求时长限制。
- 如果用户报告精确 600s，优先查入口层、客户端总时长、具体上游渠道，而不是直接改 `STREAMING_TIMEOUT`。

日志关注：

- `stream ended`
- `stream_status`
- end reason 是否为 client gone、timeout、EOF、done。
- 是否精确从请求开始 600s，还是从最后一个 chunk 后算。

## 非流请求转上游流式

用途：

- 用户客户端只能发非流请求。
- 上游非流响应可能被 Cloudflare 等链路约 100s 超时。
- 服务端内部对上游强制 `stream:true`，聚合 SSE 后仍返回普通 OpenAI `chat.completion` JSON。

配置：

- 渠道设置 `non_stream_to_stream_enabled`。

支持范围：

- OpenAI-compatible chat completions。
- 用户请求是非流。
- 非透传请求体。
- 已覆盖 OpenAI/OpenRouter/Xinference、Anthropic、Gemini/Vertex 相关路径。

注意：

- 用户侧仍收到非流 JSON，不是 SSE。
- 开启后需观察 tool calls、reasoning、usage 聚合是否符合预期。

## 头像缓存排查

历史问题分三层：

- 跨页丢失：页面重新拉取用户数据覆盖 `_avatar_t`。
- 重新登录丢失：logout 后本地 `_avatar_t` 清空，login 响应没有该字段。
- 服务端强缓存：旧 ETag 只看 id-len，同大小头像不更新。

当前方案：

- `setUser` 保留旧 `_avatar_t`。
- 重新登录且 `has_avatar` 时自动生成 `Date.now()`。
- 头像 URL 加 `?t=`。
- 服务端 ETag 使用 CRC32(data)，`Cache-Control: no-cache`。

## 日志刷新延迟

历史问题：

- 日志页默认结束时间固定为页面打开时刻，刷新后看不到更晚的新日志。

当前方案：

- 默认结束时间为空。
- 顶部刷新与今日卡片刷新会回到第一页拉最新日志。
- 今日消耗与空回候选同步刷新。
- 列表请求使用请求序号保护，避免旧请求覆盖新结果。

## Claude thinking 400

现象：

- OpenAI 格式转 Claude 时上游返回 `top_p must be greater than or equal to 0.95 or unset when thinking is enabled`。
- 或返回 `Request contains an invalid argument`。

根因：

- OpenAI 格式客户端常默认带 `temperature`、`top_p`、`top_k`、`tool_choice`。
- Claude extended thinking 与这些参数存在约束冲突。

当前处理：

- thinking 启用时移除 `temperature`、`top_k`。
- `top_p` 不在 `[0.95, 1]` 时移除。
- 强制工具调用降级为 `auto`。
- OpenAI 转 Claude、原生 Claude、Vertex Claude 透传均走同一清洗逻辑。

## 常见用户报错文档

用户侧常见报错已单独沉淀：

- `docs/user-error-qa.md`

目前已覆盖：

- `Invalid URL (POST /v1)`。
- Claude 工具调用 `tool_result` 不匹配。
- assistant message prefill。
- `auth_exhausted: no available account`。

后续客服类问题优先补充该文档，不要散落在记忆库。
