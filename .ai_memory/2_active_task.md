# 当前任务

## 状态：UI 优化批次 + 签到时区修复完成，准备 push + 构建镜像

## 本次完成（2026-04-27）

### 新页面：API URL 子界面 (/api-urls)
- 双卡片展示：通用地址 (newapi.youkies.space) + 国内优化 (newapi.youkies.cn)
- 一键复制 + 弹窗提醒"地址不带 /v1，部分软件需自行追加"
- "不再提示" 复选框：localStorage `uiweb.apiUrls.suppressV1Notice=1`
- 修复 ClayCheckbox 双触发 bug：`<span>` 上冗余 onClick 与 `<label>→<input>` 冲突

### 签到时区修复（核心 bug）
- 根因：Docker 容器默认 UTC，`time.Now().Format("2006-01-02")` 取 UTC 日期；UTC 0:00 = 北京 8:00，用户反馈"凌晨刷新不准"
- 修复 1（应用层）：`controller/checkin.go` + `model/checkin.go` 增加 `checkinTimezone()`，读 `CHECKIN_TIMEZONE` env，默认 `Asia/Shanghai`；`HasCheckedInToday`/`UserCheckin`/`next_checkin_at` 全部按该时区
- 修复 2（容器层）：`Dockerfile` 加 `ENV TZ=Asia/Shanghai`
- 修复 3（前端时钟漂移补偿）：`GetCheckinStatus` 返回 `server_now` + `next_checkin_at`，前端按 `skew = clientNow - server_now` 校正后倒计时

### 日志页：今日消耗卡片
- LogList 顶部新增"今日消耗（自 0:00 起）"粉色渐变卡片
- 调用 `/api/log/self/stat?type=2&start_timestamp=<今日0点>` 独立拉取，与列表筛选解耦
- `services/logs.js#getUserLogsStat` 增加参数支持

### 日志列表 UI 优化
- 桌面表格：行高 py-5→py-3、padding px-5→px-4、表头加 `bg-clay-bg/50` 浅底 + uppercase
- 移动卡片：4 行结构（类型+流标↔额度 / 模型 / Token / 时间↔用时+令牌名），额度右上突出，删除 `ml-10` 缩进

### 模型与价格页视觉重做
- 卡片三段式：①带渐变着色的品牌头部（按量蓝粉渐变 / 按次黄渐变） ②输入/输出双栏（蓝/粉色调 + 方向箭头图标） ③缓存独立行
- 头部信息提示 chip：单位 /1M tokens · 实际扣费按渠道倍率

### 模型状态页四大优化
- OverviewBanner：状态指示器（脉冲 ping）+ 加权 SLA + 4 列指标卡 + 立即刷新按钮
- ModelCard：hover 上浮、底部分隔线、最新桶请求数显示
- Uptime 柱条：hover scale-y-105、白底箭头 tooltip、时间轴标签
- StatusLegend：底部凹陷信息卡，三档阈值说明（≥95%/60-95%/<60%）
- Tooltip 跟随柱条对齐：`leftPct = (i+0.5)/N*100`，clamp 8-92%
- 修复 tooltip 被 .clay-card 全局 `overflow-hidden` 截断：ModelCard 加 `!overflow-visible`

## 下一步
- git commit + push 全部 UI 优化
- 更新 .ai_memory（本次）
- 构建 Docker 镜像并推送 ghcr
