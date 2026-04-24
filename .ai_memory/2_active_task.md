# 当前任务

## 状态：Clay 风格打磨中，等用户验收

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

## 下一步

待用户验收后决定：
- A：PersonalSetting 精简（去绑定 tab、去 Passkey/2FA）
- B：Stage 3（Midjourney / Task 页面）
- C：Stage 4（Playground 15 组件 + Chat）
- D：跑完整端到端验收

## 风险 / 未做

- PersonalSetting 密码修改、2FA 管理仍桥接经典控制台
- Dashboard 用量图是自制柱状条
- 未做管理员路由守卫
- Playground 仍跳经典控制台
