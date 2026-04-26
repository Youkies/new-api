# 项目核心知识库

## 部署架构

- 生产环境：Zeabur（Git 部署，GitHub push 自动构建）
- 数据库：Zeabur MySQL 服务，数据库名 `zeabur`
- NODE_TYPE=slave：跳过 AutoMigrate，新增列需手动 ALTER TABLE
- 测试用远程 MySQL：38.150.2.234:30502/zeabur
- 启动命令（bash）：`NODE_TYPE=slave SQL_DSN='root:...@tcp(38.150.2.234:30502)/zeabur' ./new-api.exe`
- 海外域名：newapi.youkies.space（DNS 指向 Zeabur）
- 国内中转域名：newapi.youkies.cn（已备案，Nginx 反代 → 海外服务器）

## 国内中转

- 服务器：81.71.120.210（腾讯云，Ubuntu 24.04）
- Nginx 反代：/etc/nginx/sites-enabled/newapi.conf
- SSL：Let's Encrypt 自动续期（到期 2026-07-25）
- 关键配置：proxy_buffering off（SSE 流式）、proxy_read_timeout 1000s
- 同机还运行 lobe.youkies.cn（LobeChat）

## uiweb 技术选型（已敲定）

- 前端：Vite 5 + React 18 + JSX（不用 TypeScript）
- 样式：Tailwind CSS 3 + 自研 clay 组件
- 图标：lucide-react（UI 图标）+ @lobehub/icons v2（供应商/模型图标）
- Logo/Favicon：自定义 PNG（uiweb/public/favicon.png），导航栏 logo 用 `<img>` 替代 lucide Box
- 供应商图标：`vendorIcon.jsx` 的 `getLobeHubIcon(iconName, size)` 解析点号字符串（如 `"Claude.Color"`）为 React 组件，fallback 为 AiMass
- @lobehub/icons stub：4 个 stub 模块（antd/antd-style/react-layout-kit/@lobehub/ui）通过 vite alias 屏蔽 Avatar/Combine 子组件的间接依赖
- 裁剪库：react-easy-crop（头像上传裁剪预览）
- 路由：react-router-dom 6，根路径（无 basename）
- Vite `base: '/'`，dev 端口 5174，代理 `/api` `/v1` → localhost:3000
- 包管理：开发机 npm/npx（bun 未装），Dockerfile 走 oven/bun:1

## 用户业务约束

- 注册方式：仅 QQ 邮箱
- 充值方式：仅兑换码（TopUp 页已去掉在线支付板块）
- 语言：仅中文，不需要 i18n
- 不需要：2FA、Passkey、Turnstile、OAuth 绑定、在线支付

## 路由策略

- `/*` → uiweb（黏土风，根路由前端）
- `/legacy` → 301 重定向到 `/legacy/`（Gin wildcard 不匹配无斜杠）
- `/legacy/*` → 原 web 经典界面
- `/u/*` → 301 重定向到根路径（兼容旧链接）
- `/v1/*`, `/api/*` → API 路由不受影响
- FRONTEND_BASE_URL 在 master 节点被忽略

## 头像功能

- 存储：User 表 `avatar` LONGBLOB + `avatar_type` VARCHAR(32)
- 上限：200KB，前端 canvas 压缩为 JPEG
- API：`POST/DELETE /api/user/avatar`（需登录）、`GET /api/user/avatar/:id`（公开，ETag=CRC32 + no-cache）
- 前端裁剪：react-easy-crop 圆形裁剪 + 缩放滑块 + 确认弹窗
- cache-bust：`_avatar_t` 时间戳挂在 user 对象上，所有头像 URL 带 `?t=`
  - 页面导航：setUser 自动保留旧 `_avatar_t`
  - 重新登录：setUser 发现 `has_avatar` 但无 `_avatar_t` 时自动生成 `Date.now()`
  - 服务端：ETag 用 CRC32(data) 内容哈希 + `Cache-Control: no-cache`（每次验证）
- 批量查询（GetAllUsers/SearchUsers）omit avatar 字段避免性能问题
- 移动端：控制台导航只显示头像圆形（40px，无背景框无文字），首页登录只显示头像

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
- 签到刷新逻辑：服务器本地 `time.Now().Format("2006-01-02")` 判断，0 点刷新
- 签到倒计时：CountdownTimer 组件，今日已签到后显示到午夜 HH:MM:SS（浏览器本地时间）
- 定价公式：按量 `model_ratio * 2 * groupRatio`（USD/1M tokens），按次 `model_price * groupRatio`（USD/次）
- 定价 API 响应结构：`res.data` = 模型数组，`res.vendors` / `res.group_ratio` / `res.usable_group` 是 response 同级字段
- 模型状态 API：`GET /api/model-status?window=1h|6h|12h|24h`（公开，无需认证）
- 模型状态 SQL：abilities JOIN channels（status=1, enabled=true）获取模型列表，logs 表 FLOOR 分槽聚合
- LogSqlType 陷阱：LOG_SQL_DSN 为空时 LOG_DB=DB 但 LogSqlType 保持默认 SQLite，需用 `UsingMySQL`/`UsingPostgreSQL` 辅助判断

## 构建指标

- ~4166 modules，vendor-icons chunk ~4.2MB（gzip ~810KB）独立分块
- 主 JS ~373KB + CSS ~44KB + vendor-icons 独立 chunk

## Go 端接入

- main.go embed uiweb/dist + router/uiweb-router.go 根路由前端 + SPA fallback
- router/web-router.go — 经典前端挂载到 /legacy/*filepath
- controller/model_status.go — 模型状态监控端点
- controller/avatar.go — 头像上传/获取/删除
- Dockerfile 已接入 uiweb-builder 并行 stage
