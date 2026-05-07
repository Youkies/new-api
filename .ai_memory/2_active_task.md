# 当前任务

## 当前可接手状态：价格页移动端分组弹窗改造（2026-05-08）

### 已完成

- 已为定价接口新增分组详细介绍配置链路：`UserUsableGroupDetails` 作为独立 option 保存，不改变既有 `UserUsableGroups` 短描述结构。
- `/api/pricing` 继续返回 `usable_group` 短描述，并新增 `group_details`，只暴露当前用户可用分组的详细介绍。
- `/legacy/` 经典控制台的分组相关设置已增加“详细介绍”编辑：
  - 可视化分组表新增“详细介绍”列；
  - 手动 JSON 模式新增 `UserUsableGroupDetails` 输入区。
- `uiweb` 价格页已把移动端分组按钮墙改为“查看分组”弹窗：
  - 页面默认显示全部模型；
  - 主页面显示当前分组、模型数量、倍率和详细介绍；
  - 弹窗顶部显示 `Pro优专属倍率`、`Ultra优专属倍率` 及对应图标；
  - 弹窗列表显示分组名、简介、模型数量和倍率，选择后关闭弹窗并筛选模型。
- debug mock 已补充分组详情、更多分组和模型，用于本地移动端验收。
- 文档索引已更新：`docs/uiweb/api-contracts.md` 与 `docs/uiweb/features.md` 记录 `group_details` 与移动端分组弹窗语义。
- 按用户验收反馈压缩价格页顶部筛选区：
  - “查看分组”按钮改为小号胶囊；
  - 当前分组改为单行紧凑状态条；
  - 移除“全部供应商”下拉筛选，只保留模型搜索。
- 桌面端价格页保留原有分组胶囊墙审美，移除“全部供应商”下拉筛选；鼠标悬浮或键盘聚焦到分组时展示悬浮详情，包含分组简介、模型数量、倍率和详细介绍。

### 验证结果

- `go test ./setting ./controller ./model -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过。
- `npm run build` 于 `web/classic/` 通过。
- `git diff --check` 于本次相关文件通过。
- 已用前台可见 Playwright Chrome 打开 `http://192.168.2.108:5178/pricing?debug=1`，移动视口 `390x720` 验证：
  - “查看分组”按钮可打开弹窗；
  - 弹窗展示会员倍率提示、分组简介、模型数量、倍率；
  - 选择 `pro` 后弹窗关闭，页面显示详细介绍并只剩 1 个模型。
- 顶部筛选区压缩后再次执行 `npm run build` 于 `uiweb/` 通过，并用 Playwright 快照确认“全部供应商”已移除。
- 按用户反馈将“查看分组”按钮移动到当前分组状态条右侧；debug mock 改用 `Claude-Antigravity` 长分组名，并压缩状态条的数量/倍率标签后验证完整显示。
- 再次按用户反馈调整为：当前分组与详细介绍合并成一个完整信息框；搜索框与“查看分组”按钮并排成工具条。选中 `Claude-Antigravity` 后已验证分组名完整显示。
- 桌面端方案调整后，`uiweb npm run build` 与 `git diff --check` 通过；Playwright 桌面视口 `1440x900` 验证供应商筛选已移除，分组胶囊墙可正常显示，悬浮 `Claude-Antigravity` 可出现简介与详细介绍弹窗。

### 下一步

- 等用户在本地浏览器或同网手机上手动验收价格页移动端与桌面端体验。
- 若验收通过，再按用户指令决定是否提交/推送；提交前必须重新核对 `git status`，避免带入无关历史改动和临时诊断文件。

### 注意事项

- 本次不涉及数据库迁移；新增配置走 `options` 表，生产如果已有 `NODE_TYPE=slave` 也不会依赖 AutoMigrate。
- 不要把 `.env`、数据库凭据、secret 或调试日志内容写入提交、文档或记忆。
