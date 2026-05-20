# 当前任务

## 一句话状态（2026-05-21）

`feature/promotion-admin` 分支已开发完毕（commit `ea70ac22`，5 个 Phase 全过），
docker `:feature-promotion-admin-ea70ac22` 已推 GHCR。**下一步是在测试机部署该镜像
并按下方验收清单走一遍**，验收通过后合并 main + 推 `:latest`。

## 接手时立刻要做的事（按顺序）

### 第 0 步：拉到最新分支

```bash
cd d:/Project/newapi
git fetch origin
git checkout feature/promotion-admin
git pull
git log -1 --format='%H %s'   # 应该看到 ea70ac22
```

### 第 1 步：测试机部署

测试机是云悠美国机器 `newapi-test.youkies.space`，`NODE_TYPE=master`，push 后会自动构建。
**但目前 docker-compose 用的是 `:latest`，不会自动用 feature 镜像**。需要：

1. SSH 进测试机
2. 修改 docker-compose 把 image 改成 `ghcr.io/youkies/new-api:feature-promotion-admin-ea70ac22`
3. `docker compose pull && docker compose up -d --force-recreate`

或者你可以让我帮你打个 PowerShell 脚本去操作（如有需要）。

### 第 2 步：自动迁移确认（不用你手动跑 SQL）

master 启动后会：
1. AutoMigrate 建 `promotion_campaigns` + `promotion_skus` 两张表
2. 检测 `promotion_campaigns` Unscoped count==0 → 自动 seed 520 默认数据
3. 历史 `top_ups.promotion_sku_id = "p520-sku-1..4"` 订单仍能 100% 解析

如果想确认 seed 跑了：
```sql
SELECT id, slug, title, enabled FROM promotion_campaigns;
SELECT sku_key, label, sort_order FROM promotion_skus ORDER BY campaign_id, sort_order;
```

应看到 1 条 `520` 活动 + 4 条 `p520-sku-1..4`。

### 第 3 步：验收清单（约 15 分钟跑完）

| # | 验证 | 操作 | 期望 |
|---|------|------|------|
| 1 | 后台可见 | 登 `newapi-test.youkies.space/legacy/promotion` | 列表显示 1 条 520 活动 |
| 2 | 编辑活动 | 点编辑 520 → 改主题色 → 保存 | Toast 成功 |
| 3 | 落地页生效 | 30 秒后刷 `newapi-test.youkies.space/promotion/520` | 主题色变了（30s 缓存 TTL） |
| 4 | SKU 编辑 | 改 SKU 价格 / display / 限购 | 保存生效 |
| 5 | SKU 排序 | 上下箭头调换 SKU 顺序 | 落地页顺序跟着变 |
| 6 | 新建活动 | 「新建活动」→ slug=`test-2026` → enabled=false → 保存 | 列表多一条 disabled |
| 7 | 加 SKU | 给 test-2026 加 1 个 SKU | 看到 SKU 表 |
| 8 | 启用切换 | 启用 test-2026 → 落地页 `/promotion/test-2026` 能访问 | 可见 |
| 9 | 克隆 | 克隆 520 为 `520-2027` | 自动复制 4 个 SKU，sku_key 重新生成 |
| 10 | 软删 | 删 test-2026 | 列表消失，DB `deleted_at` 非空 |
| 11 | 历史订单 | 老 520 已成功充值日志详情 | 仍能解析 SKU 名 |
| 12 | 销售统计 | 编辑 520 → 看销售统计卡 | 显示历史销量数字 |
| 13 | Banner 过滤 | 改某活动 `show_topup_banner=false` | `/topup` 顶部不再显示 |
| 14 | 实际充值 | 用真实账号选 SKU 扫码（小金额 5 元） | RechargeKPay 入账，quota 增加 |

### 第 4 步：合并 main + 推 `:latest`

验收全部通过后：

```bash
# 1. 合并到 main
git checkout main
git pull
git merge --no-ff feature/promotion-admin -m "merge feature/promotion-admin"
git push origin main

# 2. 用 imagetools 把 feature 镜像 retag 成 :latest（不重新构建）
docker buildx imagetools create \
  -t ghcr.io/youkies/new-api:latest \
  -t ghcr.io/youkies/new-api:main-<新 commit sha 前 8 位> \
  ghcr.io/youkies/new-api:feature-promotion-admin-ea70ac22

# 3. 主站 newapi.youkies.space 的 Zeabur "New API" 服务 → 重新部署
```

