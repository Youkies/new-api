# uiweb 总览

## 定位

`uiweb` 是项目的主 UI，面向用户侧体验和轻量站点运营。它不复刻官方完整管理后台，重管理功能优先保留在 `/legacy/` classic UI。

当前边界：

- 用户侧：仪表盘、令牌、日志、充值、签到、设置、AI 助手、通知、公告、定价、模型状态、API 地址。
- 轻管理：公告、通知策略、空回申诉审核、页面配置、AI 助手配置。
- 重管理：渠道、模型、系统设置、复杂计费配置等，优先在 `/legacy/` 中处理。
- 官方 default UI：保留 `/default/` 作备用和参考，不作为主入口。

## 技术选型

- 前端：Vite 5 + React 18 + JSX，不使用 TypeScript。
- 样式：Tailwind CSS 3 + 自研 Clay 组件。
- 路由：`react-router-dom` 6，`Vite base: '/'`。
- 图标：`lucide-react` 用于界面图标，`@lobehub/icons` v2 用于供应商/模型图标。
- 主题：`ThemeProvider` 支持 `system` / `light` / `dark`，本地 key 为 `uiweb.theme.mode`。
- 深色主题：Moon Clay，通过 `html[data-theme]` 与 CSS variables 驱动。
- 调试模式：`VITE_UI_DEBUG_MODE=true`，或 Vite dev 环境 URL 加 `?debug=1`。

关键路径：

- 入口：`uiweb/src/main.jsx`、`uiweb/src/App.jsx`
- 全局样式：`uiweb/src/index.css`
- Clay 组件：`uiweb/src/components/clay/*`
- 布局组件：`uiweb/src/components/layout/*`
- 服务层：`uiweb/src/services/*`
- 调试模式：`uiweb/src/utils/debugMode.js`、`uiweb/src/components/debug/DebugModePanel.jsx`

## 路由策略

Go 端路由：

- `/*`：`uiweb` SPA fallback。
- `/default`：301 到 `/default/`。
- `/default/*`：官方新版 default UI。
- `/legacy`：301 到 `/legacy/`。
- `/legacy/*`：官方 classic UI。
- `/classic` 与 `/classic/*`：301 到 `/legacy/`。
- `/u/*`：301 到根路径，兼容旧链接。
- `/api/*` 与 `/v1/*`：API，不受前端 fallback 影响。

前端页面清单：

- 访客页：`Home`、`Login`、`Register`、`ResetRequest`、`ResetConfirm`、`OAuthCallback`、`Setup`、`About`、`UserAgreement`、`PrivacyPolicy`、`Pricing`、`ModelStatus`、`Forbidden`、`NotFound`。
- 登录后页：`Dashboard`、`TokenManage`、`LogList`、`TopUp`、`Checkin`、`PersonalSetting`、`Chat2Link`、`ApiUrls`、`PaymentReturn`、`Notifications`。
- 管理页：`AdminHome`、`AdminAnnouncements`、`AdminNotifications`、`AdminRefundAppeals`、`AdminAssistant`、`AdminPageConfig`。

## 组件体系

Clay 组件：

- `ClayCard`
- `ClayButton`
- `ClayInput`
- `ClayToggle`
- `ClayCheckbox`
- `ClayField`
- `ClayAlert`
- `ClayDivider`
- `ClayLink`
- `ClaySelect`
- `ClayTabs`
- `ClayStat`
- `ClayModal`
- `ClayProgress`
- `ClayAvatar`

布局组件：

- `ClayNav`
- `ClayFooter`
- `ClayPageShell`
- `ClayAuthShell`
- `ClayConsoleShell`
- `ClayAdminShell`
- `ProtectedRoute`
- `AdminRoute`
- `ThemeToggle`

Context：

- `StatusContext`
- `UserContext`
- `ToastContext`
- `ThemeContext`
- `NotificationContext`

## 设计与产品边界

- 界面主要面向中文用户。
- 注册仅 QQ 邮箱。
- 充值以兑换码 + ePay 在线充值为主。
- 不主动做 2FA、Passkey、Turnstile、OAuth 绑定等复杂账户管理入口。
- 移动端优先优化用户端；管理端主要按桌面使用场景处理，只保持基本可访问。
- 不在 `uiweb` 堆过多重管理功能，避免与官方上游同步时持续冲突。

## 已知构建特征

- `vendor-icons` 独立 chunk 约 4.2MB，gzip 约 810KB，是引入 `@lobehub/icons` 后的已知体积成本。
- 当前开发机历史上多用 npm/npx；Dockerfile 构建阶段使用 `oven/bun:1`。
- 官方 `v1.0.0-rc.4` 合并后，`uiweb`、`web/default`、`web/classic` 均曾完成 build 验证。
