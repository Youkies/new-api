# uiweb — NewAPI Clay Edition

黏土风（Claymorphism）用户前端，与原 `web/` 并存。

- 挂载路径：`/u/*`（由 `newapi` Go 后端的第二组 `//go:embed` 提供）
- 原 `web/` 保留在 `/`，完全不改动
- 这里只负责**普通用户页面**（访客 + 登录后的用户漏斗）；管理员页面仍走原 `web/`

## 开发

```bash
cd uiweb
bun install
bun run dev
# 打开 http://localhost:5174/u/
```

`/api` 与 `/v1` 已代理到 `http://localhost:3000`（本机 newapi），可直接联调。

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
