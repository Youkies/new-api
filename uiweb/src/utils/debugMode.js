export const DEBUG_STORAGE_KEY = 'uiweb.debug.mode'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

function readEnvFlag() {
  const raw = String(import.meta.env.VITE_UI_DEBUG_MODE || '').trim().toLowerCase()
  return TRUE_VALUES.has(raw)
}

function readDevToggle() {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false
  const params = new URLSearchParams(window.location.search)
  const query = params.get('debug')
  if (TRUE_VALUES.has(String(query || '').toLowerCase())) {
    try { localStorage.setItem(DEBUG_STORAGE_KEY, '1') } catch (_) {}
    return true
  }
  if (query === '0' || query === 'false' || query === 'off') {
    try { localStorage.removeItem(DEBUG_STORAGE_KEY) } catch (_) {}
    return false
  }
  try {
    return localStorage.getItem(DEBUG_STORAGE_KEY) === '1'
  } catch (_) {
    return false
  }
}

export function isDebugMode() {
  return readEnvFlag() || readDevToggle()
}

export function disableDebugMode() {
  try { localStorage.removeItem(DEBUG_STORAGE_KEY) } catch (_) {}
}

export const DEBUG_USER = {
  id: 9001,
  role: 100,
  Role: 100,
  username: 'debug-admin',
  display_name: '调试管理员',
  email: 'debug@youkies.local',
  quota: 9916657,
  used_quota: 85800,
  request_count: 2971,
  group: 'default',
  aff_code: 'DEBUG',
  wechat_id: '',
  telegram_id: '',
  notify_type: 0,
  setting: {
    theme: 'system',
    email_notify: true,
    webhook_notify: false,
  },
  has_avatar: false,
}

const DEBUG_STATUS = {
  system_name: 'Youkies API',
  server_address: 'http://127.0.0.1:5174',
  password_login: true,
  register_enabled: true,
  email_verification: false,
  github_oauth: false,
  quota_per_unit: 500000,
  quota_display_type: 'CNY',
  display_in_currency: true,
  usd_exchange_rate: 7.2,
  custom_currency_symbol: '¥',
  custom_currency_exchange_rate: 7.2,
  user_agreement: '<p>这是调试模式的用户协议占位内容。</p>',
  privacy_policy: '<p>这是调试模式的隐私政策占位内容。</p>',
}

const nowSec = () => Math.floor(Date.now() / 1000)

function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function makeUsageSeries() {
  const models = ['claude-opus-4-6', 'claude-opus-4-7', 'gpt-5.5', 'gemini-2.5-pro']
  const result = []
  for (let i = 0; i < 7; i += 1) {
    for (let j = 0; j < models.length; j += 1) {
      result.push({
        created_at: daysAgo(6 - i, 9 + j * 3),
        count: Math.max(1, Math.round((Math.sin(i + j) + 1.3) * 7)),
        token_used: 9800 + i * 2300 + j * 1700,
        quota: 1200 + i * 260 + j * 150,
        model_name: models[j],
      })
    }
  }
  return result
}

function makeSlots(total = 24, status = 'green') {
  const start = nowSec() - total * 300
  return Array.from({ length: total }, (_, i) => {
    const base = 6 + ((i * 7) % 15)
    const failed = status === 'red' && i > total - 5 ? 4 : status === 'yellow' && i % 6 === 0 ? 2 : 0
    return {
      start_time: start + i * 300,
      total: base,
      success: Math.max(0, base - failed),
      failed,
      success_rate: base > 0 ? (base - failed) / base : 1,
    }
  })
}

