# 当前任务

## 当前可接手状态：Youkies 必吃榜第一版（2026-05-10）

### 已完成

- 新增用户侧 `Youkies 必吃榜` 页面：
  - 路由：`/must-eat`
  - 文件：`uiweb/src/pages/ModelReviews.jsx`
  - 顶部导航和控制台导航均已加入入口。
- 新增模型评价能力：
  - 用户对某模型有至少一次成功消费日志后即可评价。
  - 同一用户同一模型只保留一条评价，可修改。
  - 支持五星、场景、标签、优点、不足、一句话评价。
  - 支持匿名评价。
  - 支持隐藏真实使用次数；不隐藏时显示“已使用 N 次”，隐藏时显示“已验证使用”。
  - 其他用户可点“有帮助”。
- 新增食评积分体系：
  - 首次有效评价奖励。
  - 高质量评价补差额奖励。
  - 有帮助追加奖励。
  - 管理员精选奖励。
  - 每日/每周积分封顶。
  - 食评积分可兑换用户余额额度。
- 新增后台管理页：
  - 路由：`/admin/model-reviews`
  - 文件：`uiweb/src/pages/admin/AdminModelReviews.jsx`
  - 可配置开关、先审后显、兑换比例、最低起兑、各类奖励、每日封顶、每周封顶、开榜倍率。
  - 可隐藏/公开评价，可精选评价。
- 新增后端模型/API：
  - `model/ui_model_review.go`
  - `controller/ui_model_review.go`
  - 路由挂载在 `/api/ui/model-reviews*` 与 `/api/ui/admin/model-reviews*`。
  - 新表加入 `migrateDB()` 与 `migrateDBFast()`。
- 已更新调试模式 mock：
  - `uiweb/src/utils/debugMode.js`
  - `?debug=1` 下可查看必吃榜、提交评价、后台调整设置。
- 已更新文档：
  - `docs/uiweb/features.md`
  - `docs/uiweb/admin.md`
  - `docs/uiweb/api-contracts.md`
  - `docs/uiweb/database-and-migrations.md`

### 默认奖励参数

- `1000` 食评积分兑换 `¥1` 等值额度。
- 首次有效评价：`500` 积分。
- 高质量评价最高：`1500` 积分。
- 有帮助：`20` 积分/次。
- 单条评价有帮助奖励上限：`500` 积分。
- 管理员精选：`3000` 积分。
- 每日封顶：`3000` 积分。
- 每周封顶：`10000` 积分。
- 开榜倍率：默认 `100%`，后台可调高到开榜期倍率。

### 验证结果

- `go test ./model ./controller ./router -count=1` 通过。
- `go test ./... -count=1` 通过。
- `npm run build` 于 `uiweb/` 通过；仍有既有大 chunk 警告。
- `git diff --check` 通过。

### 下一步

- 生产上线前必须手动确认新增表存在；正式 `NODE_TYPE=slave` 不会自动迁移。
- 如要开榜期奖励更大，优先在 `/admin/model-reviews` 调整 `开榜倍率` 或单项积分，不需要改代码。
- 若用户要求提交，先重新核对 `git status` 和 diff 范围。

### 注意事项

- 积分奖励不按五星正负倾向发放，只按评价是否有效、内容质量、被点有帮助和管理员精选发放。
- 匿名只影响前台展示，后台仍能看到真实用户，便于风控和撤下评价。
- 兑换额度时会增加 `users.quota` 并写积分流水和系统日志。
