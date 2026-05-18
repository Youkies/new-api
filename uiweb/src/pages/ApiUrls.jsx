import { useEffect, useState } from 'react'
import { Link2, Copy, Check, Globe2, Zap, AlertTriangle, Loader2 } from 'lucide-react'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayCheckbox from '../components/clay/ClayCheckbox.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getPageConfig } from '../services/pageConfig.js'
import { copyTextToClipboard } from '../utils/clipboard.js'

const SUPPRESS_KEY = 'uiweb.apiUrls.suppressV1Notice'

const DEFAULT_URLS = [
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
]

const ICON_MAP = {
  globe: Globe2,
  zap: Zap,
  link: Link2,
}

const TONE_CARD = {
  pink: 'bg-gradient-to-br from-clay-pink-50 to-clay-pink-100',
  blue: 'bg-gradient-to-br from-clay-blue-50 to-clay-blue-100',
  green: 'bg-gradient-to-br from-clay-green-50 to-clay-green-100',
  yellow: 'bg-gradient-to-br from-clay-yellow-50 to-clay-yellow-100',
}

const TONE_ICON = {
  pink: 'bg-clay-pink-200 text-white',
  blue: 'bg-clay-blue-200 text-white',
  green: 'bg-clay-green-200 text-clay-green-ink',
  yellow: 'bg-clay-yellow-200 text-clay-yellow-ink',
}

function normalizeUrls(items) {
  const list = Array.isArray(items) && items.length > 0 ? items : DEFAULT_URLS
  return list
    .filter((item) => item?.url)
    .map((item, index) => ({
      url: String(item.url || '').trim(),
      label: String(item.label || `地址 ${index + 1}`).trim(),
      desc: String(item.desc || '').trim(),
      icon: ICON_MAP[item.icon] ? item.icon : 'link',
      tone: TONE_CARD[item.tone] ? item.tone : 'blue',
    }))
}

export default function ApiUrls() {
  const toast = useToast()
  const [urls, setUrls] = useState(DEFAULT_URLS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedUrl, setCopiedUrl] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingUrl, setPendingUrl] = useState('')
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    let alive = true
    async function loadConfig() {
      setLoading(true)
      setError('')
      try {
        const res = await getPageConfig()
        if (res?.success === false) throw new Error(res.message || '地址配置加载失败')
        const nextUrls = normalizeUrls(res?.data?.api_urls)
        if (alive) setUrls(nextUrls.length > 0 ? nextUrls : DEFAULT_URLS)
      } catch (err) {
        if (alive) {
          setError(err?.response?.data?.message || err.message || '地址配置加载失败，已显示默认地址')
          setUrls(DEFAULT_URLS)
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadConfig()
    return () => { alive = false }
  }, [])

  const writeClipboard = async (url) => {
    try {
      await copyTextToClipboard(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl((v) => (v === url ? '' : v)), 2000)
      toast('已复制到剪贴板', 'success')
      return true
    } catch (e) {
      toast('复制失败，请手动复制', 'error')
      return false
    }
  }

  const onCopy = async (url) => {
    const copied = await writeClipboard(url)
    if (!copied) return
    const suppressed = localStorage.getItem(SUPPRESS_KEY) === '1'
    if (!suppressed) {
      setPendingUrl(url)
      setDontShow(false)
      setModalOpen(true)
    }
  }

  const onConfirm = () => {
    if (dontShow) {
      try { localStorage.setItem(SUPPRESS_KEY, '1') } catch (_) {}
    }
    setModalOpen(false)
  }

  return (
    <ClayConsoleShell title="API 地址" subtitle="选择一个地址作为请求 BaseURL，点击即可复制">
      {error && (
        <ClayAlert tone="warning" className="max-w-4xl mb-5">
          {error}
        </ClayAlert>
      )}

      {loading ? (
        <ClayCard className="max-w-4xl !py-14 text-center">
          <div className="flex flex-col items-center gap-3 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="font-bold">加载地址配置中…</span>
          </div>
        </ClayCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 max-w-4xl">
          {urls.map((item) => {
            const Icon = ICON_MAP[item.icon] || Link2
            const copied = copiedUrl === item.url
            return (
              <ClayCard
                key={item.url}
                className={`!p-7 ${TONE_CARD[item.tone] || TONE_CARD.blue}`}
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-clay-sm shrink-0 ${TONE_ICON[item.tone] || TONE_ICON.blue}`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black tracking-tight break-words">{item.label}</h3>
                    {item.desc && (
                      <p className="text-sm text-clay-faint font-semibold mt-0.5 break-words">{item.desc}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-clay px-4 py-3.5 mb-4 bg-clay-bg shadow-clay-inset font-mono text-sm md:text-base font-bold text-clay-ink break-all select-all">
                  {item.url}
                </div>

                <ClayButton
                  variant="primary"
                  className="w-full"
                  onClick={() => onCopy(item.url)}
                >
                  {copied ? (
                    <span className="inline-flex items-center gap-2">
                      <Check className="w-4 h-4" strokeWidth={3} />
                      已复制
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Copy className="w-4 h-4" strokeWidth={2.5} />
                      一键复制
                    </span>
                  )}
                </ClayButton>
              </ClayCard>
            )
          })}
        </div>
      )}

      <ClayCard className="mt-8 max-w-4xl !p-6 bg-gradient-to-br from-clay-yellow-50 to-clay-yellow-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/60 shadow-clay-sm flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-clay-pink-400" strokeWidth={2.5} />
          </div>
          <div className="text-sm leading-relaxed">
            <div className="font-extrabold text-base mb-1">使用提示</div>
            <p className="text-clay-ink/80">
              上方地址会原样复制。部分 OpenAI 兼容客户端需要使用以 <code className="px-1.5 py-0.5 rounded-clay-sm bg-clay-surface/80 font-mono font-extrabold text-clay-blue-ink shadow-clay-xs">/v1</code> 结尾的 BaseURL，请按客户端要求填写。
            </p>
          </div>
        </div>
      </ClayCard>

      <ClayModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="复制成功"
        size="md"
        footer={
          <ClayButton variant="primary" onClick={onConfirm}>
            我已知晓
          </ClayButton>
        }
      >
        <div className="space-y-4">
          <p className="text-clay-ink leading-relaxed">
            已复制：
          </p>
          <div className="rounded-clay px-4 py-3 bg-clay-bg shadow-clay-inset font-mono text-sm font-bold break-all">
            {pendingUrl}
          </div>
          <p className="text-clay-ink leading-relaxed">
            部分软件需要在 BaseURL 末尾使用 <code className="px-1.5 py-0.5 rounded-clay-sm bg-clay-surface/80 font-mono font-extrabold text-clay-blue-ink shadow-clay-xs">/v1</code>，请按客户端要求确认。
          </p>
          <div className="pt-1">
            <ClayCheckbox
              checked={dontShow}
              onChange={setDontShow}
              label="不再提示"
            />
          </div>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