function createInitialState() {
  const announcements = [
    {
      id: 1,
      title: '调试公告：Moon Clay 已上线',
      summary: '用于本地调试公告列表、强制弹窗与管理端 CRUD。',
      content: '这是一条调试公告内容。你可以在管理端编辑、启用、置顶或删除它，所有变化只保存在当前前端会话里。',
      content_format: 'markdown',
      type: 'normal',
      scope: 'all',
      notify_enabled: true,
      notify_level: 'warning',
      require_ack: true,
      force_popup: true,
      pinned: true,
      enabled: true,
      priority: 10,
      version: 1,
      starts_at: 0,
      ends_at: 0,
      created_at: daysAgo(1),
      updated_at: nowSec(),
    },
    {
      id: 2,
      title: '维护提醒',
      summary: '这是第二条普通公告，用于测试历史公告页面。',
      content: '调试模式不会连接真实数据库，也不会写入线上数据。',
      content_format: 'markdown',
      type: 'normal',
      scope: 'all',
      notify_enabled: true,
      notify_level: 'info',
      require_ack: false,
      force_popup: false,
      pinned: false,
      enabled: true,
      priority: 1,
      version: 1,
      starts_at: 0,
      ends_at: 0,
      created_at: daysAgo(3),
      updated_at: daysAgo(2),
    },
  ]

  const logs = [
    {
      id: 501,
      type: 2,
      created_at: daysAgo(0, 18, 12),
      model_name: 'claude-opus-4-6',
      token_name: '调试主令牌',
      group: 'default',
      request_id: 'debug-req-501',
      prompt_tokens: 1480,
      completion_tokens: 620,
      quota: 1460,
      use_time: 4,
      is_stream: true,
      content: '调试消费日志：正常流式响应。',
      other: JSON.stringify({ frt: 460, cache_tokens: 200 }),
    },
    {
      id: 502,
      type: 2,
      created_at: daysAgo(0, 17, 20),
      model_name: 'gpt-5.5',
      token_name: '调试主令牌',
      group: 'default',
      request_id: 'debug-empty-502',
      prompt_tokens: 920,
      completion_tokens: 0,
      quota: 820,
      use_time: 2,
      is_stream: false,
      content: '疑似空回调试样例：扣费但输出为 0。',
      other: JSON.stringify({ frt: 0 }),
    },
    {
      id: 503,
      type: 1,
      created_at: daysAgo(1, 12, 4),
      model_name: '',
      token_name: '',
      group: '',
      request_id: '',
      prompt_tokens: 0,
      completion_tokens: 0,
      quota: -50000,
      use_time: 0,
      is_stream: false,
      content: '兑换码充值调试记录。',
      other: '',
    },
    {
      id: 504,
      type: 5,
      created_at: daysAgo(2, 21, 33),
      model_name: 'gemini-2.5-pro',
      token_name: '图像测试令牌',
      group: 'assistant',
      request_id: 'debug-error-504',
      prompt_tokens: 0,
      completion_tokens: 0,
      quota: 0,
      use_time: 1,
      is_stream: false,
      content: '上游返回 429：用于测试错误日志样式。',
      other: '',
    },
  ]

  const refundAppeals = [
    {
      id: 3001,
      user_id: DEBUG_USER.id,
      username: DEBUG_USER.username,
      status: 'pending',
      total_items: 1,
      refund_quota: 820,
      scan_start: daysAgo(2),
      scan_end: nowSec(),
      user_note: '本地调试：疑似空回。',
      review_note: '',
      reviewed_at: 0,
      created_at: daysAgo(0, 18, 30),
      updated_at: daysAgo(0, 18, 30),
      items: [
        {
          id: 1,
          appeal_id: 3001,
          log_id: 502,
          model_name: 'gpt-5.5',
          token_name: '调试主令牌',
          request_id: 'debug-empty-502',
          quota: 820,
          prompt_tokens: 920,
          completion_tokens: 0,
          use_time: 2,
          content: '疑似空回调试样例：扣费但输出为 0。',
          created_at: daysAgo(0, 17, 20),
        },
      ],
    },
  ]

  const notifications = [
    {
      id: 7001,
      title: announcements[0].title,
      summary: announcements[0].summary,
      content: announcements[0].content,
      content_format: 'markdown',
      category: 'announcement',
      level: 'warning',
      source_type: 'announcement',
      source_key: 'announcement:1:v1',
      source_id: 1,
      source_version: 1,
      target_type: 'all',
      target_user_id: 0,
      target_group: '',
      action_url: '/announcements',
      popup: true,
      require_ack: true,
      pinned: true,
      enabled: true,
      priority: 10,
      starts_at: 0,
      ends_at: 0,
      created_at: daysAgo(1),
      updated_at: nowSec(),
      read_at: 0,
      acknowledged_at: 0,
      unread: true,
      acknowledged: false,
    },
    {
      id: 7002,
      title: '兑换码充值成功',
      summary: '已为账户增加 ¥10.000000 额度。',
      content: '这是一条调试充值通知，用于测试 billing 时间轴。',
      content_format: 'plain',
      category: 'billing',
      level: 'success',
      source_type: 'redemption',
      source_key: 'redemption:debug',
      source_id: 503,
      source_version: 1,
      target_type: 'user',
      target_user_id: DEBUG_USER.id,
      target_group: '',
      action_url: '/topup',
      popup: false,
      require_ack: false,
      pinned: false,
      enabled: true,
      priority: 0,
      starts_at: 0,
      ends_at: 0,
      created_at: daysAgo(1, 12),
      updated_at: daysAgo(1, 12),
      read_at: daysAgo(1, 13),
      acknowledged_at: 0,
      unread: false,
      acknowledged: false,
    },
    {
      id: 7003,
      title: '空回补偿申诉已提交',
      summary: '申诉单 #3001 已进入人工审核，共 1 条记录。',
      content: '申诉单 #3001 已进入人工审核，共 1 条记录。',
      content_format: 'plain',
      category: 'appeal',
      level: 'info',
      source_type: 'refund_appeal',
      source_key: 'appeal:3001:pending',
      source_id: 3001,
      source_version: 1,
      target_type: 'user',
      target_user_id: DEBUG_USER.id,
      target_group: '',
      action_url: '/logs',
      popup: false,
      require_ack: false,
      pinned: false,
      enabled: true,
      priority: 0,
      starts_at: 0,
      ends_at: 0,
      created_at: daysAgo(0, 18, 30),
      updated_at: daysAgo(0, 18, 30),
      read_at: 0,
      acknowledged_at: 0,
      unread: true,
      acknowledged: false,
    },
  ]

  const modelReviewSettings = {
    id: 1,
    enabled: true,
    require_admin_review: false,
    points_per_quota: 1000,
    base_review_points: 500,
    quality_reward_min_score: 40,
    quality_reward_max: 1500,
    helpful_points: 20,
    helpful_reward_limit: 500,
    featured_review_points: 3000,
    daily_points_cap: 3000,
    weekly_points_cap: 10000,
    reward_multiplier: 100,
    min_redeem_points: 1000,
    created_at: daysAgo(1),
    updated_at: nowSec(),
  }

  const modelReviews = [
    {
      id: 90001,
      user_id: DEBUG_USER.id,
      username: DEBUG_USER.username,
      model_name: 'claude-opus-4-6',
      rating: 5,
      scenario: '长文',
      tags: JSON.stringify(['长文稳', '代码强', '少废话']),
      tag_list: ['长文稳', '代码强', '少废话'],
      pros: '复杂需求拆解和长文整理很稳，代码解释也清楚。',
      cons: '速度偏慢，普通闲聊有点贵。',
      content: '适合当主力硬菜，尤其是长上下文和复杂工程问题。',
      anonymous: false,
      hide_usage: false,
      usage_count: 18,
      usage_tokens: 128000,
      usage_quota: 18200,
      usage_label: '已使用 18 次',
      display_name: DEBUG_USER.username,
      last_used_at: daysAgo(0, 18),
      quality_score: 100,
      helpful_count: 12,
      featured: true,
      status: 'visible',
      base_points_awarded: 500,
      quality_points_awarded: 1500,
      helpful_points_awarded: 240,
      featured_points_awarded: 3000,
      total_points_awarded: 5240,
      created_at: daysAgo(2),
      updated_at: daysAgo(0, 18),
      helpful_by_me: false,
      can_mark_helpful: false,
      can_edit: true,
    },
    {
      id: 90002,
      user_id: 8088,
      username: 'taste-user',
      model_name: 'gpt-5.5',
      rating: 4,
      scenario: '代码',
      tags: JSON.stringify(['速度快', '代码强']),
      tag_list: ['速度快', '代码强'],
      pros: '响应速度和工具调用节奏舒服，写小改动很快。',
      cons: '遇到超长上下文时稳定性不如 Claude。',
      content: '适合日常 coding 和轻量分析，性价比不错。',
      anonymous: true,
      hide_usage: true,
      usage_count: 9,
      usage_tokens: 72000,
      usage_quota: 9800,
      usage_label: '已验证使用',
      display_name: '匿名食评家',
      last_used_at: daysAgo(1, 15),
      quality_score: 90,
      helpful_count: 6,
      featured: false,
      status: 'visible',
      base_points_awarded: 500,
      quality_points_awarded: 1350,
      helpful_points_awarded: 120,
      featured_points_awarded: 0,
      total_points_awarded: 1970,
      created_at: daysAgo(3),
      updated_at: daysAgo(1),
      helpful_by_me: false,
      can_mark_helpful: true,
      can_edit: false,
    },
    {
      id: 90003,
      user_id: 7002,
      username: 'gemini-fan',
      model_name: 'gemini-2.5-pro',
      rating: 4,
      scenario: '总结',
      tags: JSON.stringify(['便宜', '长文稳']),
      tag_list: ['便宜', '长文稳'],
      pros: '处理资料总结很划算，长文输入成本友好。',
      cons: '偶尔格式跟随不够稳定。',
      content: '资料整理和总结可以常备，但复杂指令要写清楚。',
      anonymous: false,
      hide_usage: false,
      usage_count: 7,
      usage_tokens: 64000,
      usage_quota: 5200,
      usage_label: '已使用 7 次',
      display_name: 'gemini-fan',
      last_used_at: daysAgo(0, 11),
      quality_score: 88,
      helpful_count: 3,
      featured: false,
      status: 'visible',
      base_points_awarded: 500,
      quality_points_awarded: 1320,
      helpful_points_awarded: 60,
      featured_points_awarded: 0,
      total_points_awarded: 1880,
      created_at: daysAgo(4),
      updated_at: daysAgo(1),
      helpful_by_me: false,
      can_mark_helpful: true,
      can_edit: false,
    },
  ]

  return {
    tokens: [
      {
        id: 101,
        name: '调试主令牌',
        key: 'debug-main-token',
        status: 1,
        group: 'default',
        used_quota: 4200,
        remain_quota: 800000,
        unlimited_quota: false,
        model_limits_enabled: false,
        model_limits: '',
        expired_time: -1,
        created_time: daysAgo(12),
      },
      {
        id: 102,
        name: '图像测试令牌',
        key: 'debug-vision-token',
        status: 1,
        group: 'assistant',
        used_quota: 2400,
        remain_quota: 0,
        unlimited_quota: true,
        model_limits_enabled: true,
        model_limits: JSON.stringify(['gpt-5.5', 'claude-opus-4-6']),
        expired_time: daysAgo(-30),
        created_time: daysAgo(5),
      },
    ],
    logs,
    refundAppeals,
    announcements,
    notifications,
    modelReviews,
    modelReviewSettings,
    modelReviewAccount: {
      user_id: DEBUG_USER.id,
      username: DEBUG_USER.username,
      total_earned: 5240,
      available_points: 4200,
      redeemed_points: 1040,
      updated_at: nowSec(),
    },
    notificationSettings: {
      id: 1,
      billing_enabled: true,
      billing_require_ack: false,
      appeal_submitted_enabled: true,
      appeal_submitted_require_ack: false,
      appeal_approved_enabled: true,
      appeal_approved_require_ack: false,
      appeal_rejected_enabled: true,
      appeal_rejected_require_ack: false,
      created_at: daysAgo(1),
      updated_at: nowSec(),
    },
    pageConfig: {
      api_urls: [
        {
          url: 'https://newapi.youkies.space',
          label: '通用地址',
          desc: '直连服务器，全球可访问',
          icon: 'globe',
          tone: 'pink',
          enabled: true,
        },
        {
          url: 'https://newapi.youkies.cn',
          label: '国内优化',
          desc: '国内中转加速，已备案',
          icon: 'zap',
          tone: 'blue',
          enabled: true,
        },
      ],
      membership_badges: [
        { key: 'default', label: '普通用户', short_label: '普通', tagline: '基础额度与标准模型权限' },
        { key: 'standard', label: 'Standard 优', short_label: 'Standard', tagline: '充值活跃用户专属签到福利' },
        { key: 'pro', label: 'Pro优', short_label: 'Pro', tagline: '更优价格与常用高级模型' },
        { key: 'super', label: 'Super优', short_label: 'Super', tagline: '更高调用优先级与扩展权益' },
        { key: 'ultra', label: 'Ultra优', short_label: 'Ultra', tagline: '最高阶权限与旗舰模型体验' },
      ],
      updated_at: nowSec(),
    },
    assistantConfig: {
      id: 1,
      enabled: true,
      assistant_name: 'Youkies 的 AI 分身',
      welcome_message: '你好，我是 Youkies 的 AI 分身。把错误截图和问题发给我，我会先帮你判断是否需要人工处理。',
      provider_type: 'site',
      base_url: '',
      api_key_set: true,
      model_name: 'gpt-5.4-mini',
      system_prompt: '你是 Youkies API 控制台的调试助手。',
      allow_screenshot: true,
      knowledge_enabled: true,
      store_sessions: true,
      daily_limit: 8,
      daily_used: 1,
      max_image_bytes: 800 * 1024,
      created_at: daysAgo(1),
      updated_at: nowSec(),
    },
    assistantDocs: [
      {
        id: 1,
        title: '常见错误排查',
        content: '余额不足、模型不可用、上游限流、空回等问题请先保留请求时间、模型名和 Request ID。',
        enabled: true,
        sort_order: 1,
        created_at: daysAgo(1),
        updated_at: nowSec(),
      },
    ],
    assistantSessions: [
      {
        id: 1,
        user_id: DEBUG_USER.id,
        page_path: '/logs',
        question: '为什么这条日志没有输出？',
        screenshot_count: 1,
        decision: 'manual_review',
        answer_summary: '建议保留 Request ID 后提交人工审核。',
        provider_type: 'site',
        model_name: 'gpt-5.4-mini',
        error_message: '',
        created_at: daysAgo(0, 19, 8),
      },
    ],
    assistantConversations: [
      {
        id: 1,
        user_id: DEBUG_USER.id,
        title: '截图报错排查',
        last_message: '这是本地 mock 回复，不会消耗真实模型额度。',
        created_at: daysAgo(0, 18, 40),
        updated_at: daysAgo(0, 19, 8),
        deleted_at: 0,
      },
    ],
    assistantMessages: [
      {
        id: 1,
        conversation_id: 1,
        user_id: DEBUG_USER.id,
        role: 'user',
        content: '这个报错是什么意思？',
        screenshot_count: 1,
        created_at: daysAgo(0, 18, 41),
      },
      {
        id: 2,
        conversation_id: 1,
        user_id: DEBUG_USER.id,
        role: 'assistant',
        content: '这个报错通常是请求参数格式不符合上游要求，可以先检查模型、参数和返回的错误码。',
        reasoning: '我先识别报错类型，再把它归到参数问题，并给出用户能自助检查的步骤。',
        screenshot_count: 0,
        created_at: daysAgo(0, 18, 42),
      },
    ],
  }
}

