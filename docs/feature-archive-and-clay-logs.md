# 用户模型别名存档 + Clay 日志/令牌重做（feature 分支归档）

> **状态**：feature 分支 `feature/user-model-aliases-and-clay-logs` 已于 2026-05-18 merge 入 `main`（merge commit `362e6cd1`），分支保留远端不删。后续 `main` 上还做了若干 v6.x Clay 收尾迭代（PayMethodIcon、TopUp 凹陷收敛、日志金额提取、token↔archive 互斥等），详见 git log 与 `.ai_memory/3_work_log.md`。
> 主站 `:latest` 现行版本：`main` 最新构建（`ghcr.io/youkies/new-api:latest` digest 由 master 部署节点的 `:latest` pull 决定）。
> 本文档定格在 feature 分支收口时（v6.10），保留作为设计经验归档；当前生产实际行为以代码与 `docs/uiweb/` 专题文档为准。

## 分支与镜像编年表

| 版本 | commit | 镜像 tag | 概要 |
|---|---|---|---|
| v1 | `faaefe3e` | — | 初版 DB + relay hook + 三个 Clay 页面 |
| v2 | `708d085e` | — | LogList 卡片化 + 记录 `requested_model_name` |
| v3.1 | `08846441` | — | 4 点反馈（导航、下拉、中文、冲突；分隔符 `/` → `@`） |
| v3.2 | `7299fadb` | — | 3 点反馈（下拉滚轮 / `/v1/models` 附别名 / LogCard 组 chip） |
| v3.3 | `31b721c7` | — | 日志卡片视觉加粗 + alias card "组"标签消歧 |
| v3.4 | `99e1d054` | — | SyncOptions 噪音清理 |
| v3.5 | `67e307ea` | `feature-aliases-and-clay-logs-67e307ea` | Clay 小胶囊设计模式定型 |
| v4 | `bab13de8` | `feature-aliases-and-clay-logs-bab13de8` | 日志卡片主副标题层级 + 统一类别图标 + 4 位金额 |
| v5 | `c918c3ab` | `feature-aliases-and-clay-logs-c918c3ab` | 凸起阴影修正 + 单 chip + 副标题去冗余 + 令牌存档绑定 chip |
| v5.1 | `d3c50718` | `feature-aliases-and-clay-logs-d3c50718` | 去 clay-card 白边 + 高光降到哑光 |
| v5.2 | `ad332abb` | `feature-aliases-and-clay-logs-ad332abb` | 错误信息条 + 卡片/列表切换 + 移除 mono + break-all |
| v5.3 | `e0ab495a` | `feature-aliases-and-clay-logs-e0ab495a` | 错误信息改纯红字（撤掉胶囊化） |
| v5.4 | `aa428dbb` | `feature-aliases-and-clay-logs-aa428dbb` | 全面提升小胶囊 / 操作按钮的黏土质感 |

**最新镜像 digest**：`sha256:1aac137a81cb394d7c893d147d698df4f9d7445ffe4dd78414be7a2a774f6275`（linux/amd64）

测试机部署：把 docker-compose 的 image tag 改为最新 feature tag，`docker compose pull && docker compose up -d --force-recreate`，硬刷浏览器。

## 后端实现

### 数据模型