## 关键文件位置（便于接手时定位）

**后端**
- `model/promotion_campaign.go` — GORM models + CRUD + 缓存 + seed (~600 行)
- `model/topup.go` — `RechargeKPay` 改读 DB（line ~648 附近）
- `controller/promotion.go` — 用户侧（GET/POST，~330 行）
- `controller/admin_promotion.go` — admin CRUD (~310 行)
- `router/api-router.go` — 路由（看 `promotions` 关键字）

**前端**
- `web/classic/src/pages/Promotion/index.jsx` — 入口包装
- `web/classic/src/components/table/promotions/PromotionsTable.jsx` — 主表 + 编辑 modal + SKU 子表 (~900 行)
- `web/classic/src/components/layout/SiderBar.jsx` — 菜单项「促销活动」
- `web/classic/src/App.jsx` — `/console/promotion` 路由
- `uiweb/src/pages/PromotionPage.jsx` — 用户落地页（已存在，不变）
- `uiweb/src/components/promotion/PromotionBanner.jsx` — `/topup` 顶部 banner，新加 `show_topup_banner` 字段过滤

**文档**
- `docs/uiweb/database-and-migrations.md` — 加了 `promotion_campaigns + promotion_skus schema + 升级路径`
- `kpay-adapter-pack.zip`（仓库根 + git 忽略）— KPay 适配包，可分享给其他 new-api 用户

## 关键设计抉择（防止下次会话搞错）

1. **slug 建后不可改**：是路由 + sku_key 前缀的稳定 key，admin UI 已 disabled
2. **sku_key 建后不可改**：被 `top_ups.promotion_sku_id` 引用
3. **SKU 软删用 enabled=0，不是 deleted_at**：让历史订单仍能解析
4. **`FindSkuByKey` 不看 enabled**：入账高频路径必须能解析任意 SKU
5. **缓存 30s（活动列表）+ 60s（按 key 查 SKU）**：进程内 sync.Map，跨节点不一致最多 30 秒
6. **decimal.Decimal 存价格**：避免 float 精度漂移；JSON 给前端时 `decimalToFloat`，统计页用 `StringFixed(2)`
7. **Seed 触发条件 Unscoped count==0**：admin 删 520 后重启不会再被 seed 覆盖

## 已知风险（接手前注意）

- master 重启会触发 seed 检查（不会执行 — 因为 521 你部署过 520 写死版了，DB 表已有数据 — 但首次部署后台化版本时表为空，seed 会跑）
- 多 master 节点的进程内缓存各自独立，admin 改完 30 秒内可能不一致（业务可接受）
- 当前 KPay webhook 签名校验**间歇性失败**（不影响入账，靠四层兜底救场）— 这是历史问题，跟本次后台化无关，不要在接手时混淆

## KPay 适配包（临时任务，已完成）

2026-05-20 应需求打包了 KPay 适配资料供其他 new-api 用户使用：
- 文件：`kpay-adapter-pack.zip`（仓库根，43KB，git 忽略）
- 内含：架构文档、4 层兜底原理、源码、前端片段、known-issues、AI 提示词模板
- **暂未上传 GitHub Releases**（用户选择「先不上传」）；下次有需要再发版

## 其它项目长期状态（已稳定，无需操作）

- **520 充值狂欢 v1（写死版）**：commit `7283969b` 已合并 main，`:latest` 已推
- **Pioneer 优先锋计划**：slave 节点 `users.pioneer` + middleware gate
- **用户模型别名存档**：`/archives` + Token 绑定 + Clay 日志卡片
- **KPay 充值四层兜底**：webhook + 前端 5s 轮询 + watcher 12 分钟退避 + 5 分钟全局扫描
- **东京 API-only 节点**：`newapi-jp.youkies.space`，slave，Nginx 仅放 `/v1` 和 `/api/status`
- **测试机**：云悠美国 + 旧 DB，`newapi-test.youkies.space`，push 后自动构建，master 模式
- **调试 Key + 连通性测试**：`/admin/debug-traces` 已上线
- **游乐场 / 今天吃什么呀**：`/playground` 已上线
- **必吃榜（搁置）**：代码留在 `feature/youkies-must-eat-shelved`，当前生产库不执行建表
