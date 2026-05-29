import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, QrCode, AlertCircle, CheckCircle2, Clock, Heart, ArrowDown, X as XIcon } from 'lucide-react'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import { Kids61Hero, Kids61SkuCard, KIDS61_COLORS } from '../components/promotion/Kids61Layout.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import PayMethodIcon from '../components/clay/PayMethodIcon.jsx'
import api from '../services/api.js'
import { getKpayQRCode } from '../services/topup.js'
import { useToast } from '../context/ToastContext.jsx'
import { getCurrencyConfig } from '../utils/quota.js'

// 复用 TopUp 的 localStorage key，让两个页面共享同一个待支付订单状态
const KPAY_PENDING_ORDER_KEY = 'youkies_pending_kpay_order'
const KPAY_PENDING_ORDER_TTL_MS = 30 * 60 * 1000

const savePendingKpayOrder = (order) => {
  if (!order?.trade_no || typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(KPAY_PENDING_ORDER_KEY, JSON.stringify({ ...order, saved_at: Date.now() }))
  } catch (_) {}
}

const clearPendingKpayOrder = () => {
  if (typeof window === 'undefined') return
  try { window.localStorage?.removeItem(KPAY_PENDING_ORDER_KEY) } catch (_) {}
}

/**
 * 金额展示：最多 2 位小数，去掉尾随零。
 * 5.21 → "5.21"   52.10 → "52.1"   99 → "99"   99.99 → "99.99"
 */
function fmtAmount(n) {
  const s = Number(n || 0).toFixed(2)
  // 先去掉尾随零，再去掉裸的小数点
  return s.replace(/0+$/, '').replace(/\.$/, '') || '0'
}

/** SKU 上的金额显示：优先用 backend 提供的字面量字符串（保留 "5.20" "52.0" 等带零写法）；
    没有则降级到通用格式化。 */
function skuPrice(sku) {
  return sku?.price_display || fmtAmount(sku?.price_yuan)
}
function skuDelivered(sku) {
  return sku?.delivered_display || fmtAmount(sku?.delivered_yuan)
}

// 与 TopUp.jsx 同实现 — 微信内置浏览器 / 手机端识别，决定是否拉起支付 App。
function isMobilePaymentContext() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator?.userAgent || ''
  return (
    window.matchMedia?.('(max-width: 767px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua)
  )
}

/**
 * Promotion landing page — driven entirely by `/api/user/promotion/:slug` payload.
 *
 * UX 流程：
 *   1. 网格选商品（点击卡片只选中，不下单）
 *   2. 选中后底部"支付方式"面板出现，显示选中商品 + 支付宝 / 微信两个按钮
 *   3. 点击支付方式 → 创建 KPay 订单 + 弹扫码框
 *
 * 货币符号：跟随 getCurrencyConfig()（全局设置），而非硬编码 ¥。
 */
