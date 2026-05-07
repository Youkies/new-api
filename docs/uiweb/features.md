# uiweb 用户侧功能

## 首页

页面：`uiweb/src/pages/Home.jsx`

关键行为：

- 已登录用户在顶部导航右侧显示头像入口，移动端不额外展示完整身份铭牌。
- 未登录用户首页顶部导航不显示“登录/注册”，登录和注册按钮放在顶部品牌与 `AI Gateway · Clay Edition` 小标题之间，高度与 `Youkies API` 品牌胶囊一致，避免移动端顶部拥挤。

## Dashboard

仪表盘展示账户概览、余额、使用趋势和常用入口。早期实现中修复了今日时间范围与趋势柱状图高度问题，并使用 Clay 内凹托盘与渐变柱提升可读性。

关键点：

- 余额展示依赖 `quotaToDisplay()`。
- `StatusContext` 会持久化 `quota_per_unit` 与 `quota_display_type`，否则余额展示会不准。
- 快捷入口指向令牌、日志、充值、签到、设置等用户侧页面。

## 令牌管理

页面：`uiweb/src/pages/TokenManage.jsx`

能力：

- 令牌 CRUD。
- 创建/编辑令牌时支持分组选择。
- 额度输入使用展示金额，提交前通过 `displayToQuota()` 转为内部额度。
- 移动端有专门 Token card 布局，密钥展示为凹槽样式。

注意：

- 令牌搜索区移动端按钮已收紧为固定小尺寸图标按钮，避免输入框和按钮高度不齐。
- 余额输入和展示必须遵守当前 `quota_per_unit` / `quota_display_type`。

## 日志页

页面：`uiweb/src/pages/LogList.jsx`

能力：

- 消费日志与非消费日志均可读。
- 顶部有“今日消耗”卡片，独立请求 `/api/log/self/stat`。
- 筛选使用 draft/applied 双状态，避免输入过程中频繁请求。
- 时间筛选使用自绘 `ClayDateTimeField`，不是浏览器原生 `datetime-local`。
- 桌面端筛选弹窗不使用内部滚动；时间选择器作为浮层展开，避免弹窗内出现独立滚动条并遮住操作按钮。
- 移动端使用卡片布局，非消费日志详情不截断。

空回申诉入口：

- 静默检测最近 48 小时疑似空回。
- 只有存在候选记录或待审核申诉时才显示入口/状态。
- 提交后可打开申诉记录弹窗查看状态。

## 充值页

页面：`uiweb/src/pages/TopUp.jsx`

当前策略：

- 保留兑换码充值与在线支付区域。
- 旧的“购买额度/前往购买”外链卡片已移除。
- 充值成功可进入通知中心生成到账通知，具体策略见 [管理端与运营功能](./admin.md)。

## 签到页

页面：`uiweb/src/pages/Checkin.jsx`

关键行为：

- 签到 API 路径为 `/api/user/checkin`。
- 后端按 `CHECKIN_TIMEZONE` 计算日期，默认 `Asia/Shanghai`。
- Dockerfile 设置 `TZ=Asia/Shanghai`。
- `GetCheckinStatus` 返回 `server_now` 与 `next_checkin_at`，前端用时钟偏移修正倒计时。
- 日历格子使用自适应正方形，签到金额在格子内轻量显示纯数字。

分组签到：

- 默认范围仍来自 `checkin_setting.min_quota` / `max_quota`。
- 分组覆盖来自 `checkin_setting.group_quotas`。
- 支持 `standard` / `standard优`、`pro` / `pro优`、`super` / `super优` / `spuer`、`ultra` / `ultra优` 等归一化匹配。

## 定价页

页面：`uiweb/src/pages/Pricing.jsx`

实现要点：

- 从 `/api/pricing` 获取模型定价。
- 响应中 `res.data` 是模型数组，`res.vendors`、`res.group_ratio`、`res.usable_group`、`res.group_details` 与 `data` 同级。
- 默认展示全部模型，不再提供独立供应商筛选；用户主要通过模型名称搜索和分组筛选收敛列表。
- 桌面端保留分组胶囊墙，鼠标悬浮或键盘聚焦某个分组时显示 Clay 悬浮详情，包含分组简介、模型数量、倍率和详细介绍。
- 移动端通过“查看分组”弹窗选择分组；弹窗顶部的倍率提示跟随当前 `user.group` 与实际可用分组动态显示，分组列表展示简介、模型数量和倍率，选中后关闭弹窗并在页面顶部展示当前分组与详细介绍。
- 按量公式：`model_ratio * 2 * groupRatio`，单位 USD/1M tokens。
- 按次公式：`model_price * groupRatio`，单位 USD/次。
- 使用 `@lobehub/icons` 展示供应商图标；未知图标 fallback 为 `AiMass`。