const debugState = createInitialState()

function ok(data = null, extra = {}) {
  return {
    status: 200,
    data: {
      success: true,
      message: 'success',
      data,
      ...extra,
    },
  }
}

function plain(data = {}) {
  return { status: 200, data }
}

function page(items, total = items.length) {
  return ok({ items, total })
}

function parseUrl(config) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://debug.local'
  const url = new URL(config.url || '/', base)
  if (config.params && typeof config.params === 'object') {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    })
  }
  return url
}

function parseBody(data) {
  if (!data) return {}
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch (_) { return {} }
  }
  if (data instanceof FormData) return {}
  return data
}

function nextId(items, fallback = 1) {
  return Math.max(fallback, ...items.map((item) => Number(item.id) || 0)) + 1
}

function paginate(items, url) {
  const p = Math.max(1, Number(url.searchParams.get('p')) || 1)
  const size = Math.max(1, Number(url.searchParams.get('page_size')) || Number(url.searchParams.get('size')) || items.length || 20)
  return items.slice((p - 1) * size, p * size)
}

function filterKeyword(items, url, fields) {
  const keyword = String(url.searchParams.get('keyword') || '').trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) => fields.some((field) => String(item[field] || '').toLowerCase().includes(keyword)))
}

function tokenResponse(url) {
  let items = filterKeyword(debugState.tokens, url, ['name', 'key', 'group'])
  return page(paginate(items, url), items.length)
}

function logResponse(url) {
  let items = [...debugState.logs]
  const type = Number(url.searchParams.get('type') || 0)
  if (type) items = items.filter((item) => Number(item.type) === type)
  const model = url.searchParams.get('model_name')
  if (model) items = items.filter((item) => item.model_name?.includes(model))
  const token = url.searchParams.get('token_name')
  if (token) items = items.filter((item) => item.token_name?.includes(token))
  const group = url.searchParams.get('group')
  if (group) items = items.filter((item) => item.group === group)
  const requestId = url.searchParams.get('request_id')
  if (requestId) items = items.filter((item) => item.request_id?.includes(requestId))
  items.sort((a, b) => b.created_at - a.created_at)
  return page(paginate(items, url), items.length)
}

function logStatResponse(url) {
  let items = [...debugState.logs]
  const type = Number(url.searchParams.get('type') || 0)
  if (type) items = items.filter((item) => Number(item.type) === type)
  const quota = items.reduce((sum, item) => sum + Math.max(0, Number(item.quota) || 0), 0)
  const count = items.length
  const token = items.reduce((sum, item) => sum + (Number(item.prompt_tokens) || 0) + (Number(item.completion_tokens) || 0), 0)
  return ok({ quota, count, token, token_used: token })
}

function activeAnnouncements() {
  const now = nowSec()
  return debugState.announcements
    .filter((item) => item.enabled)
    .filter((item) => !item.starts_at || item.starts_at <= now)
    .filter((item) => !item.ends_at || item.ends_at >= now)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || b.created_at - a.created_at)
}

function syncAnnouncementNotification(announcement) {
  if (!announcement?.id) return
  debugState.notifications = debugState.notifications.filter(
    (item) => !(item.source_type === 'announcement' && Number(item.source_id) === Number(announcement.id)),
  )
  if (!announcement.enabled || announcement.notify_enabled === false) return
  debugState.notifications.unshift({
    id: nextId(debugState.notifications, 7000),
    title: announcement.title,
    summary: announcement.summary,
    content: announcement.content,
    content_format: 'markdown',
    category: 'announcement',
    level: announcement.notify_level || 'info',
    source_type: 'announcement',
    source_key: `announcement:${announcement.id}:v${announcement.version || 1}`,
    source_id: announcement.id,
    source_version: announcement.version || 1,
    target_type: 'all',
    target_user_id: 0,
    target_group: '',
    action_url: '/announcements',
    popup: Boolean(announcement.force_popup),
    require_ack: Boolean(announcement.require_ack || announcement.force_popup),
    pinned: Boolean(announcement.pinned),
    enabled: true,
    priority: announcement.priority || 0,
    starts_at: announcement.starts_at || 0,
    ends_at: announcement.ends_at || 0,
    created_at: nowSec(),
    updated_at: nowSec(),
    read_at: 0,
    acknowledged_at: 0,
    unread: true,
    acknowledged: false,
  })
}

function adminAnnouncementResponse(url) {
  let items = filterKeyword(debugState.announcements, url, ['title', 'summary', 'content'])
  const enabled = url.searchParams.get('enabled')
  if (enabled === 'true') items = items.filter((item) => item.enabled)
  if (enabled === 'false') items = items.filter((item) => !item.enabled)
  items = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || b.created_at - a.created_at)
  return page(paginate(items, url), items.length)
}

function activeNotifications() {
  const now = nowSec()
  return debugState.notifications
    .filter((item) => item.enabled)
    .filter((item) => !item.starts_at || item.starts_at <= now)
    .filter((item) => !item.ends_at || item.ends_at >= now)
    .filter((item) => item.target_type === 'all' || item.target_user_id === DEBUG_USER.id || item.target_type === 'admin')
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || b.created_at - a.created_at)
}