export default function PromotionPage() {
  const { slug = '520' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // 选中态：点击卡片只是 select，不立刻下单
  const [selectedSkuId, setSelectedSkuId] = useState('')

  // 创建订单 / 扫码态
  const [paying, setPaying] = useState('') // payment_method while 下单中
  const [kpayOrder, setKpayOrder] = useState(null)
  const kpayPollRef = useRef(null)

  // 全局货币符号（跟 quota 显示设置统一）
  const { symbol: currencySymbol } = useMemo(() => getCurrencyConfig(), [])

  const load = useCallback(async () => {
    // dev 预览：/promotion/__preview_61 直接用本地 mock，不走 API
    if (slug === '__preview_61') {
      setCampaign(MOCK_KIDS61)
      setErr('')
      setLoading(false)
      return
    }
    try {
      const res = await api.get(`/api/user/promotion/${encodeURIComponent(slug)}`)
      const j = res.data
      if (!j?.success) {
        setErr(j?.message || '活动加载失败')
        setCampaign(null)
      } else {
        setCampaign(j.data)
        setErr('')
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  // 每 30 秒刷新一次销量
  useEffect(() => {
    if (!campaign) return
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [campaign, load])

  // 倒计时 tick
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1000000), 1000)
    return () => clearInterval(id)
  }, [])

  const countdown = useMemo(() => {
    if (!campaign?.ends_at) return null
    const now = Math.floor(Date.now() / 1000)
    const diff = campaign.ends_at - now
    if (diff <= 0) return { ended: true }
    const d = Math.floor(diff / 86400)
    const h = Math.floor((diff % 86400) / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    return { ended: false, d, h, m, s }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.ends_at, tick])

  // 选中商品的元数据
  const selectedSku = useMemo(() => {
    if (!selectedSkuId || !campaign) return null
    return campaign.skus.find((s) => s.id === selectedSkuId) || null
  }, [selectedSkuId, campaign])
  const isSelectablePurchasable = selectedSku?.state === 'purchasable'

  // 下单 - 用户已经选中 SKU + 选了支付方式
  const orderWith = async (method) => {
    if (!selectedSku || !isSelectablePurchasable || paying) return
    setPaying(method)
    try {
      const res = await api.post(`/api/user/promotion/${encodeURIComponent(slug)}/order`, {
        sku_id: selectedSku.id,
        payment_method: method,
      })
      const j = res.data
      if (!j?.success) {
        toast(j?.message || '下单失败', 'error')
        return
      }
      const orderPayload = { ...j.data, status: 'pending' }
      savePendingKpayOrder(orderPayload)
      setKpayOrder(orderPayload)
      // 移动端支付宝直接拉起 App（与 TopUp 同行为）；微信不支持外部 H5 直跳，
      // 仍走二维码 + 「保存截图打开微信」提示路径
      if (method === 'alipay' && isMobilePaymentContext() && orderPayload.direct_pay_url) {
        window.location.assign(orderPayload.direct_pay_url)
      }
    } catch (e) {
      toast(e?.response?.data?.message || e.message || '下单失败', 'error')
    } finally {
      setPaying('')
    }
  }

  // KPay 状态轮询
  useEffect(() => {
    if (!kpayOrder?.trade_no) return
    if (['success', 'failed', 'expired'].includes(kpayOrder?.status)) return
    if (kpayPollRef.current) clearInterval(kpayPollRef.current)
    kpayPollRef.current = setInterval(async () => {
      try {
        const res = await api.post('/api/user/kpay/check', {
          trade_no: kpayOrder.trade_no,
          provider_order_no: kpayOrder.provider_order_no || '',
        })
        const next = res.data?.data
        if (next?.status && next.status !== kpayOrder.status) {
          setKpayOrder((cur) => (cur ? { ...cur, status: next.status } : cur))
          if (next.status === 'success') {
            clearPendingKpayOrder()
            toast('支付到账，活动套餐已发放', 'success')
            load()
          }
        }
      } catch (_) { /* ignore */ }
    }, 5000)
    return () => {
      if (kpayPollRef.current) clearInterval(kpayPollRef.current)
    }
  }, [kpayOrder?.trade_no, kpayOrder?.status, load, toast])

  if (loading) {
    return (
      <ClayConsoleShell showAssistantWidget={false}>
        <div className="p-12 text-center text-clay-faint">读取活动信息中</div>
      </ClayConsoleShell>
    )
  }
  if (err || !campaign) {
    return (
      <ClayConsoleShell showAssistantWidget={false}>
        <ClayAlert tone="error">{err || '活动不存在'}</ClayAlert>
        <button
          onClick={() => navigate('/topup')}
          className="mt-4 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay-sm hover:shadow-clay text-sm font-black"
        >
          返回充值页
        </button>
      </ClayConsoleShell>
    )
  }

  const inactive = !campaign.active
  const ended = countdown?.ended
  const theme = campaign.theme_color || 'pink'
  const isKids61 = campaign.layout_variant === 'kids_61'

  return (
    <ClayConsoleShell showAssistantWidget={false}>
      {/* Hero 头图区 */}
      {isKids61 ? (
        <Kids61Hero campaign={campaign} countdown={countdown} />
      ) : (
        <ClayCard
          className={`relative overflow-hidden mb-6 bg-gradient-to-br from-clay-${theme}-50 via-white to-clay-${theme}-100`}
        >
          <div className="pointer-events-none absolute -left-6 -bottom-10 text-[180px] opacity-10 rotate-12 select-none" aria-hidden>
            {campaign.emoji || '🎉'}
          </div>
          <div className="pointer-events-none absolute -right-4 -top-8 text-[120px] opacity-10 -rotate-12 select-none" aria-hidden>
            {campaign.emoji || '🎉'}
          </div>
          <div className="relative flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-6 py-2 text-center sm:text-left">
            <div className="text-6xl select-none flex-shrink-0" aria-hidden>
              {campaign.emoji || '🎉'}
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-clay-ink leading-tight">
                {campaign.title}
              </h1>
              <SubtitleWithSignature subtitle={campaign.subtitle} />
            </div>
            <div className="flex-shrink-0">
              {ended ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-xs font-black text-clay-faint">
                  已结束
                </span>
              ) : inactive ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-clay-pill bg-clay-yellow-100 shadow-clay-sm text-xs font-black text-clay-yellow-ink">
                  未开始
                </span>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-clay-pill bg-white shadow-clay-sm">
                  <Clock className={`w-3.5 h-3.5 text-clay-${theme}-ink`} strokeWidth={2.5} />
                  <span className="text-xs sm:text-sm font-black text-clay-ink tabular-nums whitespace-nowrap">
                    {countdown.d > 0 ? `${countdown.d}天` : ''}
                    {String(countdown.h).padStart(2, '0')}:
                    {String(countdown.m).padStart(2, '0')}:
                    {String(countdown.s).padStart(2, '0')}
                  </span>
                  <span className="hidden sm:inline text-xs text-clay-faint font-bold">后结束</span>
                </div>
              )}
            </div>
          </div>
        </ClayCard>
      )}

      {/* 提示文案 */}
      {!inactive && !ended && (
        <div className="text-center mb-4 text-xs sm:text-sm text-clay-faint font-bold flex items-center justify-center gap-1.5">
          <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.5} />
          选择一个套餐 · 下方选择支付方式
        </div>
      )}

      {/* SKU 网格 */}
      {isKids61 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {campaign.skus.map((sku, idx) => (
            <Kids61SkuCard
              key={sku.id}
              sku={sku}
              colorIndex={idx}
              currencySymbol={currencySymbol}
              selected={selectedSkuId === sku.id}
              disabled={inactive || ended}
              onSelect={() => setSelectedSkuId(sku.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {campaign.skus.map((sku) => (
            <SkuCard
              key={sku.id}
              sku={sku}
              theme={theme}
              currencySymbol={currencySymbol}
              selected={selectedSkuId === sku.id}
              disabled={inactive || ended}
              onSelect={() => setSelectedSkuId(sku.id)}
            />
          ))}
        </div>
      )}

      {/* 防滥用门槛提示 */}
      {(campaign.require_email_verified || campaign.min_account_age_days > 0) && (
        <div className="text-[11px] text-clay-faint text-center mt-2 mb-24 sm:mb-8">
          参与门槛：
          {campaign.require_email_verified && '需绑定并验证邮箱'}
          {campaign.require_email_verified && campaign.min_account_age_days > 0 && '；'}
          {campaign.min_account_age_days > 0 && `账号需注册满 ${campaign.min_account_age_days} 天`}
        </div>
      )}

      {/* 底部支付方式面板 — 选中可购买的 SKU 才出现 */}
      {selectedSku && isSelectablePurchasable && !inactive && !ended && (
        <PaymentBar
          sku={selectedSku}
          currencySymbol={currencySymbol}
          theme={theme}
          paying={paying}
          onPay={orderWith}
          onCancel={() => setSelectedSkuId('')}
        />
      )}

      {/* KPay QR Modal */}
      <ClayModal
        open={!!kpayOrder}
        onClose={() => setKpayOrder(null)}
        title="扫码支付"
        size="sm"
      >
        <div className="space-y-4">
          {kpayOrder?.status === 'success' && (
            <ClayAlert tone="success">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              支付到账，额度已发放
            </ClayAlert>
          )}
          {(kpayOrder?.status === 'failed' || kpayOrder?.status === 'expired') && (
            <ClayAlert tone="error">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {kpayOrder?.status === 'expired' ? '订单已过期，请重新下单' : '支付失败，请重试'}
            </ClayAlert>
          )}
          {!['success', 'failed', 'expired'].includes(kpayOrder?.status) && (
            <ClayAlert tone="info">
              {isMobilePaymentContext() && kpayOrder?.payment_method === 'wechat'
                ? '请长按二维码保存或截图，回到微信扫一扫，完成后会自动到账'
                : kpayOrder?.payment_method === 'wechat'
                  ? '请用微信扫一扫，完成后会自动到账'
                  : '请用支付宝扫一扫，完成后会自动到账'}
            </ClayAlert>
          )}
          <div className="mx-auto w-56 h-56 rounded-clay-lg shadow-clay-inset bg-white flex items-center justify-center p-3">
            {kpayOrder?.qr_code_data_uri || kpayOrder?.qr_code_image_url ? (
              <img
                src={kpayOrder.qr_code_data_uri || kpayOrder.qr_code_image_url}
                alt="KPay QR"
                className="w-full h-full object-contain"
              />
            ) : (
              <QrCode className="w-20 h-20 text-clay-faint" />
            )}
          </div>
          <div className="divide-y divide-clay-line/10 text-sm">
            <div className="flex justify-between py-2.5 items-baseline">
              <span className="text-clay-faint font-bold">实付金额</span>
              <span className="font-black text-clay-pink-400 text-lg tabular-nums">
                {currencySymbol}{kpayOrder?.price_display || fmtAmount(kpayOrder?.amount)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 items-baseline">
              <span className="text-clay-faint font-bold">到账</span>
              <span className="font-black text-emerald-600 text-lg tabular-nums">
                {currencySymbol}{kpayOrder?.delivered_display || fmtAmount(kpayOrder?.delivered_yuan)}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-clay-faint font-bold">订单号</span>
              <span className="font-mono text-xs break-all text-right">{kpayOrder?.trade_no}</span>
            </div>
          </div>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}

function SkuCard({ sku, theme, currencySymbol, selected, disabled, onSelect }) {
  const isPurchasable = sku.state === 'purchasable'
  const isSoldOut = sku.state === 'sold_out'
  const isUserLimit = sku.state === 'user_limit'
  const isInactive = sku.state === 'activity_closed'

  const interactive = isPurchasable && !disabled
  const dimmed = !interactive

  const stateLabel = isSoldOut
    ? '已抢完'
    : isUserLimit
      ? `已购满 ${sku.user_bought_n} 次`
      : isInactive
        ? '活动未开放'
        : null

  const progressPct = sku.total_limit > 0
    ? Math.min(100, Math.round((sku.sold_count / sku.total_limit) * 100))
    : 0

  // 优惠节省 = 到账 - 实付。折扣率展示为「N.N 折」（10 折 = 原价）
  const savings = sku.delivered_yuan - sku.price_yuan
  const zhe = sku.delivered_yuan > 0
    ? (10 * sku.price_yuan / sku.delivered_yuan).toFixed(1)
    : null

  // 主推光晕：选中时改为主题色 ring，否则金色
  const highlightRing = selected
    ? `ring-2 ring-clay-${theme}-300`
    : sku.highlight
      ? 'ring-2 ring-clay-yellow-300'
      : ''
  // 选中态做 inset 阴影模拟"按下"
  const selectedInset = selected ? 'shadow-clay-inset' : ''

  return (
    <button
      type="button"
      onClick={interactive ? onSelect : undefined}
      disabled={!interactive}
      className={`relative text-left p-5 rounded-clay-lg bg-clay-bg ${selected ? '' : 'shadow-clay-sm hover:shadow-clay'} ${selectedInset} ${highlightRing} ${dimmed ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'} transition-shadow`}
    >
      {/* 顶部一行：emoji + 标题 + 已选/主推角标 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="text-4xl sm:text-5xl select-none flex-shrink-0 leading-none">{sku.emoji || '🎁'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-base sm:text-lg font-black text-clay-ink leading-tight truncate">
            {sku.label}
          </div>
          {sku.subtitle && (
            <div className="text-[11px] text-clay-faint font-bold mt-0.5 truncate">
              {sku.subtitle}
            </div>
          )}
        </div>
        {selected ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-${theme}-100 text-clay-${theme}-ink shadow-clay-sm text-[10px] font-black flex-shrink-0`}>
            <CheckCircle2 className="w-3 h-3" strokeWidth={2.6} />
            已选
          </span>
        ) : sku.highlight ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm text-[10px] font-black flex-shrink-0">
            <Sparkles className="w-3 h-3" strokeWidth={2.6} />
            主推
          </span>
        ) : null}
      </div>

      {/* 中区 — 到账金额 hero */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mb-0.5">
            到 账
          </div>
          <div className={`text-3xl sm:text-4xl font-black tabular-nums text-clay-${theme}-ink leading-none`}>
            {currencySymbol}{skuDelivered(sku)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mb-0.5">
            付 款
          </div>
          <div className="text-base font-black tabular-nums text-clay-ink leading-none">
            {currencySymbol}{skuPrice(sku)}
          </div>
        </div>
      </div>

      {/* 省钱标签（凹陷 chip 风） */}
      {savings > 0.005 && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-[11px] font-black text-clay-pink-400 mb-3">
          <Sparkles className="w-3 h-3" strokeWidth={2.6} />
          省 {currencySymbol}{fmtAmount(savings)}{zhe && ` · ${zhe} 折`}
        </div>
      )}

      {/* 销量进度 */}
      {sku.total_limit > 0 && (
        <div className="mb-2">
          <div className="h-1.5 rounded-full bg-clay-bg shadow-clay-inset-sm overflow-hidden">
            <div
              className={`h-full bg-clay-${theme}-300 transition-all`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-clay-faint mt-1 tabular-nums">
            <span>已售 {sku.sold_count}</span>
            <span>限量 {sku.total_limit}</span>
          </div>
        </div>
      )}

      {/* 个人限购显示 */}
      {sku.per_user_limit > 0 && !isSoldOut && (
        <div className="text-[11px] text-clay-faint font-bold">
          {isUserLimit
            ? `您已购买 ${sku.user_bought_n} 次（已达上限）`
            : `您还可购买 ${sku.user_can_buy_n} 次`}
        </div>
      )}

      {/* 售罄/上限/未开放：覆盖灰角标 */}
      {stateLabel && (
        <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-[11px] font-black text-clay-faint">
          {stateLabel}
        </div>
      )}
    </button>
  )
}

/**
 * 副标题渲染：检测「— 来自」署名标记，把署名拆出来配 Claude 像素吉祥物 gif 单独展示。
 * 没有署名时退化为普通副标题。
 */
function SubtitleWithSignature({ subtitle }) {
  if (!subtitle) return null
  const idx = subtitle.indexOf('— 来自')
  if (idx < 0) {
    return (
      <p className="text-xs sm:text-sm text-clay-faint font-bold mt-1 leading-snug">
        {subtitle}
      </p>
    )
  }
  const main = subtitle.slice(0, idx).replace(/[·\s]+$/, '').trim()
  const credit = subtitle.slice(idx).replace(/^—\s*/, '').trim()
  return (
    <>
      <p className="text-xs sm:text-sm text-clay-faint font-bold mt-1 leading-snug">
        {main}
      </p>
      <div className="inline-flex items-center gap-2 mt-2 justify-center sm:justify-start">
        <img
          src="/claude-sprite.gif"
          alt="Claude"
          className="w-11 h-11 sm:w-12 sm:h-12 object-contain flex-shrink-0"
          loading="lazy"
        />
        <span className="text-xs sm:text-sm text-clay-faint font-bold whitespace-nowrap">{credit}</span>
      </div>
    </>
  )
}

/**
 * 底部支付方式面板。
 * 桌面端：随页面流动，圆角大卡。
 * 移动端：sticky 在底部（safe-area-inset 兼容），始终可见。
 */
function PaymentBar({ sku, currencySymbol, theme, paying, onPay, onCancel }) {
  return (
    <div
      className="fixed sm:relative bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto sm:right-auto z-40 px-3 pb-3 sm:px-0 sm:pb-0"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      <ClayCard className={`p-4 sm:p-5 bg-gradient-to-br from-clay-${theme}-50 via-white to-clay-${theme}-100`}>
        {/* 顶部一行：已选商品摘要 + 取消选择按钮 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl select-none flex-shrink-0">{sku.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-clay-ink truncate">{sku.label}</div>
            <div className="text-[11px] text-clay-faint font-bold truncate">
              {currencySymbol}{skuPrice(sku)} → 到账 {currencySymbol}{skuDelivered(sku)}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-clay-bg shadow-clay-sm hover:shadow-clay flex items-center justify-center flex-shrink-0"
            aria-label="取消选择"
          >
            <XIcon className="w-4 h-4 text-clay-faint" strokeWidth={2.5} />
          </button>
        </div>

        {/* 两个支付方式按钮 */}
        <div className="grid grid-cols-2 gap-3">
          <PayButton
            method="alipay"
            label="支付宝"
            paying={paying === 'alipay'}
            disabled={!!paying}
            onClick={() => onPay('alipay')}
          />
          <PayButton
            method="wechat"
            label="微信支付"
            paying={paying === 'wechat'}
            disabled={!!paying}
            onClick={() => onPay('wechat')}
          />
        </div>

        {/* 实付提示 */}
        <div className={`mt-3 text-center text-xs text-clay-faint font-bold`}>
          实付 <span className={`text-clay-${theme}-ink font-black tabular-nums`}>
            {currencySymbol}{skuPrice(sku)}
          </span>
        </div>
      </ClayCard>
    </div>
  )
}

function PayButton({ method, label, paying, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-clay-pill bg-clay-bg shadow-clay-sm font-black text-sm transition-all
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-clay hover:-translate-y-0.5'}
        ${paying ? 'shadow-clay-inset' : ''}
      `}
    >
      <PayMethodIcon type={method} className="w-6 h-6" />
      <span>{paying ? '处理中…' : label}</span>
      {paying && <Heart className="w-3.5 h-3.5 animate-pulse text-clay-pink-400" />}
    </button>
  )
}

// ─── Dev 预览 mock（访问 /promotion/__preview_61 触发） ───────────────────────

const MOCK_KIDS61 = {
  id: 999,
  slug: '__preview_61',
  title: '六一儿童节',
  subtitle: '世界很大，今天先做个小孩。',
  emoji: '🎈',
  theme_color: 'pink',
  layout_variant: 'kids_61',
  active: true,
  enabled: true,
  starts_at: Math.floor(Date.now() / 1000) - 3600,
  ends_at: Math.floor(new Date('2026-06-01T23:59:59+08:00').getTime() / 1000),
  require_email_verified: false,
  min_account_age_days: 0,
  skus: [
    {
      id: 'preview-1', sku_key: 'preview-1', label: '六一特惠', subtitle: '每人限购一次',
      emoji: '🎁', price_yuan: 6.1, delivered_yuan: 10, price_display: '6.1',
      total_limit: 100, per_user_limit: 1, sold_count: 37,
      highlight: false, state: 'purchasable', user_can_buy_n: 1, user_bought_n: 0,
    },
    {
      id: 'preview-2', sku_key: 'preview-2', label: '小熊礼包', subtitle: '',
      emoji: '🎈', price_yuan: 28, delivered_yuan: 30, price_display: '',
      total_limit: 0, per_user_limit: 5, sold_count: 0,
      highlight: false, state: 'purchasable', user_can_buy_n: 5, user_bought_n: 0,
    },
    {
      id: 'preview-3', sku_key: 'preview-3', label: '儿童礼包', subtitle: '呼应节日数字',
      emoji: '🌈', price_yuan: 56, delivered_yuan: 61, price_display: '',
      total_limit: 0, per_user_limit: 3, sold_count: 0,
      highlight: false, state: 'purchasable', user_can_buy_n: 3, user_bought_n: 0,
    },
    {
      id: 'preview-4', sku_key: 'preview-4', label: '成长礼包', subtitle: '',
      emoji: '🌟', price_yuan: 98, delivered_yuan: 108, price_display: '',
      total_limit: 0, per_user_limit: 2, sold_count: 0,
      highlight: false, state: 'purchasable', user_can_buy_n: 2, user_bought_n: 0,
    },
    {
      id: 'preview-5', sku_key: 'preview-5', label: '欢乐礼包', subtitle: '最受欢迎',
      emoji: '⭐', price_yuan: 168, delivered_yuan: 188, price_display: '',
      total_limit: 0, per_user_limit: 2, sold_count: 0,
      highlight: true, state: 'purchasable', user_can_buy_n: 2, user_bought_n: 0,
    },
    {
      id: 'preview-6', sku_key: 'preview-6', label: '童年礼包', subtitle: '',
      emoji: '🎊', price_yuan: 255, delivered_yuan: 288, price_display: '',
      total_limit: 0, per_user_limit: 1, sold_count: 0,
      highlight: false, state: 'purchasable', user_can_buy_n: 1, user_bought_n: 0,
    },
  ],
}
