# 渠道而外设置说明

该配置用于设置一些额外的渠道参数，可以通过 JSON 对象进行配置。主要包含以下设置项：

1. force_format
    - 用于标识是否对数据进行强制格式化为 OpenAI 格式
    - 类型为布尔值，设置为 true 时启用强制格式化

2. proxy
    - 用于配置网络代理
    - 类型为字符串，填写代理地址（例如 socks5 协议的代理地址）

3. thinking_to_content
   - 用于标识是否将思考内容`reasoning_content`转换为`<think>`标签拼接到内容中返回
   - 类型为布尔值，设置为 true 时启用思考内容转换

4. strip_native_reasoning
   - 用于标识是否在返回给下游前移除模型原生思维链字段 `reasoning_content` 和 `reasoning`
   - 类型为布尔值，设置为 true 时启用原生思维链拦截
   - 适合 SillyTavern 等客户端已有角色卡预设思维链，避免模型原生 reasoning 字段与预设内容混在一起

5. strip_content_think_tags
   - 用于标识是否移除响应正文 `content` 中的 `<think>...</think>` 内容块
   - 类型为布尔值，设置为 true 时启用正文 think 标签清理
   - 该选项会影响角色卡主动要求模型输出的“预设思维链”，建议仅在明确需要清理正文标签时开启

--------------------------------------------------------------

## JSON 格式示例

以下是一个示例配置，启用强制格式化并设置了代理地址：

```json
{
    "force_format": true,
    "thinking_to_content": true,
    "strip_native_reasoning": true,
    "strip_content_think_tags": false,
    "proxy": "socks5://xxxxxxx"
}
```

--------------------------------------------------------------

通过调整上述 JSON 配置中的值，可以灵活控制渠道的额外行为，比如是否进行格式化以及使用特定的网络代理。