function notificationResponse(url) {
  let items = activeNotifications()
  const category = url.searchParams.get('category')
  if (category) items = items.filter((item) => item.category === category)
  if (url.searchParams.get('unread') === 'true') items = items.filter((item) => item.unread)
  return page(paginate(items, url), items.length)
}

function adminNotificationResponse(url) {
  let items = filterKeyword(debugState.notifications, url, ['title', 'summary', 'source_key'])
  const category = url.searchParams.get('category')
  const targetType = url.searchParams.get('target_type')
  const enabled = url.searchParams.get('enabled')
  if (category) items = items.filter((item) => item.category === category)
  if (targetType) items = items.filter((item) => item.target_type === targetType)
  if (enabled === 'true') items = items.filter((item) => item.enabled)
  if (enabled === 'false') items = items.filter((item) => !item.enabled)
  items = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || b.created_at - a.created_at)
  return page(paginate(items, url), items.length)
}

function refundAppealResponse(url) {
  let items = filterKeyword(debugState.refundAppeals, url, ['username', 'user_note', 'review_note'])
  const status = url.searchParams.get('status')
  if (status) items = items.filter((item) => item.status === status)
  items = [...items].sort((a, b) => b.created_at - a.created_at)
  return page(paginate(items, url), items.length)
}

function modelReviewVisibleItems() {
  return debugState.modelReviews
    .filter((item) => item.status === 'visible')
    .map(modelReviewView)
}

function modelReviewView(item) {
  const tagList = Array.isArray(item.tag_list)
    ? item.tag_list
    : (() => {
        try { return JSON.parse(item.tags || '[]') } catch (_) { return [] }
      })()
  return {
    ...item,
    tag_list: tagList,
    display_name: item.anonymous ? '匿名食评家' : item.username,
    usage_label: item.hide_usage ? '已验证使用' : `已使用 ${item.usage_count || 0} 次`,
    public_usage: !item.hide_usage,
    helpful_by_me: Boolean(item.helpful_by_me),
    can_mark_helpful: item.user_id !== DEBUG_USER.id && !item.helpful_by_me,
    can_edit: item.user_id === DEBUG_USER.id,
  }
}

function modelReviewUsage(modelName) {
  const logs = debugState.logs.filter((item) => item.type === 2 && item.model_name === modelName)
  const count = logs.length
  return {
    model_name: modelName,
    count,
    tokens: logs.reduce((sum, item) => sum + (Number(item.prompt_tokens) || 0) + (Number(item.completion_tokens) || 0), 0),
    quota: logs.reduce((sum, item) => sum + Math.max(0, Number(item.quota) || 0), 0),
    last_used_at: logs.reduce((max, item) => Math.max(max, Number(item.created_at) || 0), 0),
    eligible: count > 0,
  }
}

function modelReviewQualityScore(payload) {
  let score = 0
  if (payload.scenario) score += 20
  if (Array.isArray(payload.tags) && payload.tags.length > 0) score += 10
  if (payload.pros) score += 20
  if (payload.cons) score += 20
  const len = String(payload.content || '').trim().length
  if (len >= 80) score += 20
  if (len >= 160) score += 10
  return Math.min(100, score)
}

function modelReviewRankings() {
  const pricingModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'gpt-5.5', 'gpt-5.4-mini', 'gemini-2.5-pro', 'gemini-coding-pro', 'image-preview']
  const names = new Set([...pricingModels, ...debugState.modelReviews.map((item) => item.model_name), ...debugState.logs.map((item) => item.model_name).filter(Boolean)])
  return Array.from(names).map((name) => {
    const reviews = modelReviewVisibleItems().filter((item) => item.model_name === name)
    const usage = modelReviewUsage(name)
    const reviewCount = reviews.length
    const avg = reviewCount ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount : 0
    const quality = reviewCount ? reviews.reduce((sum, item) => sum + Number(item.quality_score || 0), 0) / reviewCount : 0
    const helpfulCount = reviews.reduce((sum, item) => sum + Number(item.helpful_count || 0), 0)
    const featuredCount = reviews.filter((item) => item.featured).length
    const bayes = ((Math.max(avg, 3.8) * reviewCount) + 3.8 * 5) / (reviewCount + 5)
    const score = Math.round((bayes * 20 * 0.68 + Math.min(Math.log10(usage.tokens + 10) * 4, 18) * 0.12 + Math.min(helpfulCount * 1.5, 10) + Math.min(quality / 10, 10) + Math.min(featuredCount * 3, 9)) * 10) / 10
    const myReview = debugState.modelReviews.find((item) => item.user_id === DEBUG_USER.id && item.model_name === name)
    return {
      model_name: name,
      average_rating: reviewCount ? Math.round(avg * 10) / 10 : 0,
      review_count: reviewCount,
      helpful_count: helpfulCount,
      featured_count: featuredCount,
      average_quality: Math.round(quality),
      usage_tokens: usage.tokens,
      score,
      my_usage: usage,
      my_review: myReview ? modelReviewView(myReview) : null,
      eligible: usage.eligible,
      has_enough_sample: reviewCount >= 3,
    }
  }).sort((a, b) => b.score - a.score)
}

function assistantStreamText(payload) {
  const last = [...(payload?.messages || [])].reverse().find((item) => item.role === 'user')
  const question = last?.content || '这个问题'
  const screenshotCount = payload?.screenshots?.length || 0
  return [
    '<think>我先根据用户描述判断这是控制台预诊断场景，再检查是否需要人工介入。这里是 mock 思考过程，会在界面里自动折叠。</think>',
    '我先按调试模式帮你预诊断一下：',
    '',
    `你描述的是“${question}”。${screenshotCount ? `我也收到了 ${screenshotCount} 张截图。` : '目前没有截图。'}`,
    '',
    '初步判断：这类问题通常先检查余额、模型是否可用、请求参数和返回错误码。如果日志里出现扣费但输出为 0，可以保留 Request ID 后走空回申诉。',
    '',
    '这是本地 mock 回复，不会消耗真实模型额度。',
  ].join('\n')
}

export async function streamDebugAssistantChat(payload, onChunk) {
  const text = assistantStreamText(payload)
  const last = [...(payload?.messages || [])].reverse().find((item) => item.role === 'user')
  let conversationId = Number(payload?.conversation_id) || 0
  if (!conversationId) {
    conversationId = nextId(debugState.assistantConversations)
    debugState.assistantConversations.unshift({
      id: conversationId,
      user_id: DEBUG_USER.id,
      title: (last?.content || '新的对话').slice(0, 60),
      last_message: '',
      created_at: nowSec(),
      updated_at: nowSec(),
      deleted_at: 0,
    })
  }
  debugState.assistantMessages.push({
    id: nextId(debugState.assistantMessages),
    conversation_id: conversationId,
    user_id: DEBUG_USER.id,
    role: 'user',
    content: last?.content || '请帮我看一下截图里的问题。',
    screenshot_count: payload?.screenshots?.length || 0,
    created_at: nowSec(),
  })
  for (let i = 0; i < text.length; i += 6) {
    const chunk = text.slice(i, i + 6)
    onChunk?.(chunk)
    await new Promise((resolve) => window.setTimeout(resolve, 28))
  }
  const visibleText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const reasoning = (text.match(/<think>([\s\S]*?)<\/think>/i)?.[1] || '').trim()
  debugState.assistantMessages.push({
    id: nextId(debugState.assistantMessages),
    conversation_id: conversationId,
    user_id: DEBUG_USER.id,
    role: 'assistant',
    content: visibleText,
    reasoning,
    screenshot_count: 0,
    created_at: nowSec(),
  })
  const conversation = debugState.assistantConversations.find((item) => Number(item.id) === Number(conversationId))
  if (conversation) {
    conversation.last_message = visibleText.slice(0, 180)
    conversation.updated_at = nowSec()
  }
  return { text, conversationId: String(conversationId) }
}

