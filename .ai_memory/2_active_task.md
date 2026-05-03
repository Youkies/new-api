# 当前任务

## 当前任务：完善新 UI 页面配置与移动端细节（2026-05-03）

### 已加载状态

- 上一阶段活动任务是后端 `non_stream_to_stream_enabled` 扩展到 Gemini/Vertex；本轮任务切换到新 `uiweb` 前端运营配置与兼容性修正。
- 关键判断：新 UI 后台不复刻经典管理端，只把高频运营项放进轻量后台；当前最需要经常编辑的是 `/api-urls` 地址列表，首页文案/提示语暂不后台化。

### 本轮实现状态

- 已新增 `ui_page_configs` 单例配置模型与 `/api/ui/page-config`、`/api/ui/admin/page-config` 接口，使用 `common.Marshal` / `common.UnmarshalJsonStr` 存取 API 地址 JSON。
- 已新增 `/admin/page-config` 管理页，可增删、排序、启停并编辑 `/api-urls` 的 URL、名称、说明、图标和色彩。
- 已改 `/api-urls` 页面从配置接口加载地址，失败时回退默认地址，并保留复制后的 `/v1` 使用提示。
- 已新增 `copyTextToClipboard()`，令牌页与 API 地址页复制均在 Clipboard API 失败时回退到 `textarea + execCommand('copy')`。
- 已修复移动端模型状态卡片：模型名在窄屏允许换行显示，桌面端仍保持单行截断。
- 已收窄 `uiweb/vite.config.js` 开发代理为 `^/api(/|$)` / `^/v1(/|$)`，避免 `/api-urls` 被 dev proxy 误转发。
- 已更新调试模式 mock：覆盖页面配置读写接口。
- 检查并纳入此前留下的 relay/error 改动：客户端主动断开时归一化为 499、跳过重试和错误日志，避免误记为上游失败。
- 修复 `service/channel_affinity_usage_cache_test.go` 测试 key 在 Windows 上因时间粒度导致碰撞的问题，改为原子递增唯一值。

### 验证

- `go test ./service ./model ./controller ./router ./relay ./relay/channel/openai ./relay/channel/gemini` 通过。
- `npm run build`（`uiweb`）通过；本机未安装 `bun`，因此未使用 `bun run build`。
- `git diff --check` 通过。

### 下一步

- 如生产环境 `NODE_TYPE=slave` 继续跳过 AutoMigrate，部署前需要手动创建 `ui_page_configs` 表，或临时依赖前端默认地址回退。
- `.tmp_mysql_migration/` 为本地 MySQL 迁移临时目录，包含 msi/exe/SQL dump，不应纳入提交。
