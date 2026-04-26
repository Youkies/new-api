import { useState } from 'react'
import { Link2, Copy, Check, Globe2, Zap, AlertTriangle } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayCheckbox from '../components/clay/ClayCheckbox.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'

const SUPPRESS_KEY = 'uiweb.apiUrls.suppressV1Notice'

const URLS = [
  {
    url: 'https://newapi.youkies.space',
    label: '通用地址',
    desc: '直连服务器，全球可访问',
    icon: Globe2,
    tone: 'pink',
  },
  {
    url: 'https://newapi.youkies.cn',
    label: '国内优化',
    desc: '国内中转加速，已备案',
    icon: Zap,
    tone: 'blue',
  },
]

const TONE_CARD = {
  pink: 'bg-gradient-to-br from-clay-pink-50 to-clay-pink-100',
  blue: 'bg-gradient-to-br from-clay-blue-50 to-clay-blue-100',
}

const TONE_ICON = {
  pink: 'bg-clay-pink-200 text-white',
  blue: 'bg-clay-blue-200 text-white',
}

export default function ApiUrls() {
  const toast = useToast()
  const [copiedUrl, setCopiedUrl] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingUrl, setPendingUrl] = useState('')
  const [dontShow, setDontShow] = useState(false)

  const writeClipboard = async (url) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl((v) => (v === url ? '' : v)), 2000)
      toast('已复制到剪贴板', 'success')
    } catch (e) {
      toast('复制失败，请手动复制', 'error')
    }
  }

  const onCopy = async (url) => {
    await writeClipboard(url)
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
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl">
        {URLS.map((item) => {
          const Icon = item.icon
          const copied = copiedUrl === item.url
          return (
            <ClayCard
              key={item.url}
              className={`!p-7 ${TONE_CARD[item.tone]}`}
            >
              <div className="flex items-start gap-4 mb-5">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-clay shrink-0 ${TONE_ICON[item.tone]}`}
                >
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black tracking-tight">{item.label}</h3>
                  <p className="text-sm text-clay-faint font-semibold mt-0.5">{item.desc}</p>
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

      <ClayCard className="mt-8 max-w-4xl !p-6 bg-gradient-to-br from-clay-yellow-50 to-clay-yellow-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/60 shadow-clay-sm flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-clay-pink-400" strokeWidth={2.5} />
          </div>
          <div className="text-sm leading-relaxed">
            <div className="font-extrabold text-base mb-1">使用提示</div>
            <p className="text-clay-ink/80">
              复制的地址<strong className="font-black">不带 <code className="px-1.5 py-0.5 rounded bg-white/70 font-mono">/v1</code></strong>。
              在某些客户端（如部分 OpenAI 兼容工具）中需要自行在末尾添加 <code className="px-1.5 py-0.5 rounded bg-white/70 font-mono">/v1</code> 后再使用。
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
            该地址 <strong className="font-black">不带 <code className="px-1.5 py-0.5 rounded bg-white/70 font-mono">/v1</code></strong>。
            在某些软件中需要在末尾自行添加 <code className="px-1.5 py-0.5 rounded bg-white/70 font-mono">/v1</code>。
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
