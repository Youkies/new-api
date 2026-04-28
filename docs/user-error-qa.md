# 常见报错 Q&A

本文档用于整理用户在调用模型或使用客户端时常见的报错现象、原因判断和处理方式，可作为客服答复、公告补充或 AI 助手知识库资料。

## Q1：Chat Completion API 返回 400，提示 `assistant message prefill`

**报错示例**

```text
status_code=400
{"type":"error","error":{"type":"invalid_request_error","message":"This model does not support assistant message prefill. The conversation must end with a user message."}}
```

**常见原因**

这通常是客户端或预设里启用了“预填充”（assistant prefill / assistant message prefill），或者预设最后一条消息的身份被设置成了助手（assistant）。

部分模型不支持对 assistant 消息进行预填充，要求对话最后一条必须是用户（user）消息，所以会返回 400。

**解决方案**

1. 先关闭客户端里的“预填充”“assistant prefill”“续写预设开头”等相关功能。
2. 如果关闭后仍然报错，打开当前预设，找到最后一条预设消息，点击编辑或小铅笔图标。
3. 检查最后一条预设消息的身份，将其从“助手 / assistant”改为“用户 / user”。
4. 保存预设后重新发起对话。
5. 如果仍无法恢复，建议临时切换到其他预设，或新建一个最简预设再测试。

**给用户的简短答复**

这个 400 一般是预填充或预设角色导致的。请先关闭预填充；如果还不行，编辑预设最后一条消息，把身份从助手改成用户，再重新发送。

## Q2：返回 503，提示 `auth_exhausted: no available account`

**报错示例**

```text
status_code=503, auth_exhausted: no available account: auth_exhausted: no available account: antigravity: both free quota and credit in cooldown (sticky)
```

**常见原因**

这是上游反代渠道侧出现的账号额度或冷却问题，不是用户本地客户端配置错误，也通常不是本站账号余额异常。

报错中的 `both free quota and credit in cooldown` 表示上游可用账号暂时进入冷却或不可用状态，当前渠道暂时没有可用账号承接请求。

**处理建议**

1. 一般等待约 1 小时左右会自行缓解。
2. 不建议短时间内反复重试同一个请求，可能继续命中同一上游冷却状态。
3. 如果比较着急，可以临时切换其他可用模型或其他渠道。
4. 如果长时间持续出现，可以带上报错内容、模型名称、请求时间联系管理员排查。

**给用户的简短答复**

这个 503 是上游反代渠道暂时没有可用账号，一般 1 小时左右会缓解。请先耐心等待，急用时可以先切换其他模型或渠道。
