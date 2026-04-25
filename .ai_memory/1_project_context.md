# 项目核心知识库

## 部署架构

- 服务器：4C4G，MySQL 数据库，650 用户，峰值并发 9
- 测试用远程 MySQL：38.150.2.234:30502/zeabur，NODE_TYPE=slave 跳过迁移
- 启动命令（bash）：`NODE_TYPE=slave SQL_DSN='root:...@tcp(38.150.2.234:30502)/zeabur' ./new-api.exe`
- 注意：旧二进制 newapi.exe 和新 new-api.exe 可能共存，确认用对文件

## uiweb 技术选型（已敲定）

- 前端：Vite 5 + React 18 + JSX（不用 TypeScript）
- 样式：Tailwind CSS 3 + 自研 clay 组件
- 图标：lucide-react
- 路由：react-router-dom 6，`basename="/u"`
- Vite `base: '/u/'`，dev 端口 5174，代理 `/api` `/v1` → localhost:3000
- 包管理：开发机 npm/npx（bun 未装），Dockerfile 走 oven/bun:1

## 用户业务约束

- 注册方式：仅 QQ 邮箱
- 充值方式：仅兑换码（TopUp 页已去掉在线支付板块）
- 语言：仅中文，不需要 i18n
- 不需要：2FA、Passkey、Turnstile、OAuth 绑定、在线支付

## 路由策略

- `/u/*` → uiweb（黏土风）
- `/*` → 原 web（完全不动）
- 登录后默认跳 `/u/dashboard`

## 组件体系

### Clay 组件（15 个）
ClayCard / ClayButton / ClayInput / ClayToggle / ClayCheckbox / ClayField / ClayAlert / ClayDivider / ClayLink / ClaySelect / ClayTabs / ClayStat / ClayModal / ClayProgress / ClayAvatar

### Layout 组件
ClayNav / ClayFooter / ClayPageShell / ClayAuthShell / ClayConsoleShell / ProtectedRoute

### Context（3 个）
StatusContext（含 persistStatusFields 调用）/ UserContext / ToastContext

## 页面清单

### 访客页（13 路由）
Home / Login / Register / ResetRequest / ResetConfirm / OAuthCallback / Setup / About / UserAgreement / PrivacyPolicy / Pricing / **ModelStatus** / Forbidden / NotFound

### 登录后页（7 路由）
Dashboard / TokenManage / LogList / TopUp / Checkin / PersonalSetting / Chat2Link

### 公共导航（ClayNav）
首页 / 定价 / **状态** / 关于

### 控制台导航（ClayConsoleShell NAV）
仪表盘 / 令牌 / 日志 / 充值 / 签到 / 设置

## Services 层

api.js / auth.js / tokens.js / logs.js / checkin.js / user.js / dashboard.js / topup.js / pricing.js / **modelStatus.js**

## 关键实现细节

- 余额转换：quotaToDisplay() 读 localStorage 的 quota_per_unit / quota_display_type
- 余额反转换：displayToQuota() 将展示金额转回内部额度值（令牌创建/编辑用）
- 签到 API 路径：`/api/user/checkin`（selfRoute 前缀 `/api/user/`）
- 模型状态 API：`GET /api/model-status?window=1h|6h|12h|24h`（公开，无需认证）
- 模型状态 SQL：abilities JOIN channels（status=1, enabled=true）获取模型列表，logs 表 FLOOR 分槽聚合
- LogSqlType 陷阱：LOG_SQL_DSN 为空时 LOG_DB=DB 但 LogSqlType 保持默认 SQLite，需用 `UsingMySQL`/`UsingPostgreSQL` 辅助判断

## 构建指标

- ~1683 modules，~1.8s build
- ~331KB JS + ~40KB CSS（gzip ~104KB + ~7KB）

## Go 端接入

- main.go embed uiweb/dist + router/uiweb-router.go SPA fallback
- controller/model_status.go — 模型状态监控端点
- Dockerfile 已接入 uiweb-builder 并行 stage