`model/user_model_archive.go` 新增两张表，完整 SQL 见 [database-and-migrations.md](uiweb/database-and-migrations.md#用户模型别名存档feature-分支-尚未-merge-main)。

- `user_model_archives`：用户级存档，`(user_id, slug)` 复合唯一，`share_code` 全局唯一（nullable）。
- `user_model_aliases`：存档内别名，`(archive_id, alias_name)` 复合唯一（仅存档内唯一，跨存档可重名）。
- `tokens.archive_id`：nullable int，Token 绑定默认存档。`Token.Update().Select(...)` 白名单已加。
- `logs.requested_model_name`：用户实际输入的模型名（在 relay 改写真实模型之前捕获）。

`model/main.go` 两处 AutoMigrate 列表已加新表。GORM AutoMigrate 三库通用（MySQL / PostgreSQL / SQLite）。

### Relay hook

`service/model_alias.go` `ResolveModelAlias(c, modelName) (string, error)`：

- 插入点：`middleware/distributor.go:38`（`getModelRequest` 之后、所有协议汇聚处）。
- 解析顺序：
  1. `slug@alias` 显式前缀（slug 命中用户存档时）
  2. Token 绑定的默认存档（`tokens.archive_id`）
  3. 都没命中 → 透传
- 命中后改写 `modelRequest.Model` 为 `alias.source_model`，改写 `ContextKeyUsingGroup` 为 `alias.source_group`；二次校验源分组（`service.GroupInUserUsableGroups`）防止存档创建后权限被撤销。
- `ContextKeyUserInputAlias` 保存用户原始输入；`RecordConsumeLog` / `RecordErrorLog` 内部读 context 自动写 `RequestedModelName`，所有调用点零改动。
- `alias.disabled_reason` 非空（分享导入后无权限）直接报错。

路由分隔符使用 `@` 而非 `/`，避开真实模型名常见的 `/`（如 `anthropic/claude-3-5-sonnet`）。slug 未匹配用户任何存档时透传为真实模型名。

### API

`controller/user_model_archive.go` 13 个接口，挂在 `/api/archive`（`UserAuth` 中间件）：

- 存档 CRUD：`GET /` list、`GET /:id` get、`POST /` create、`PUT /:id` update、`DELETE /:id` delete。
- 分享：`POST /:id/share` 开启（生成 10 位短码）、`DELETE /:id/share` 吊销。
- 别名 CRUD：`POST/PUT/DELETE /:id/aliases[/:aliasId]`。
- 别名选项：`GET /options` 返回用户可用 `(group, models[])`，供前端下拉。
- 分享预览：`GET /share/:code`（每个别名标 `accessible`）。
- 分享导入：`POST /share/:code/import`（无权限别名打 `disabled_reason`，不阻断）。

`Token controller` 加 `resolveTokenArchiveId(userId, archiveId)` 校验归属，确保不能绑定别人的存档。

`/v1/models` 在 Token 绑定存档时附带别名（`owned_by="archive-alias"`）。

### 单测

`service/model_alias_test.go` 7 场景全过：透传、命中改写并改 group、未命中透传、disabled 报错、源分组无权限报错、显式前缀命中、显式前缀 miss 报错。

为支持 service 包测试，`model.initCol` 改为导出 `InitCol`，service `TestMain` 调用一次以避免 `commonGroupCol` 为空导致 SQL 拼接出错。

## 前端实现

### 新页面

- `/archives` — `pages/ArchiveList.jsx`：存档列表（卡片网格），新建/编辑/删除/导入按钮。
- `/archives/:id` — `pages/ArchiveDetail.jsx`：存档详情，分享开关 + 复制短码/链接 + 别名 CRUD，源分组级联源模型下拉。
- `/archives/share/:code` — `pages/ArchiveSharePreview.jsx`：分享预览（每个别名标 ✓ 可用 / ⚠ 无权限），导入按钮。

`App.jsx` 加三条受保护路由；`ClayConsoleShell.jsx` 顶部导航加"存档"入口（Layers 图标），padding 收窄。

### 修改的页面

**`TokenManage.jsx`**：
- 编辑模态框加"默认存档"下拉框（"不绑定" + 用户存档列表），payload 加 `archive_id`。
- 桌面表格 + 移动 TokenCard 在名称下方挂"绑定·{archive_name}"紫色 Tag chip；未绑定显示"+ 绑定存档"灰凹陷 CTA（点击直接打开编辑弹窗）。
- 状态从绿色 pill 改为 **绿点 + 加粗绿字**。
- 已用额度 **4 位小数 + font-black + text-base** 作为 hero 数字。
- 密钥改为 **clay-inset 胶囊**，眼睛/复制图标内嵌。
- 操作按钮全部改为 **w-8 h-8 圆形黏土按钮**（启用=绿黏土、禁用=灰黏土、编辑=表面色、删除=粉色黏土）。
- 表头：`名称 / 绑定存档`、`已用额度`；日期前加 `创建` 前缀。

**`LogList.jsx`**：
- 删除桌面 table 分支，统一 grid 卡片流。
- LogCard 结构：
  - 左侧 44px 大图标按 `TYPE_META[type].icon` 统一（消费=Activity / 系统=Terminal / 充值=CreditCard / 错误=AlertCircle / 退款=RotateCcw / 管理=Settings），不再随 stream 变化。
  - **主标题** = 用户输入的模型 id（绑定别名时配紫色 Tag 前置图标，透传时配黄色 Cpu 前置图标）。
  - **副标题** = relay 实际命中的 `{group} / {real_model}`（slash 分隔；alias=group 时跳过分组去重；透传时显 `{group} · 透传`）。错误日志在副标题下加纯红错误信息（3 行 clamp）。
  - 长模型 id 用 `break-all` 自然换行，hover `title` tooltip。
  - 右上单 chip：消费类显示 `流式/非流`，非消费类显示类别 label。
  - 金额：4 位小数、无 +/- 符号；消费 `text-clay-pink-400`，收入 `text-emerald-600`。
  - 指标行单行 chip 流：Clock 时间 · ↓ 入 · ↑ 出 · 缓读 / 缓写 · Zap 首字 · Timer 总。
  - 桌面 viewMode 切换胶囊（列表 / 卡片），localStorage 持久化；列表态 `grid-cols-1`，卡片态 `md:grid-cols-2`。

**`ClaySelect.jsx`**：改 `createPortal` + 支持 `disabled`，解决在 modal 内被截断的问题。

### Clay 小胶囊设计模式（已定型，可复用）

| 语义 | 颜色 | 图标 |
|---|---|---|
| 别名 / Tag | 紫 `#6b4d83` (`bg-clay-purple-100`) | `Tag` |
| 分组 | 紫 `#6b4d83` | `Layers` |
| 令牌 / Key | 蓝 `#43658b` (`bg-clay-blue-100`) | `KeyRound` |
| 真实模型 | 黄 `#8a6a32` (`bg-clay-yellow-100`) | `Cpu` |
| 分享 / 成功 | emerald | `Share2` / `CheckCircle2` |
| 警告 / 已禁用 | amber | `AlertTriangle` |
| 错误 / 删除 | clay-pink | `XCircle` / `Trash2` |

- 凸起小胶囊统一 `shadow-clay-sm`（不是 `shadow-clay` —— 后者 8px 偏移对 chip 过大反而显平）。
- 凹陷 / 占位用 `shadow-clay-inset` + gradient 背景 + `border-white/40`。
- 字重最小 `font-bold`，关键信息 `font-extrabold` / `font-black`。

### Clay 阴影系统重要修正（v5+）

uiweb 旧版全局 `--clay-shadow*` 的 inset 方向是反的：`inset 5px 5px DARK + inset -5px -5px LIGHT` 是 CONCAVE 凹陷配方，但外阴影是 CONVEX 凸起方向，**外凸内凹视觉冲突**，所以所有 clay-card 看起来"扁/像凹槽"。

v5 已修正：
- `--clay-shadow` / `-sm` / `-hover` 的 inset 翻转为 CONVEX `inset 2px 2px LIGHT + inset -2px -2px DARK`，并缩小到 2px/5px blur，整体更柔和饱满。
- `.clay-card` 移除了 `border: 2px solid rgba(white, 0.24)`（与新高光叠加产生"脏边光晕"）。
- 高光不透明度降到哑光范围：外光晕 0.85 → 0.55，内高光 0.65 → 0.40。
- light + dark 双模式同步处理；`-active` / `-inset` / `-focus` 这三个本来就该凹陷的没动。

**副作用**：其它页面以前若依赖凹陷外观，可能视觉会有变化。已知 LogList / TokenManage / ArchiveList 都更接近设计稿。**这是下一步全 uiweb Clay 风格审查的重要前提**。

## 不要做的事（已被用户否决）

- **思考态判断（`reasoning_effort`）**：用户明确说 "不需要添加思考态判断"，已移除。Brain icon、思考 chip 都不再出现。
- 把日志卡片做成密集表格：用户改判为"用户侧日志数量可控，应该用大卡片不是密集表格"。Admin 看日志走 legacy 不在 Clay 做新 UI。
- 路由分隔符用 `/`：与真实模型名常见的 `/` 冲突，已改 `@`。

## 验收清单（merge 前需在测试机过一遍）

> 此清单为归档时（feature 分支收口）的验收项，仅作历史记录。当前生产以 `2_active_task.md` 验收清单 + `docs/uiweb/database-and-migrations.md` 为准。

- 视觉满意度：所有 clay 元素（卡片、胶囊、按钮）凸起感统一。
- "思考"/"非思考" alias 真正切组：日志卡副标题应显示不同的 group / model。
- 中文别名 / 空别名默认源模型 / 冲突自动加前缀这几个 edge case。
- `/v1/models` 在 Token 绑定存档时返回的别名列表。
- 分享码生成、预览、导入；无权限别名打 `disabled_reason` 不阻断导入。

## 后续可做（已留 hook 不阻塞）

- 用户视角日志更深化展示：`requested_model_name` 已落库，目前在卡片主标题展示，未来可加更多上下文（如 alias 历史变更）。
- 分享码过期 / 限次：v1 不做，仅手动吊销。
- 跨用户 archive 模板市场：v1 不做。
