# 当前任务

## 当前可接手状态：渠道思维链输出拦截（2026-05-10）

### 已完成

- 针对 SillyTavern 角色卡“预设思维链”和模型原生思维链冲突问题，实测 `「按量」claude-opus-4-6-渠道2`：
  - 实际上游模型为 `claude-opus-4-6-thinking`。
  - 非流式响应会同时返回 `message.content` 和 `message.reasoning_content`。
  - 流式响应会先返回 `delta.reasoning_content`，再返回 `delta.content`。
  - 正文里由预设要求输出的 `<think>...</think>` 会落在 `content` 中，和原生 `reasoning_content` 可区分。
- 后端新增渠道设置：
  - `strip_native_reasoning`：返回前移除 `reasoning_content` / `reasoning` 字段。
  - `strip_content_think_tags`：可选移除正文 `content` 中的 `<think>...</think>` 内容块。
- OpenAI relay 已覆盖：
  - 原生 OpenAI 流式输出。
  - 非流式 OpenAI 输出。
  - 上游流式转下游非流式聚合。
  - OpenAI 转 Claude / Gemini 格式前的流式清理。
- 正文 `<think>` 清理使用流式状态机，能处理 `<think>` / `</think>` 跨 chunk 拆分。
- default UI 和 classic UI 的渠道编辑高级设置已增加两个开关，并补齐 default 六语言 i18n 与 classic 中英翻译。
- 文档已更新：
  - `docs/channel/other_setting.md`
  - `docs/uiweb/admin.md`

### 验证结果

- `go test ./relay/... -count=1` 通过。
- `go test ./relay/channel/openai ./relay/common ./dto -count=1` 通过。
- `npm run i18n:sync` 于 `web/default/` 通过；报告 missingCount 均为 0。
- `npm run build` 于 `web/default/` 通过。
- `npm run build` 于 `web/classic/` 通过；仍有既有大 chunk / circular chunk 警告，但构建成功。
- `git diff --check` 通过。

### 下一步

- 如需上线给酒馆用户使用，优先在对应渠道开启 `strip_native_reasoning`。
- `strip_content_think_tags` 默认不要开；只有用户明确希望连角色卡预设 `<think>...</think>` 也清理时再开启。
- 若用户要求提交，先重新核对 `git status` 和 diff 范围。

### 注意事项

- 本次不涉及数据库迁移；新增项保存在渠道 `setting` JSON。
- `strip_native_reasoning` 只拦截输出字段，不会减少上游 native thinking 已经产生的 token 消耗，也不会改变上游模型是否启用 thinking。
- 测试 key 只用于本轮接口验证，未写入文件、文档或记忆。
