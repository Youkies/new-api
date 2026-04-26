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

## 2026-04-25 — Pricing 页重做：供应商图标 + 价格公式修正 + 卡片布局

- 引入 `@lobehub/icons` v2 供应商图标库，通过 `vendorIcon.jsx` 动态解析字符串（如 `"Claude.Color"`）为 React 组件
- 关键坑：`@lobehub/icons` 即使只导入 `es/icons` 仍通过 Avatar/Combine 子组件间接依赖 antd/antd-style/@lobehub/ui/react-layout-kit → 创建 4 个 stub 模块 + vite alias 避免拉入巨型依赖
- 价格公式修正：按量 `model_ratio * 2 * groupRatio`（USD/1M tokens），按次 `model_price * groupRatio`（USD/次）
- API 响应结构确认：`res.data` 是模型数组，`res.vendors`/`res.group_ratio`/`res.usable_group` 是 response 对象的同级字段（非 `res.data` 下属）
- 布局从表格改为卡片网格（3 列），统一 3 行价格槽保证等高，Clay 内凹标签（按量/按次）
- 构建产物增大至 ~4155 modules，vendor-icons chunk ~4.2MB（gzip ~810KB）独立分块

## 2026-04-26 — 品牌化 + 路由重组 + Zeabur Git 部署

- "New API" → "Youkies API" 品牌化（12 个前端文件）
- uiweb 升级为根路由前端：vite base `/` + React Router 去 basename + uiweb-router.go 重写
- 经典 web 挂载到 /legacy/*filepath（从全局 middleware 改为显式 GET 路由）
- /u/* 301 重定向兼容旧链接
- 从手动 Docker 推送改为 Zeabur Git 部署（GitHub push 自动构建）
- 关键坑：NODE_TYPE=slave 跳过 AutoMigrate，新增 DB 列需手动 ALTER TABLE
- 关键坑：Zeabur 自定义域名需正确 CNAME → DNS INVALID_DNS → SSL 不签发 → Chrome 提示不安全

## 2026-04-26 — 用户头像功能（BLOB 存储 + 裁剪预览）

- 设计决策：头像压缩后存 DB BLOB（≤200KB），不用 S3/对象存储，2000 用户量约 80-120MB 完全可接受
- 后端：User 表新增 avatar LONGBLOB + avatar_type VARCHAR(32)；GetUserById/GetAllUsers/SearchUsers 均 omit avatar 避免性能问题
- controller/avatar.go：上传校验（200KB + 图片类型）、获取（ETag + 86400s cache）、删除
- GetSelf/setupLogin 新增 has_avatar 字段
- 前端：react-easy-crop 圆形裁剪弹窗 + 缩放滑块 + canvas JPEG 压缩 + 确认上传
- cache-bust 方案：user 对象挂 _avatar_t 时间戳，所有头像 URL 带 ?t= 参数
- 移动端优化：控制台导航只显示头像圆形（去掉背景框+文字），首页登录只显示头像（隐藏"进入控制台"按钮）
- 部署坑：NODE_TYPE=slave 不跑迁移，需手动 ALTER TABLE 加列（Zeabur MySQL 面板逐条执行）

## 2026-04-26 — system_prompt_to_user_prompt + 国内中转

- 问题：上游 Claude 渠道固定死 Claude Code 系统提示词，用户自己的 system prompt 被覆盖
- 方案：新增 `system_prompt_to_user_prompt` 渠道设置，将 system 转为 user 消息保留用户指令
- 实现：ChannelSettings 新字段 + ClaudeRequest.ConvertSystemToUserMessages()，覆盖 ClaudeHelper/TextHelper/via-responses 三路径
- 前端 EditChannelModal 额外设置区新增开关 + 7 语言 i18n
- 国内中转：腾讯云 81.71.120.210 Nginx 反代 newapi.youkies.cn → newapi.youkies.space
- 关键配置：proxy_buffering off（SSE）、timeout 1000s、Let's Encrypt SSL
- 流量模型：全部经过国内服务器双向中转，需注意带宽和流量配额

- 头像缓存问题分三层逐步定位修复：
  1. 跨页丢失：Dashboard/TopUp 等页面 setUser(r.data) 覆盖 _avatar_t → setUser 自动保留旧值
  2. 重新登录丢失：logout 清除 _avatar_t，login 响应无此字段 → setUser 发现 has_avatar 时自动生成 Date.now()
  3. 服务端强缓存：ETag 只用 id-len（同大小不变）+ max-age=86400 → 改为 CRC32(data) + no-cache
- 经典控制台白屏：web 原 base='/' + 无 basename，挂到 /legacy/ 后 asset 路径和 React Router 全部失败 → vite base '/legacy/' + BrowserRouter basename="/legacy"（Dockerfile bun 构建生效，本地 npm 构建有 semi-ui 兼容问题）
- /legacy 不带斜杠 404：Gin wildcard `/legacy/*filepath` 不匹配无斜杠路径 → 加显式 GET /legacy → 301
- 自定义 favicon：PNG 图标替换 lucide Box，影响 ClayNav / ClayConsoleShell / ClayAuthShell 三处
- 签到倒计时：CountdownTimer 组件，clay 内凹方块 HH:MM:SS，服务端 0 点刷新（time.Now 日期判断）
- 远程 MySQL 密码已更新（旧密码 123456 失效）

