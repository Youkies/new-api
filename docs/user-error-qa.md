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

## Q3：测试连接返回 404，提示 `Invalid URL (POST /v1)`

**报错示例**

```text
Failed to get response: 404
{"error":{"message":"Invalid URL (POST /v1)","type":"invalid_request_error"}}
```

或客户端测试连接中显示：

```text
流式：Invalid URL (POST /v1)
非流式：Failed to get response: 404 ...
工具调用：Failed to get response: 404 ...
```

**常见原因**

这表示请求已经到达本站，但客户端把请求发到了 `/v1` 这个不完整路径。本站不会处理 `POST /v1`，真正的聊天接口通常是 `/v1/chat/completions`。

这一般不是余额不足、API Key 权限不足或模型不可用，而是客户端里的接口地址填写方式不匹配。

**解决方案**

1. 先检查客户端的地址字段名称。
2. 如果字段叫 `Base URL`、`API Base`、`OpenAI Base URL`，通常填写到 `/v1` 即可，例如：

```text
https://newapi-clay.youkies.space/v1
```

3. 如果字段叫 `URL`、`Endpoint URL`、`Chat Completions URL`，并且测试时仍然报 `POST /v1`，说明这个客户端不会自动拼接聊天接口，需要填写完整接口：

```text
https://newapi-clay.youkies.space/v1/chat/completions
```

4. API Key 填用户自己的令牌，格式通常以 `sk-` 开头。
5. 保存后重新测试非流式、流式和工具调用。
6. 如果仍然失败，再检查模型名称是否与本站模型列表一致，例如不要手动写错渠道后缀或模型别名。

**Yoki 客户端填写示例**

如果客户端页面里同时有 `API Base Url` 和 `API 路径` 两个字段，不要把 `API 路径` 留空。

推荐填法：

```text
API Base Url: https://你的域名/v1
API 路径: /chat/completions
Response API: 关闭
```

也可以使用完整路径写法：

```text
API Base Url: https://你的域名
API 路径: /v1/chat/completions
Response API: 关闭
```

如果 `API 路径` 留空，客户端可能会直接请求 `POST /v1`，从而触发 `Invalid URL (POST /v1)`。

**安全提醒**

如果用户截图里暴露了完整或接近完整的 API Key，建议立即删除公开截图，并在令牌管理里重置或重新生成 Key。

**给用户的简短答复**

这个 404 不是模型或余额问题，是客户端把请求发到了 `/v1`，路径不完整。请看地址栏：如果客户端要填 Base URL，就填 `https://newapi-clay.youkies.space/v1`；如果它要填完整 URL / Endpoint，就填 `https://newapi-clay.youkies.space/v1/chat/completions`。另外截图里露出了 Key，建议重置一下令牌。

## Q4：Claude 返回 400，提示 `unexpected tool_use_id found in tool_result blocks`

**报错示例**

```text
{"type":"error","error":{"type":"invalid_request_error","message":"***.***.content.0: unexpected `tool_use_id` found in `tool_result` blocks: toolu_xxx. Each `tool_result` block must have a corresponding `tool_use` block in the previous message."}}
```

**常见原因**

这是 Claude / Anthropic 对工具调用上下文的格式校验。客户端发送了一个 `tool_result`（工具结果），但上一条 assistant 消息里没有对应的 `tool_use`（工具调用请求），所以 Claude 无法确认这个工具结果属于哪一次工具调用。

常见触发方式：

1. 客户端开启了工具调用、插件、MCP、联网搜索等功能，但对话历史被裁剪、压缩或同步丢失。
2. 用户从中途继续一段包含工具调用的旧对话，上一轮 assistant 的工具调用消息不在上下文里。
3. 客户端重试失败请求时，只保留了工具结果，没有保留前一条工具调用。
4. 在不同模型、不同接口格式之间切换后继续旧对话，客户端没有正确转换工具调用历史。
5. 客户端本身的工具调用测试流程不兼容 Claude 格式。

**解决方案**

1. 最快处理：新建一个空白对话重新发送，不要从报错的那条工具调用上下文继续。
2. 临时关闭客户端里的工具调用、插件、MCP、联网搜索、函数调用等选项，再测试普通聊天。
3. 如果必须使用工具调用，删除报错前后的工具调用消息，从用户自然语言问题重新发起。
4. 不要手动编辑、复制或拼接包含 `toolu_`、`tool_use_id`、`tool_result` 的历史消息。
5. 如果是客户端“测试工具调用”时报错，先确认非流式和流式普通聊天是否正常；普通聊天正常时，多半是客户端工具调用兼容问题。
6. 如果只在某个 Claude 渠道出现，可以临时切换其他模型或关闭工具调用后使用。

**给用户的简短答复**

这个不是 Key 或余额问题，是客户端工具调用上下文乱了：它发了工具结果，但上一条消息里没有对应的工具调用。请先新建一个空白对话，关闭工具调用 / 插件 / MCP / 联网搜索后再试；如果普通聊天正常，就说明是客户端工具调用兼容问题，旧对话不要继续从那条工具消息后面续聊。