export async function mockApiResponse(config) {
  if (!isDebugMode()) return null
  const url = parseUrl(config)
  const path = url.pathname
  const method = String(config.method || 'get').toUpperCase()
  const body = parseBody(config.data)

  if (path === '/api/status' && method === 'GET') return ok(DEBUG_STATUS)
  if (path === '/api/setup' && method === 'GET') return ok({ setup: true })
  if (path === '/api/setup' && method === 'POST') return ok(null)

  if (path === '/api/user/login' && method === 'POST') return ok(DEBUG_USER)
  if (path === '/api/user/register' && method === 'POST') return ok(null)
  if (path === '/api/verification' && method === 'GET') return ok(null)
  if (path === '/api/reset_password' && method === 'GET') return ok(null)
  if (path === '/api/user/reset' && method === 'POST') return ok('debug-new-password')
  if (path === '/api/user/logout' && method === 'GET') return ok(null)
  if (path === '/api/user/self' && method === 'GET') return ok(DEBUG_USER)
  if (path === '/api/user/self' && method === 'PUT') return ok({ ...DEBUG_USER, ...body })
  if (path === '/api/user/setting' && method === 'PUT') return ok({ ...DEBUG_USER, setting: { ...DEBUG_USER.setting, ...body } })
  if (path === '/api/user/self' && method === 'DELETE') return ok(null)
  if (path === '/api/user/oauth/bindings' && method === 'GET') return ok([])
  if (path === '/api/user/2fa/status' && method === 'GET') return ok({ enabled: false })
  if (path === '/api/user/avatar' && (method === 'POST' || method === 'DELETE')) return ok(null)

  if (path === '/api/user/self/groups' && method === 'GET') {
    return ok({
      default: { desc: '默认分组', ratio: 1 },
      assistant: { desc: 'AI 助手分组', ratio: 1 },
      vip: { desc: 'VIP 调试分组', ratio: 0.8 },
    })
  }

  if ((path === '/api/token/' || path === '/api/token') && method === 'GET') return tokenResponse(url)
  if ((path === '/api/token/search' || path === '/api/token/search/') && method === 'GET') return tokenResponse(url)
  if ((path === '/api/token/' || path === '/api/token') && method === 'POST') {
    const token = {
      id: nextId(debugState.tokens, 100),
      key: `debug-token-${Date.now().toString(36)}`,
      status: 1,
      used_quota: 0,
      created_time: nowSec(),
      model_limits_enabled: false,
      model_limits: '',
      ...body,
    }
    debugState.tokens.unshift(token)
    return ok(token)
  }
  if ((path === '/api/token/' || path === '/api/token') && method === 'PUT') {
    const index = debugState.tokens.findIndex((item) => Number(item.id) === Number(body.id))
    if (index >= 0) debugState.tokens[index] = { ...debugState.tokens[index], ...body }
    return ok(index >= 0 ? debugState.tokens[index] : body)
  }
  if (path === '/api/token/batch/keys' && method === 'POST') {
    return ok({ keys: Object.fromEntries(debugState.tokens.map((item) => [item.id, item.key])) })
  }
  if (path === '/api/token/batch' && method === 'POST') return ok(null)
  const tokenKeyMatch = path.match(/^\/api\/token\/(\d+)\/key$/)
  if (tokenKeyMatch && method === 'POST') {
    const token = debugState.tokens.find((item) => Number(item.id) === Number(tokenKeyMatch[1]))
    return ok({ key: token?.key || 'debug-token-key' })
  }
  const tokenIdMatch = path.match(/^\/api\/token\/(\d+)$/)
  if (tokenIdMatch && method === 'GET') {
    return ok(debugState.tokens.find((item) => Number(item.id) === Number(tokenIdMatch[1])) || null)
  }
  if (tokenIdMatch && method === 'DELETE') {
    debugState.tokens = debugState.tokens.filter((item) => Number(item.id) !== Number(tokenIdMatch[1]))
    return ok(null)
  }

  if (path === '/api/data/self/' && method === 'GET') return ok(makeUsageSeries())
  if (path === '/api/uptime/status' && method === 'GET') return ok({ status: 'ok' })
  if (path === '/api/log/self' && method === 'GET') return logResponse(url)
  if (path === '/api/log/self/stat' && method === 'GET') return logStatResponse(url)

  if (path === '/api/user/checkin' && method === 'GET') {
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const records = [1, 3, 8, 13, 21].map((day, index) => ({
      checkin_date: `${month}-${String(day).padStart(2, '0')}`,
      quota_awarded: 250000 + index * 25000,
    }))
    return ok({
      enabled: true,
      min_quota: 250000,
      max_quota: 400000,
      user_group: DEBUG_USER.group,
      next_checkin_at: daysAgo(-1, 0),
      server_now: nowSec(),
      stats: {
        total_quota: records.reduce((sum, item) => sum + item.quota_awarded, 0),
        total_checkins: records.length,
        checkin_count: records.length,
        checked_in_today: false,
        records,
      },
    })
  }
  if (path === '/api/user/checkin' && method === 'POST') {
    return ok({
      quota_awarded: 300000,
      checkin_date: new Date().toISOString().slice(0, 10),
    })
  }

  if (path === '/api/user/topup/info' && method === 'GET') {
    return ok({
      enable_online_topup: true,
      min_topup: 1,
      amount_options: [5, 10, 20, 50, 100],
      discount: { 50: 0.95, 100: 0.9 },
      pay_methods: [
        { type: 'alipay', name: '支付宝' },
        { type: 'wxpay', name: '微信支付' },
      ],
    })
  }
  if (path === '/api/user/amount' && method === 'POST') return plain({ message: 'success', data: String((Number(body.amount) || 0).toFixed(2)) })
  if (path === '/api/user/pay' && method === 'POST') return plain({ message: 'success', url: '#debug-pay', data: { amount: body.amount || 0, payment_method: body.payment_method || 'alipay' } })
  if (path === '/api/user/topup' && method === 'POST') {
    if (debugState.notificationSettings.billing_enabled) {
      debugState.notifications.unshift({
        id: nextId(debugState.notifications, 7000),
        title: '兑换码充值成功',
        summary: '已为账户增加调试额度。',
        content: '调试模式兑换码充值成功，通知红点会同步出现。',
        category: 'billing',
        level: 'success',
        source_type: 'redemption',
        source_key: `redemption:debug:${Date.now()}`,
        source_id: 0,
        source_version: 1,
        target_type: 'user',
        target_user_id: DEBUG_USER.id,
        action_url: '/topup',
        require_ack: Boolean(debugState.notificationSettings.billing_require_ack),
        enabled: true,
        created_at: nowSec(),
        updated_at: nowSec(),
        unread: true,
      })
    }
    return plain({ success: true, message: '¥10.00', data: { ...DEBUG_USER, quota: DEBUG_USER.quota + 50000 } })
  }
  if (path === '/api/user/aff' && method === 'GET') return ok({ enabled: false })
  if (path === '/api/user/aff_transfer' && method === 'POST') return ok(null)
  if (path === '/api/subscription/plans' && method === 'GET') return ok([])
  if (path === '/api/subscription/self' && method === 'GET') return ok(null)

  if (path === '/api/user/models' && method === 'GET') {
    return ok(['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'claude-opus-4-6', 'claude-opus-4-7', 'gemini-2.5-pro'])
  }

  if (path === '/api/ui/assistant/models' && method === 'GET') {
    return ok({
      user_group: 'Super优',
      default_group: 'default',
      groups: [
        { name: 'default', desc: '默认分组', ratio: 1, models: ['gpt-5.5', 'gpt-5.4-mini', 'claude-opus-4-6', 'gemini-2.5-pro'] },
        { name: 'Pro优', desc: 'Pro优', ratio: 0.95, models: [] },
        { name: 'Super优', desc: 'Super优', ratio: 0.9, models: [] },
        { name: 'Ultra优', desc: 'Ultra优', ratio: 0.85, models: [] },
      ],
    })
  }

  if (path === '/api/pricing' && method === 'GET') {
    return plain({
      success: true,
      data: [
        { model_name: 'claude-opus-4-6', vendor_id: 1, model_ratio: 12, completion_ratio: 5, cache_ratio: 0.1, model_price: 0, enable_groups: ['default', 'vip'] },
        { model_name: 'claude-sonnet-4-6', vendor_id: 1, model_ratio: 6, completion_ratio: 5, cache_ratio: 0.1, model_price: 0, enable_groups: ['default', 'Claude-Antigravity'] },
        { model_name: 'gpt-5.5', vendor_id: 2, model_ratio: 8, completion_ratio: 6, cache_ratio: 0.1, model_price: 0, enable_groups: ['default', 'assistant'] },
        { model_name: 'gpt-5.4-mini', vendor_id: 2, model_ratio: 2, completion_ratio: 4, cache_ratio: 0.12, model_price: 0, enable_groups: ['default', 'coding'] },
        { model_name: 'gemini-2.5-pro', vendor_id: 3, model_ratio: 4, completion_ratio: 3, cache_ratio: 0.15, model_price: 0, enable_groups: ['default'] },
        { model_name: 'gemini-coding-pro', vendor_id: 3, model_ratio: 4, completion_ratio: 3, cache_ratio: 0.15, model_price: 0, enable_groups: ['coding', 'ultra'] },
        { model_name: 'image-preview', vendor_id: 2, model_ratio: 0, completion_ratio: 0, model_price: 0.02, enable_groups: ['assistant'] },
      ],
      vendors: [
        { id: 1, name: 'Anthropic', icon: 'Claude.Color' },
        { id: 2, name: 'OpenAI', icon: 'OpenAI.Color' },
        { id: 3, name: 'Google', icon: 'Gemini.Color' },
      ],
      group_ratio: { default: 1, assistant: 1, vip: 0.8, 'Claude-Antigravity': 0.72, ultra: 0.62, coding: 0.92 },
      usable_group: {
        default: '默认分组',
        assistant: 'AI 助手',
        vip: 'VIP',
        'Claude-Antigravity': 'Pro优专属倍率',
        ultra: 'Ultra优专属倍率',
        coding: '编程模型优化分组',
      },
      group_details: {
        default: '标准价格分组，覆盖大部分通用模型，适合偶尔调用和基础测试。',
        assistant: '适合站内助手、轻量问答和自动化辅助场景，优先保持稳定可用。',
        vip: '面向高频用户的优惠分组，适合日常大量调用和通用模型使用。',
        'Claude-Antigravity': 'Pro优用户可享受更低倍率，适合常用高级模型、长对话和生产级调用。',
        ultra: 'Ultra优用户的旗舰分组，适合最高阶模型、编程代理和高并发任务。',
        coding: '编程模型优化分组，优先覆盖 Claude、Gemini 和 GPT 的 coding 场景。',
      },
    })
  }
  if (path === '/api/model-status' && method === 'GET') {
    return ok({
      window: url.searchParams.get('window') || '1h',
      updated_at: nowSec(),
      models: [
        { model_name: 'claude-opus-4-6', status: 'green', success_rate: 0.99, total_requests: 2222, slots: makeSlots(24, 'green') },
        { model_name: 'gpt-5.5', status: 'yellow', success_rate: 0.91, total_requests: 208, slots: makeSlots(24, 'yellow') },
        { model_name: 'gemini-2.5-pro', status: 'green', success_rate: 0.97, total_requests: 411, slots: makeSlots(24, 'green') },
      ],
    })
  }

  if (path === '/api/ui/model-reviews/rankings' && method === 'GET') {
    return ok({
      entries: modelReviewRankings(),
      settings: debugState.modelReviewSettings,
      my_account: debugState.modelReviewAccount,
      updated_at: nowSec(),
    })
  }
  if (path === '/api/ui/model-reviews' && method === 'GET') {
    let items = modelReviewVisibleItems()
    const modelName = url.searchParams.get('model_name')
    if (modelName) items = items.filter((item) => item.model_name === modelName)
    items = [...items].sort((a, b) => Number(b.featured) - Number(a.featured) || b.helpful_count - a.helpful_count || b.updated_at - a.updated_at)
    return page(paginate(items, url), items.length)
  }
  if (path === '/api/ui/model-reviews/eligibility' && method === 'GET') {
    return ok(modelReviewUsage(url.searchParams.get('model_name') || ''))
  }
  if (path === '/api/ui/model-reviews' && method === 'POST') {
    const usage = modelReviewUsage(body.model_name)
    if (!usage.eligible) return plain({ success: false, message: '使用过该模型后才能评价' })
    const existingIndex = debugState.modelReviews.findIndex((item) => item.user_id === DEBUG_USER.id && item.model_name === body.model_name)
    const existing = existingIndex >= 0 ? debugState.modelReviews[existingIndex] : null
    const score = modelReviewQualityScore(body)
    const targetQuality = Math.round((debugState.modelReviewSettings.quality_reward_max || 0) * score / 100)
    const baseAward = existing ? 0 : (debugState.modelReviewSettings.base_review_points || 0)
    const qualityDelta = Math.max(0, targetQuality - (existing?.quality_points_awarded || 0))
    const awarded = Math.min(baseAward + qualityDelta, debugState.modelReviewSettings.daily_points_cap || baseAward + qualityDelta)
    debugState.modelReviewAccount.available_points += awarded
    debugState.modelReviewAccount.total_earned += awarded
    debugState.modelReviewAccount.updated_at = nowSec()
    const item = {
      ...(existing || {}),
      id: existing?.id || nextId(debugState.modelReviews, 90000),
      user_id: DEBUG_USER.id,
      username: DEBUG_USER.username,
      model_name: body.model_name,
      rating: body.rating,
      scenario: body.scenario || '',
      tags: JSON.stringify(body.tags || []),
      tag_list: body.tags || [],
      pros: body.pros || '',
      cons: body.cons || '',
      content: body.content || '',
      anonymous: Boolean(body.anonymous),
      hide_usage: Boolean(body.hide_usage),
      usage_count: usage.count,
      usage_tokens: usage.tokens,
      usage_quota: usage.quota,
      last_used_at: usage.last_used_at,
      quality_score: score,
      helpful_count: existing?.helpful_count || 0,
      featured: Boolean(existing?.featured),
      status: debugState.modelReviewSettings.require_admin_review ? 'pending' : 'visible',
      base_points_awarded: (existing?.base_points_awarded || 0) + baseAward,
      quality_points_awarded: (existing?.quality_points_awarded || 0) + qualityDelta,
      helpful_points_awarded: existing?.helpful_points_awarded || 0,
      featured_points_awarded: existing?.featured_points_awarded || 0,
      total_points_awarded: (existing?.total_points_awarded || 0) + awarded,
      created_at: existing?.created_at || nowSec(),
      updated_at: nowSec(),
    }
    if (existingIndex >= 0) debugState.modelReviews[existingIndex] = item
    else debugState.modelReviews.unshift(item)
    return ok({ review: modelReviewView(item), account: debugState.modelReviewAccount })
  }
  const helpfulMatch = path.match(/^\/api\/ui\/model-reviews\/(\d+)\/helpful$/)
  if (helpfulMatch && method === 'POST') {
    const id = Number(helpfulMatch[1])
    const index = debugState.modelReviews.findIndex((item) => Number(item.id) === id)
    if (index >= 0) {
      debugState.modelReviews[index].helpful_count = (debugState.modelReviews[index].helpful_count || 0) + 1
      debugState.modelReviews[index].helpful_by_me = true
      return ok({ review: modelReviewView(debugState.modelReviews[index]), account: debugState.modelReviewAccount })
    }
    return plain({ success: false, message: '评价不存在' })
  }
  if (path === '/api/ui/model-reviews/points' && method === 'GET') {
    return ok({ account: debugState.modelReviewAccount, setting: debugState.modelReviewSettings })
  }
  if (path === '/api/ui/model-reviews/points/redeem' && method === 'POST') {
    const points = Number(body.points || 0)
    if (points <= 0 || debugState.modelReviewAccount.available_points < points) return plain({ success: false, message: '可用食评积分不足' })
    debugState.modelReviewAccount.available_points -= points
    debugState.modelReviewAccount.redeemed_points += points
    debugState.modelReviewAccount.updated_at = nowSec()
    return ok({ account: debugState.modelReviewAccount, quota: points * 500 })
  }
  if (path === '/api/ui/admin/model-reviews/settings' && method === 'GET') return ok(debugState.modelReviewSettings)
  if (path === '/api/ui/admin/model-reviews/settings' && method === 'PUT') {
    debugState.modelReviewSettings = { ...debugState.modelReviewSettings, ...body, id: 1, updated_at: nowSec() }
    return ok(debugState.modelReviewSettings)
  }
  if (path === '/api/ui/admin/model-reviews' && method === 'GET') {
    let items = filterKeyword(debugState.modelReviews, url, ['model_name', 'username', 'content'])
    const reviewStatus = url.searchParams.get('status')
    if (reviewStatus) items = items.filter((item) => item.status === reviewStatus)
    items = [...items].sort((a, b) => b.updated_at - a.updated_at)
    return page(paginate(items, url), items.length)
  }
  const adminModelReviewMatch = path.match(/^\/api\/ui\/admin\/model-reviews\/(\d+)$/)
  if (adminModelReviewMatch && method === 'PATCH') {
    const id = Number(adminModelReviewMatch[1])
    const index = debugState.modelReviews.findIndex((item) => Number(item.id) === id)
    if (index >= 0) {
      debugState.modelReviews[index] = { ...debugState.modelReviews[index], ...body, updated_at: nowSec() }
      if (body.featured && !debugState.modelReviews[index].featured_points_awarded) {
        const award = debugState.modelReviewSettings.featured_review_points || 0
        debugState.modelReviews[index].featured_points_awarded = award
        debugState.modelReviews[index].total_points_awarded = (debugState.modelReviews[index].total_points_awarded || 0) + award
      }
      return ok(debugState.modelReviews[index])
    }
    return plain({ success: false, message: '评价不存在' })
  }

  if (path === '/api/ui/page-config' && method === 'GET') {
    return ok({
      api_urls: debugState.pageConfig.api_urls.filter((item) => item.enabled),
      membership_badges: debugState.pageConfig.membership_badges,
      updated_at: debugState.pageConfig.updated_at,
    })
  }
  if (path === '/api/ui/admin/page-config' && method === 'GET') return ok(debugState.pageConfig)
  if (path === '/api/ui/admin/page-config' && method === 'PUT') {
    debugState.pageConfig = {
      ...debugState.pageConfig,
      api_urls: Array.isArray(body.api_urls) ? body.api_urls : [],
      membership_badges: Array.isArray(body.membership_badges) ? body.membership_badges : debugState.pageConfig.membership_badges,
      updated_at: nowSec(),
    }
    return ok(debugState.pageConfig)
  }

  if (path === '/api/ui/announcements' && method === 'GET') return page(paginate(activeAnnouncements(), url), activeAnnouncements().length)
  if (path === '/api/ui/announcements/active' && method === 'GET') return page(activeAnnouncements().filter((item) => item.force_popup))
  if (path.match(/^\/api\/ui\/announcement_acks\/\d+$/) && method === 'POST') {
    const id = Number(path.match(/^\/api\/ui\/announcement_acks\/(\d+)$/)?.[1])
    const announcement = debugState.announcements.find((item) => Number(item.id) === id)
    if (announcement) {
      const sourceKey = `announcement:${announcement.id}:v${announcement.version || 1}`
      debugState.notifications = debugState.notifications.map((item) => (
        item.source_key === sourceKey
          ? { ...item, unread: false, acknowledged: true, read_at: nowSec(), acknowledged_at: nowSec() }
          : item
      ))
    }
    return ok(null)
  }
  if (path === '/api/ui/admin/announcements' && method === 'GET') return adminAnnouncementResponse(url)
  if (path === '/api/ui/admin/announcements' && method === 'POST') {
    const item = { id: nextId(debugState.announcements), version: 1, created_at: nowSec(), updated_at: nowSec(), ...body }
    debugState.announcements.unshift(item)
    syncAnnouncementNotification(item)
    return ok(item)
  }
  const announcementMatch = path.match(/^\/api\/ui\/admin\/announcements\/(\d+)$/)
  if (announcementMatch && (method === 'PUT' || method === 'PATCH')) {
    const id = Number(announcementMatch[1])
    const index = debugState.announcements.findIndex((item) => Number(item.id) === id)
    if (index >= 0) {
      debugState.announcements[index] = {
        ...debugState.announcements[index],
        ...body,
        version: method === 'PUT' ? (debugState.announcements[index].version || 1) + 1 : debugState.announcements[index].version,
        updated_at: nowSec(),
      }
      syncAnnouncementNotification(debugState.announcements[index])
      return ok(debugState.announcements[index])
    }
    return ok(null)
  }
  if (announcementMatch && method === 'DELETE') {
    debugState.announcements = debugState.announcements.filter((item) => Number(item.id) !== Number(announcementMatch[1]))
    debugState.notifications = debugState.notifications.filter(
      (item) => !(item.source_type === 'announcement' && Number(item.source_id) === Number(announcementMatch[1])),
    )
    return ok(null)
  }

  if (path === '/api/ui/notifications' && method === 'GET') return notificationResponse(url)
  if (path === '/api/ui/notifications/unread-count' && method === 'GET') {
    return ok({ unread: activeNotifications().filter((item) => item.unread).length })
  }
  if (path === '/api/ui/notifications/read-all' && method === 'POST') {
    let count = 0
    debugState.notifications = debugState.notifications.map((item) => {
      if (!item.unread || item.require_ack) return item
      count += 1
      return { ...item, unread: false, read_at: nowSec() }
    })
    return ok({ read: count })
  }
  const notificationMatch = path.match(/^\/api\/ui\/notifications\/(\d+)\/(read|ack)$/)
  if (notificationMatch && method === 'POST') {
    const id = Number(notificationMatch[1])
    const ack = notificationMatch[2] === 'ack'
    debugState.notifications = debugState.notifications.map((item) => (
      Number(item.id) === id
        ? { ...item, unread: false, acknowledged: ack || item.acknowledged, read_at: nowSec(), acknowledged_at: ack ? nowSec() : item.acknowledged_at }
        : item
    ))
    return ok(debugState.notifications.find((item) => Number(item.id) === id) || null)
  }
  if (path === '/api/ui/admin/notifications/settings' && method === 'GET') return ok(debugState.notificationSettings)
  if (path === '/api/ui/admin/notifications/settings' && method === 'PUT') {
    debugState.notificationSettings = {
      ...debugState.notificationSettings,
      ...body,
      id: 1,
      updated_at: nowSec(),
    }
    return ok(debugState.notificationSettings)
  }
  if (path === '/api/ui/admin/notifications' && method === 'GET') return adminNotificationResponse(url)
  if (path === '/api/ui/admin/notifications' && method === 'POST') {
    const item = {
      id: nextId(debugState.notifications, 7000),
      created_at: nowSec(),
      updated_at: nowSec(),
      read_at: 0,
      acknowledged_at: 0,
      unread: true,
      acknowledged: false,
      ...body,
    }
    debugState.notifications.unshift(item)
    return ok(item)
  }
  const adminNotificationMatch = path.match(/^\/api\/ui\/admin\/notifications\/(\d+)$/)
  if (adminNotificationMatch && (method === 'PUT' || method === 'PATCH')) {
    const id = Number(adminNotificationMatch[1])
    const index = debugState.notifications.findIndex((item) => Number(item.id) === id)
    if (index >= 0) {
      debugState.notifications[index] = { ...debugState.notifications[index], ...body, updated_at: nowSec() }
      return ok(debugState.notifications[index])
    }
    return ok(null)
  }
  if (adminNotificationMatch && method === 'DELETE') {
    debugState.notifications = debugState.notifications.filter((item) => Number(item.id) !== Number(adminNotificationMatch[1]))
    return ok(null)
  }

  if (path === '/api/ui/refund-appeals/candidates' && method === 'GET') {
    const items = debugState.logs.filter((item) => item.type === 2 && item.quota > 0 && item.completion_tokens === 0)
    return ok({
      available: items.length > 0,
      count: items.length,
      items,
      refund_quota: items.reduce((sum, item) => sum + Math.max(0, Number(item.quota) || 0), 0),
      pending_count: debugState.refundAppeals.filter((item) => item.status === 'pending').length,
      scan_start: daysAgo(2),
      scan_end: nowSec(),
    })
  }
  if (path === '/api/ui/refund-appeals' && method === 'POST') {
    const appeal = debugState.refundAppeals[0]
    if (appeal && debugState.notificationSettings.appeal_submitted_enabled) {
      debugState.notifications.unshift({
        id: nextId(debugState.notifications, 7000),
        title: '空回补偿申诉已提交',
        summary: `申诉单 #${appeal.id} 已进入人工审核。`,
        content: `申诉单 #${appeal.id} 已进入人工审核。`,
        category: 'appeal',
        level: 'info',
        source_type: 'refund_appeal',
        source_key: `appeal:${appeal.id}:pending:${Date.now()}`,
        source_id: appeal.id,
        source_version: 1,
        target_type: 'user',
        target_user_id: appeal.user_id,
        action_url: '/logs',
        require_ack: Boolean(debugState.notificationSettings.appeal_submitted_require_ack),
        enabled: true,
        created_at: nowSec(),
        updated_at: nowSec(),
        unread: true,
      })
    }
    return ok({ appeal })
  }
  if (path === '/api/ui/refund-appeals/self' && method === 'GET') return page(paginate(debugState.refundAppeals, url), debugState.refundAppeals.length)
  if (path === '/api/ui/admin/refund-appeals' && method === 'GET') return refundAppealResponse(url)
  if (path === '/api/ui/admin/refund-appeals/approve-all' && method === 'POST') {
    const pending = debugState.refundAppeals.filter((appeal) => appeal.status === 'pending')
    for (const item of pending) {
      item.status = 'approved'
      item.review_note = body.review_note || '批量审核通过'
      item.reviewed_at = nowSec()
      item.updated_at = nowSec()
      if (debugState.notificationSettings.appeal_approved_enabled) {
        debugState.notifications.unshift({
          id: nextId(debugState.notifications, 7000),
          title: '空回补偿申诉已通过',
          summary: `申诉单 #${item.id} 已通过。`,
          content: `申诉单 #${item.id} 已通过，补偿额度已到账。`,
          category: 'appeal',
          level: 'success',
          source_type: 'refund_appeal',
          source_key: `appeal:${item.id}:approved`,
          source_id: item.id,
          source_version: 1,
          target_type: 'user',
          target_user_id: item.user_id,
          action_url: '/logs',
          require_ack: Boolean(debugState.notificationSettings.appeal_approved_require_ack),
          enabled: true,
          created_at: nowSec(),
          updated_at: nowSec(),
          unread: true,
        })
      }
    }
    return ok({ total: pending.length, approved: pending.length, failed: 0, refund_quota: pending.reduce((sum, item) => sum + (item.refund_quota || 0), 0), appeals: pending, errors: [] })
  }
  const refundMatch = path.match(/^\/api\/ui\/admin\/refund-appeals\/(\d+)(?:\/(approve|reject))?$/)
  if (refundMatch && method === 'GET') {
    const item = debugState.refundAppeals.find((appeal) => Number(appeal.id) === Number(refundMatch[1]))
    return ok(item || null)
  }
  if (refundMatch && method === 'POST') {
    const item = debugState.refundAppeals.find((appeal) => Number(appeal.id) === Number(refundMatch[1]))
    if (item) {
      item.status = refundMatch[2] === 'approve' ? 'approved' : 'rejected'
      item.review_note = body.review_note || body.note || '调试审核说明'
      item.reviewed_at = nowSec()
      item.updated_at = nowSec()
      const approved = item.status === 'approved'
      const enabled = approved
        ? debugState.notificationSettings.appeal_approved_enabled
        : debugState.notificationSettings.appeal_rejected_enabled
      if (enabled) {
        debugState.notifications.unshift({
          id: nextId(debugState.notifications, 7000),
          title: approved ? '空回补偿申诉已通过' : '空回补偿申诉已驳回',
          summary: `申诉单 #${item.id} 已${approved ? '通过' : '驳回'}。`,
          content: item.review_note,
          category: 'appeal',
          level: approved ? 'success' : 'warning',
          source_type: 'refund_appeal',
          source_key: `appeal:${item.id}:${item.status}`,
          source_id: item.id,
          source_version: 1,
          target_type: 'user',
          target_user_id: item.user_id,
          action_url: '/logs',
          require_ack: Boolean(approved
            ? debugState.notificationSettings.appeal_approved_require_ack
            : debugState.notificationSettings.appeal_rejected_require_ack),
          enabled: true,
          created_at: nowSec(),
          updated_at: nowSec(),
          unread: true,
        })
      }
    }
    return ok(item || null)
  }

  if (path === '/api/ui/assistant/config' && method === 'GET') {
    const { api_key_set, ...clientConfig } = debugState.assistantConfig
    return ok(clientConfig)
  }
  if (path === '/api/ui/assistant/conversations' && method === 'GET') {
    const items = debugState.assistantConversations
      .filter((item) => !item.deleted_at)
      .sort((a, b) => b.updated_at - a.updated_at)
    return page(paginate(items, url), items.length)
  }
  if (path === '/api/ui/assistant/conversations' && method === 'POST') {
    const item = {
      id: nextId(debugState.assistantConversations),
      user_id: DEBUG_USER.id,
      title: body.title || '新的对话',
      last_message: '',
      created_at: nowSec(),
      updated_at: nowSec(),
      deleted_at: 0,
    }
    debugState.assistantConversations.unshift(item)
    return ok(item)
  }
  const assistantConversationMessagesMatch = path.match(/^\/api\/ui\/assistant\/conversations\/(\d+)\/messages$/)
  if (assistantConversationMessagesMatch && method === 'GET') {
    const id = Number(assistantConversationMessagesMatch[1])
    const conversation = debugState.assistantConversations.find((item) => Number(item.id) === id && !item.deleted_at)
    const items = debugState.assistantMessages
      .filter((item) => Number(item.conversation_id) === id)
      .sort((a, b) => a.created_at - b.created_at || a.id - b.id)
    return ok({ conversation, items })
  }
  const assistantConversationMatch = path.match(/^\/api\/ui\/assistant\/conversations\/(\d+)$/)
  if (assistantConversationMatch && method === 'DELETE') {
    const id = Number(assistantConversationMatch[1])
    const item = debugState.assistantConversations.find((conversation) => Number(conversation.id) === id)
    if (item) item.deleted_at = nowSec()
    return ok(null)
  }
  if (path === '/api/ui/assistant/analyze' && method === 'POST') {
    return ok({
      decision: 'self_solve',
      answer: assistantStreamText({ messages: [{ role: 'user', content: body.question || '调试问题' }], screenshots: body.screenshots || [] }),
    })
  }
  if (path === '/api/ui/admin/assistant/config' && method === 'GET') return ok(debugState.assistantConfig)
  if (path === '/api/ui/admin/assistant/config' && method === 'PUT') {
    debugState.assistantConfig = { ...debugState.assistantConfig, ...body, api_key_set: Boolean(body.api_key || debugState.assistantConfig.api_key_set), updated_at: nowSec() }
    return ok(debugState.assistantConfig)
  }
  if (path === '/api/ui/admin/assistant/documents' && method === 'GET') return page(debugState.assistantDocs)
  if (path === '/api/ui/admin/assistant/documents' && method === 'POST') {
    const item = { id: nextId(debugState.assistantDocs), created_at: nowSec(), updated_at: nowSec(), ...body }
    debugState.assistantDocs.unshift(item)
    return ok(item)
  }
  const assistantDocMatch = path.match(/^\/api\/ui\/admin\/assistant\/documents\/(\d+)$/)
  if (assistantDocMatch && method === 'PUT') {
    const index = debugState.assistantDocs.findIndex((item) => Number(item.id) === Number(assistantDocMatch[1]))
    if (index >= 0) debugState.assistantDocs[index] = { ...debugState.assistantDocs[index], ...body, updated_at: nowSec() }
    return ok(index >= 0 ? debugState.assistantDocs[index] : body)
  }
  if (assistantDocMatch && method === 'DELETE') {
    debugState.assistantDocs = debugState.assistantDocs.filter((item) => Number(item.id) !== Number(assistantDocMatch[1]))
    return ok(null)
  }
  if (path === '/api/ui/admin/assistant/sessions' && method === 'GET') return page(paginate(debugState.assistantSessions, url), debugState.assistantSessions.length)

  return plain({ success: true, message: 'debug mock fallback', data: null })
}
