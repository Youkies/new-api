# 从长记忆库迁移到项目文档体系

> 这是一份可复制到其他项目的迁移指南。目标是把 `.ai_memory` 从“越写越长的百科全书”改造成“轻量索引 + 当前交接单”，把完整细节沉淀到 `docs/`。

## 为什么要迁移

旧模式通常会把所有内容都塞进记忆库：

- 当前任务、历史流水、部署细节、接口细节、排障记录混在一起。
- 每次接手都要读大量旧内容，真正需要的信息反而不容易找到。
- 归档会压缩细节，但不归档又会让上下文越来越重。
- 代码、部署、数据库、排障等长期知识没有稳定入口，容易散落在聊天记录里。

新模式的目标：

- `.ai_memory` 只保存索引、当前状态、关键决策和下一步。
- `docs/` 保存完整细节、接口契约、迁移清单、部署排障和长期产品设计。
- 接手时先读轻量记忆；需要细节时再按专题查文档。
- 归档不再等于丢细节，细节转移到可维护文档。

## 新结构

推荐结构：

```text
.ai_memory/
  0_archive_context.md       # 简短归档，只记录阶段演进和关键决策
  1_project_context.md       # 稳定索引和高优先级约束
  2_active_task.md           # 当前交接单、阻塞、下一步
  3_work_log.md              # 高信号工作日志

docs/
  project-handbook.md        # 文档总入口和接手顺序
  <domain>/
    overview.md              # 子系统定位、边界、目录
    features.md              # 用户侧或核心功能
    admin.md                 # 管理端/运营侧能力
    api-contracts.md         # API 契约和语义
    database-and-migrations.md
    deployment-and-troubleshooting.md
  user-error-qa.md           # 客服/用户常见问题，可选
```

不同项目可以按领域调整 `<domain>`，例如：

- `frontend/`
- `billing/`
- `crawler/`
- `agent/`
- `mobile/`
- `data-pipeline/`

## 四个记忆文件的新职责

### `0_archive_context.md`

保留：

- 阶段性决策。
- 思路演变。
- 为什么从 A 方案换到 B 方案。
- 重要里程碑。

不要保留：

- 完整实现流水。
- 大段接口字段。
- 大段 SQL。
- 每次 build/test 的重复输出。

### `1_project_context.md`

保留：

- 接手顺序。
- 文档地图。
- 高优先级长期约束。
- 当前架构边界。
- 高风险排障索引。
- 协作偏好。

不要保留：

- 可在专题文档中查到的完整细节。
- 临时想法。
- 已完成任务的过程记录。

### `2_active_task.md`

保留：

- 当前正在处理什么。
- 已完成到哪里。
- 当前判断。
- 阻塞。
- 下一步。
- 提交/部署注意事项。

不要保留：

- 多个历史任务堆叠。
- 已经沉淀到文档里的长说明。
- 旧任务的完整验证流水。

### `3_work_log.md`

保留：

- 高信号节点。
- 一行一个事实。
- 重要测试结果、构建结果、部署结果。

格式：

```text
- [YYYY-MM-DD HH:mm] one-line summary
```

## 迁移步骤

### 1. 找到归档前的长记忆版本

如果旧记忆已经提交到 git，可以用：

```powershell
git log --oneline -- .ai_memory
```

比较每个版本的体量：

```powershell
$commits = git rev-list --reverse HEAD -- .ai_memory/2_active_task.md
foreach ($c in $commits) {
  $content = git show "$c`:.ai_memory/2_active_task.md" 2>$null
  if ($LASTEXITCODE -eq 0) {
    $lines = ($content | Measure-Object -Line).Lines
    $subject = git log -1 --format=%s $c
    "$($c.Substring(0,8)) lines=$lines $subject"
  }
}
```

选“压缩前最后一个长版本”作为素材源。

### 2. 抽取主题，不搬运流水

从旧记忆里按主题抽取：

- 项目定位。
- 架构边界。
- 部署链路。
- 数据库迁移。
- 核心功能。
- 管理端功能。
- API 契约。
- 典型排障。
- 用户常见问题。

不要逐条搬运“某天做了什么”。流水只在归档中保留索引。

### 3. 建立 `docs/project-handbook.md`

这个文件只做总入口，不写太长。

推荐包含：

- 文档来源。
- 项目定位。
- 子系统索引。
- 日常接手顺序。
- 维护原则。

模板：

```markdown
# 项目手册

> 本手册承接旧记忆库长细节。日常接手先读本页，需要细节再进入专题文档。

## 文档来源

- 旧长记忆版本：`<commit>`。
- 当前精简记忆：`.ai_memory/*`。
- 当前代码确认点：`<关键路径>`。

## 项目定位

- ...

## 必读索引

- [总览](./<domain>/overview.md)
- [功能](./<domain>/features.md)
- [API 契约](./<domain>/api-contracts.md)
- [数据库与迁移](./<domain>/database-and-migrations.md)
- [部署与排障](./<domain>/deployment-and-troubleshooting.md)

