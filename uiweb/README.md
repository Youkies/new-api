# uiweb — NewAPI Clay Edition

黏土风（Claymorphism）用户前端，与原 `web/` 并存。

- 挂载路径：`/*`（由 `newapi` Go 后端 `//go:embed uiweb/dist` 提供）
- 原 `web/` 保留在 `/legacy/*`
- 这里负责新 UI 访客页、用户控制台，以及轻量运营管理端

## 开发

```bash
cd uiweb
bun install
bun run dev
# 打开 http://localhost:5174/
```

`/api` 与 `/v1` 已代理到 `http://localhost:3001`（本机 newapi 调试实例），可直接联调。

### 会员身份展示

控制台会按用户 `group` 显示四档身份：普通用户、Pro优、Super优、Ultra优。分组升级由外部系统处理，前端只读取当前用户分组并展示身份，不提供升级入口。

### UI 调试模式

不连接后端数据库时，可以启用前端-only mock：

```bash
VITE_UI_DEBUG_MODE=true bun run dev
```

也可以在 Vite 开发环境打开任意页面时追加 `?debug=1`，例如：

```text
http://127.0.0.1:5174/dashboard?debug=1
```

启用后会自动使用 mock 管理员、mock API 数据和左下角 `UI DEBUG` 快捷面板，可直接跳转用户控制台、公告管理、申诉审核、AI 助手配置等页面。关闭方式：点击调试面板里的“关闭本地调试模式”，或访问 `?debug=0`。

## 构建

```bash
bun run build
# 输出到 uiweb/dist,会被 Go 端 //go:embed uiweb/dist 打包
```

## 目录

```
src/
  components/clay/   Clay 基础组件 (Button / Card / Input / Toggle)
  pages/             页面
  i18n/              之后接入（复用原 web locales）
```

## 路线

- Stage 0：骨架 + Home demo ← **当前**
- Stage 1：访客 10 页（Login/Register/Reset/Setup/About/UserAgreement/PrivacyPolicy/Forbidden/OAuth/Pricing）
- Stage 2：Dashboard / TopUp / PersonalSetting / Chat2Link
- Stage 3：Token / Log / Midjourney / Task
- Stage 4：Playground / Chat
