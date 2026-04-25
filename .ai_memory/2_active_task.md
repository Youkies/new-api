# 当前任务

## 状态：头像功能已上线，等待部署验收

## 已完成

### Stage 1（访客页）— 13 路由
Home / Login / Register / ResetRequest / ResetConfirm / OAuthCallback / Setup / About / UserAgreement / PrivacyPolicy / Pricing / ModelStatus / Forbidden + NotFound

### Stage 2（登录后页）— 7 路由
Dashboard / TokenManage / LogList / TopUp / Checkin / PersonalSetting / Chat2Link

### Stage 2++（页面打磨 + 新功能）
- Pricing 页分组展示
- Token 页增加详细列
- Log 页合并 token 用量列、额度着色、错误行红底
- TopUp 页增加购买链接卡片，兑换码+购买卡片并排等高布局
- ModelStatus 公开页面（/u/status）：60s 自动刷新，2 列卡片网格
- Go 端 controller/model_status.go + /api/model-status

### Bug 修复
- 余额显示 token 数而非货币：StatusContext persistStatusFields
- 签到 404：API 路径修正
- 模型状态 SQL：LogSqlType/FLOOR 兼容
- 构建部署链：vite build → go build → 杀进程 → PowerShell 启动

### Stage 3（日志页增强）
- LogList Token 用量列增加缓存读写 token（从 other JSON 解析 cache_tokens / cache_creation_tokens）
- 耗时列改为"用时/首字"：显示 use_time(秒) + frt(首字延迟，毫秒转换)，流/非流标签
- 详情列移除，改为行点击弹出 ClayModal 详情弹窗（基本信息 + Token 用量含缓存 + 耗时含首字 + 额度 + 内容）
- 筛选面板对齐（ClaySelect 手动加 label 包裹与 ClayField 统一高度）
- 时间范围默认今天 00:00 到当前时间

### Bug 修复（Stage 3）
- use_time 单位是秒不是毫秒
- frt 负值（-1000）需过滤，仅正值显示
- parseOther/getCacheTokens 空值保护（JSON.parse 可能返回 null）

### Stage 3+（日志页视觉重构 + 移动端适配）
- LogList 视觉重构：从独立 grid 卡片改为 table 布局（对齐令牌管理页风格），行高增加
- 移动端适配：新增 useIsMobile hook + LogCard 组件，<767px 自动切换为卡片列表
- Token 用量图标全部改为文字标签（入/出/缓读/缓写），桌面+移动+详情弹窗三处同步

### Stage 3++（令牌管理增强 + 移动端适配）
- TokenManage 移动端适配：新增 TokenCard 组件，<767px 自动切换卡片列表（与 LogList 同模式）
- 新建/编辑弹窗增加分组选择（ClaySelect，数据来自 /api/user/self/groups）
- 默认无限额度（unlimited_quota: true）
- 关闭无限额度后输入展示金额（余额）而非内部 token 额度，新增 displayToQuota 转换函数

### Dashboard 用量趋势重构
- 修复时间范围计算：今日从 0 点开始，不再用 now-24h
- 今日模式按小时分组（0时~当前小时），7/30天按天分组
- 预填所有时间槽（无数据日/时也显示最小柱子）
- 柱状图从 CSS 百分比高度改为像素高度（BAR_AREA_H=180px），修复 flex 布局下百分比高度不生效的 bug
- 内凹托盘容器 + 渐变柱状图 + clay 浮动提示 + 移动端 30 天水平滚动

### Pricing 页重做（供应商图标 + 价格修正 + 卡片布局）
- 引入 @lobehub/icons v2 + vendorIcon.jsx 动态解析 + 4 个 stub 模块
- 修正价格公式：按量 `model_ratio * 2 * groupRatio`，按次 `model_price * groupRatio`
- 修正 API 数据解析（vendors/groups 从 res 读取而非 res.data）
- 卡片网格布局（3 列）+ 分组筛选 + 供应商下拉 + 搜索
- 统一 3 行价格槽等高卡片 + Clay 内凹标签 + AiMass 未知图标 fallback

### 品牌化 + 路由重组 + 头像功能
- uiweb 品牌化："New API" → "Youkies API"，共 12 个文件
- uiweb 升级为根路由前端（vite base `/` + React Router 去 basename）
- 经典 web 前端挂载到 `/legacy/*filepath`
- `/u/*` 301 重定向到根路径
- Dashboard/Chat2Link 令牌链接修复（`/console/token` → `/tokens`）
- 用户头像功能（BLOB ≤200KB）：
  - 后端：model/user.go Avatar 字段 + controller/avatar.go 上传/获取/删除 API
  - 前端：react-easy-crop 圆形裁剪预览 + canvas 压缩 + 上传
  - 显示：个人设置页、控制台导航栏、首页导航（移动端仅头像）
  - 移除头像按钮（恢复默认字母头像）
  - cache-bust 机制：上传后 `_avatar_t` 时间戳刷新所有头像 URL
  - 移动端优化：控制台导航只显示头像圆形，首页登录只显示头像

## 下一步

待用户验收后决定：
- A：PersonalSetting 精简（去绑定 tab、去 Passkey/2FA）
- B：Stage 3（Midjourney / Task 页面）
- C：Stage 4（Playground 15 组件 + Chat）
- D：跑完整端到端验收

## 风险 / 未做

- PersonalSetting 密码修改、2FA 管理仍桥接经典控制台
- 未做管理员路由守卫
- Playground 仍跳经典控制台
- NODE_TYPE=slave 部署时新增 DB 列需手动 ALTER TABLE