## 日常接手顺序

1. 读 `.ai_memory/2_active_task.md`。
2. 读 `.ai_memory/1_project_context.md`。
3. 按任务打开对应专题文档。

## 维护原则

- `.ai_memory` 只保留索引、当前状态和关键决策。
- `docs/` 保存完整细节。
- 长期行为变化先更新 docs，再写短记忆。
```

### 4. 按专题拆分文档

常用拆分：

- `overview.md`：定位、技术栈、路由/模块边界、目录结构。
- `features.md`：用户侧功能或核心业务功能。
- `admin.md`：管理端、运营侧、后台策略。
- `api-contracts.md`：接口列表、语义、重要响应约定。
- `database-and-migrations.md`：表、字段、手动迁移、兼容性。
- `deployment-and-troubleshooting.md`：部署链路、环境变量、排障流程。

拆分原则：

- 一个文档回答一类问题。
- 用索引链接串起来。
- 不追求一次写完所有字段，先把长期要查的知识放进去。
- 后续遇到真实问题再补对应专题。

### 5. 重写 `1_project_context.md`

把它改成稳定索引。

模板：

```markdown
# 项目核心知识库

> 本文件只保留稳定索引和高优先级决策。完整细节查 `docs/project-handbook.md`。

## 接手顺序

- 先读 `.ai_memory/2_active_task.md`。
- 再读本文件。
- 涉及细节时按 `docs/project-handbook.md` 打开专题文档。

## 项目形态

- ...

## 文档体系

- 总入口：`docs/project-handbook.md`。
- ...

## 稳定边界

- ...

## 部署与生产约束

- ...

## 高风险排障索引

- ...

## 协作偏好

- ...
```

### 6. 重写 `2_active_task.md`

把它改成当前交接单。

模板：

```markdown
# 当前任务

## 当前可接手状态：<任务名>（YYYY-MM-DD）

### 已完成

- ...

### 当前判断

- ...

### 后续注意

- ...
```

### 7. 追加归档与工作日志

`0_archive_context.md` 追加：

```markdown
## YYYY-MM-DD — 记忆库长细节转入项目文档

- 从旧长记忆版本 `<commit>` 抽取长期细节，新增 `docs/project-handbook.md` 与专题文档。
- 后续原则：记忆库保持索引和当前状态，完整细节沉淀到 `docs/`。
```

`3_work_log.md` 追加：

```markdown
- [YYYY-MM-DD HH:mm] 将旧长记忆迁移为项目文档体系：新增手册和专题文档，记忆库改为轻量索引。
```

## 维护规则

### 什么时候更新 docs

需要更新 docs：

- 新增长期功能。
- 新增/修改 API 契约。
- 新增表、字段、迁移步骤。
- 部署链路变化。
- 生产排障流程变化。
- 产品边界或长期策略变化。

只写工作日志即可：

- 一次性调试。
- 临时试验。
- 未验证想法。
- 小 UI 文案微调。
- 重复 build/test 输出。

### 什么时候更新 `1_project_context.md`

只在这些情况下更新：

- 用户明确确认了长期方向。
- 技术选择已定且会反复影响后续任务。
- 生产约束改变。
- 文档入口或接手顺序改变。
- 高风险排障入口改变。

### 什么时候更新 `2_active_task.md`

每次出现这些情况时更新：

- 当前任务阶段推进。
- 出现阻塞。
- 下一步改变。
- 需要交接给下一轮对话。

## 验收清单

迁移完成后检查：

- `docs/project-handbook.md` 存在，且能作为总入口。
- 专题文档覆盖核心功能、API、数据库、部署、排障。
- `.ai_memory/1_project_context.md` 不再像长文档。
- `.ai_memory/2_active_task.md` 只描述当前任务，不堆历史任务。
- `.ai_memory/0_archive_context.md` 有迁移归档块。
- `.ai_memory/3_work_log.md` 有迁移日志。
- 没有把 secrets、token、密码、`.env` 值写进 docs 或 memory。
- `git diff --check` 通过。
- `git status` 中清楚区分本次文档变更和既有无关文件。

## 推荐给全局 Custom Instructions 的规则

可以把下面这段加入全局规则：

```markdown
## Documentation And Knowledge Lookup

- Treat repo memory as an index and current-state tracker, not as the full project encyclopedia.
- If a repo has a documentation entry point such as `docs/project-handbook.md`, use it as the first place to look up durable project details when the task needs them.
- Prefer topic docs under `docs/` for implementation details, API contracts, database migrations, deployment notes, troubleshooting procedures, and long-lived product decisions.
- Do not load all docs by default. Read the lightweight memory first when required by the routing rules, then open only the relevant documentation sections for the current task.
- Do not restore long historical details into `.ai_memory`; move durable details into docs and keep memory concise.
- When long-lived behavior changes, update the relevant docs first, then add only a short index/current-state note to memory.
```

## 一句话原则

记忆库负责“我现在该从哪里接手”，项目文档负责“细节到底是什么”。