## 模型状态页

页面：`uiweb/src/pages/ModelStatus.jsx`

接口：`GET /api/model-status?window=1h|6h|12h|24h`

能力：

- 公开访问，无需认证。
- 支持 1h、6h、12h、24h 时间窗口。
- 展示加权 SLA、请求数、可用率、时间桶柱状图。
- 数据来自 abilities、channels 与 logs 聚合。

关键坑：

- `LOG_SQL_DSN` 为空但日志用主库时，`LogSqlType` 可能仍保持默认 SQLite。
- SQL 分支应按 `UsingMySQL` / `UsingPostgreSQL` / `UsingSQLite` 判断，而不是只看 `LogSqlType`。

## API 地址页

页面：`uiweb/src/pages/ApiUrls.jsx`

能力：

- 展示通用地址与国内优化地址。
- 支持一键复制。
- 复制后提示“地址不带 `/v1`，部分软件需自行追加”。
- 可通过“不再提示”写入 `localStorage`：`uiweb.apiUrls.suppressV1Notice=1`。
- 后台页面配置可改地址列表，见 [管理端与运营功能](./admin.md)。

## 头像

页面：`uiweb/src/pages/PersonalSetting.jsx`

能力：

- 上传、裁剪、删除头像。
- 前端使用 `react-easy-crop` 圆形裁剪，并压缩为 JPEG。
- 后端限制 200KB。
- 头像公开获取，方便导航和公共头像展示。

缓存策略：

- 用户对象带 `_avatar_t` cache-bust。
- 头像 URL 统一追加 `?t=`。
- `UserContext#setUser` 保留旧 `_avatar_t`；重新登录且 `has_avatar` 时自动生成时间戳。
- 服务端 ETag 使用 CRC32(data)，并设置 `Cache-Control: no-cache`。

## 会员身份展示

会员档位：

- 普通用户
- Standard 优
- Pro优
- Super优
- Ultra优

规则：

- 通过 `user.group` 识别，兼容历史 `spuer` 拼写。
- 升级由外部项目自动移组，newapi 只展示身份，不提供升级入口。
- 移动端顶部空间有限，不放完整身份铭牌；头像身份色环和角标作为轻量提示。
- 会员铭牌文案可由 `/admin/page-config` 配置，存储在 `ui_page_config.membership_badges` option 中。

## 通知中心

页面：`uiweb/src/pages/Notifications.jsx`

能力：

- 展示个人通知。
- 支持未读筛选、分类筛选、单条已读、单条确认、全部已读。
- 需要确认的通知不能被普通“全部已读”绕过。
- 头像红点表示当前用户有未读通知，不等于公告页有新公告。

移动端策略：

- 页面采用短页头、横向筛选、小统计条和紧凑通知卡。
- 正文默认折叠，需展开正文后才显示“标记已读/我已知晓”，避免长公告撑爆列表。
- 该页面隐藏会员徽章和 AI 助手悬浮按钮，减少空间冲突。

## AI 助手

AI 助手挂载在 `ClayConsoleShell`，作为用户侧问题预诊断工具。详细设计见 [管理端与运营功能](./admin.md) 中的管理配置说明，以及 [API 契约](./api-contracts.md) 中的接口清单。

用户侧能力：

- 问题描述、手动上传/粘贴截图、当前页面路径。
- 流式回复。
- 免费次数每用户每天最多 8 次。
- 免费次数耗尽后，用户确认可用余额续聊。
- 余额续聊走站内 `/pg/chat/completions` 计费链路。
- 支持历史对话、新建对话、删除对话、恢复消息。
- 支持 `<think>...</think>` 思考过程拆分并默认折叠。

边界：

- 不承诺退款。
- 不修改余额。
- 不代替管理员审核。
- 不索要完整 API Key、密码、验证码、支付账号等敏感信息。
