import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, QrCode, AlertCircle, CheckCircle2, Clock, Heart } from 'lucide-react'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'

/**
 * Promotion landing page — driven entirely by `/api/promotion/:slug` payload.
 * v1 hardcodes 520 in the backend; the page itself is data-driven so future
 * activities (double 11, anniversary etc.) drop in by adding to setting.activePromotions.
 */
export default function PromotionPage() {
  const { slug = '520' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // KPay 弹窗
  const [orderingSku, setOrderingSku] = useState('')
  const [kpayOrder, setKpayOrder] = useState(null)
  const kpayPollRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/promotion/${encodeURIComponent(slug)}`)
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

  // 每 30 秒刷新一次销量数据
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

  // 下单
  const order = async (skuId) => {
    if (orderingSku) return
    setOrderingSku(skuId)
    try {
      const res = await api.post(`/api/promotion/${encodeURIComponent(slug)}/order`, {
        sku_id: skuId,
        payment_method: 'alipay', // 默认支付宝，二维码同时支持微信扫
      })
      const j = res.data
      if (!j?.success) {
        toast(j?.message || '下单失败', 'error')
        return
      }
      setKpayOrder({ ...j.data, status: 'pending' })
    } catch (e) {
      toast(e?.response?.data?.message || e.message || '下单失败', 'error')
    } finally {
      setOrderingSku('')
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
            toast('支付到账，活动套餐已发放', 'success')
            // 刷新销量
            load()
          }
        }
      } catch (_) { /* ignore transient errors */ }
    }, 5000)
    return () => {
      if (kpayPollRef.current) clearInterval(kpayPollRef.current)
    }
  }, [kpayOrder?.trade_no, kpayOrder?.status, load, toast])

  // 主题色：从 campaign.theme_color 映射到 Tailwind clay token
  const theme = campaign?.theme_color || 'pink'
  const themeRing = `bg-clay-${theme}-100`
  const themeInk = `text-clay-${theme}-ink`

  if (loading) {
    return (
      <ClayConsoleShell title="加载活动..." compactHeader>
        <div className="p-12 text-center text-clay-faint">读取活动信息中</div>
      </ClayConsoleShell>
    )
  }
  if (err || !campaign) {
    return (
      <ClayConsoleShell title="活动" compactHeader>
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

  return (
    <ClayConsoleShell title={campaign.title} subtitle={campaign.subtitle} compactHeader>
      {/* Hero 头图区 (CSS 渐变 + 大 emoji + 倒计时) */}
      <ClayCard
        className={`relative overflow-hidden text-center py-10 mb-6 bg-gradient-to-br from-clay-${theme}-50 via-white to-clay-${theme}-100`}
      >
        <div className="text-7xl mb-3 animate-pulse-slow" aria-hidden>{campaign.emoji || '🎉'}</div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-clay-ink mb-2">
          {campaign.title}
        </h1>
        <p className="text-sm sm:text-base text-clay-faint font-bold mb-5 px-4">
          {campaign.subtitle}
        </p>
        {ended ? (
          <ClayAlert tone="info">活动已结束，期待下次再见</ClayAlert>
        ) : inactive ? (
          <ClayAlert tone="warning">活动尚未开始</ClayAlert>
        ) : (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-clay-pill bg-white shadow-clay-sm">
            <Clock className={`w-4 h-4 ${themeInk}`} strokeWidth={2.5} />
            <span className="text-sm font-black text-clay-ink tabular-nums">
              {countdown.d > 0 ? `${countdown.d} 天 ` : ''}
              {String(countdown.h).padStart(2, '0')}:
              {String(countdown.m).padStart(2, '0')}:
              {String(countdown.s).padStart(2, '0')}
            </span>
            <span className="text-xs text-clay-faint font-bold">后结束</span>
          </div>
        )}
      </ClayCard>

      {/* SKU 网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {campaign.skus.map((sku) => (
          <SkuCard
            key={sku.id}
            sku={sku}
            theme={theme}
            disabled={inactive || ended || !!orderingSku}
            ordering={orderingSku === sku.id}
            onOrder={() => order(sku.id)}
          />
        ))}
      </div>

      {/* 防滥用门槛提示 */}
      {(campaign.require_email_verified || campaign.min_account_age_days > 0) && (
        <div className="text-[11px] text-clay-faint text-center mt-4">
          参与门槛：
          {campaign.require_email_verified && '需绑定并验证邮箱'}
          {campaign.require_email_verified && campaign.min_account_age_days > 0 && '；'}
          {campaign.min_account_age_days > 0 && `账号需注册满 ${campaign.min_account_age_days} 天`}
        </div>
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
            <ClayAlert tone="info">支付宝 / 微信扫码均可。完成后会自动到账。</ClayAlert>
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
                ¥{Number(kpayOrder?.amount || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 items-baseline">
              <span className="text-clay-faint font-bold">到账</span>
              <span className="font-black text-emerald-600 text-lg tabular-nums">
                ¥{Number(kpayOrder?.delivered_yuan || 0).toFixed(2)}
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

function SkuCard({ sku, theme, disabled, ordering, onOrder }) {
  const isPurchasable = sku.state === 'purchasable'
  const isSoldOut = sku.state === 'sold_out'
  const isUserLimit = sku.state === 'user_limit'
  const isInactive = sku.state === 'activity_closed'

  const buttonDisabled = !isPurchasable || disabled || ordering
  const buttonLabel = ordering
    ? '处理中…'
    : isSoldOut
      ? '已抢完，明年再战'
      : isUserLimit
        ? `已购满 ${sku.user_bought_n} 次`
        : isInactive
          ? '活动未开放'
          : '立即抢购'

  const progressPct = sku.total_limit > 0
    ? Math.min(100, Math.round((sku.sold_count / sku.total_limit) * 100))
    : 0

  return (
    <ClayCard
      className={`relative p-5 transition-shadow ${
        sku.highlight ? 'ring-2 ring-clay-yellow-300 shadow-clay-hover' : ''
      } ${buttonDisabled ? 'opacity-60' : ''}`}
    >
      {sku.highlight && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm text-[10px] font-black">
          <Sparkles className="w-3 h-3" strokeWidth={2.5} />
          主推
        </span>
      )}
      <div className="text-5xl mb-3">{sku.emoji || '🎁'}</div>
      <div className="text-xl font-black text-clay-ink mb-1">{sku.label}</div>
      <div className="text-xs text-clay-faint font-bold mb-4">{sku.subtitle}</div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-black tabular-nums text-clay-pink-400">
          ¥{sku.price_yuan.toFixed(2)}
        </span>
        <span className="text-sm text-clay-faint font-bold line-through tabular-nums">
          ¥{sku.delivered_yuan.toFixed(2)}
        </span>
      </div>

      {/* 销量进度（仅限购 SKU 显示） */}
      {sku.total_limit > 0 && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-clay-bg shadow-clay-inset-sm overflow-hidden">
            <div
              className={`h-full bg-clay-${theme}-300 transition-all`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-clay-faint mt-1 tabular-nums">
            <span>已售 {sku.sold_count}</span>
            <span>限量 {sku.total_limit}</span>
          </div>
        </div>
      )}

      {/* 个人限购显示 */}
      {sku.per_user_limit > 0 && !isSoldOut && (
        <div className="text-[11px] text-clay-faint font-bold mb-3">
          {isUserLimit
            ? `您已购买 ${sku.user_bought_n} 次（已达上限）`
            : `您还可购买 ${sku.user_can_buy_n} 次`}
        </div>
      )}

      <button
        type="button"
        onClick={onOrder}
        disabled={buttonDisabled}
        className={`w-full px-4 py-3 rounded-clay-pill font-black text-sm transition-shadow ${
          buttonDisabled
            ? 'bg-clay-bg shadow-clay-inset-sm text-clay-faint cursor-not-allowed'
            : `bg-clay-${theme}-100 text-clay-${theme}-ink shadow-clay hover:shadow-clay-hover`
        }`}
      >
        {!buttonDisabled && <Heart className="w-4 h-4 inline mr-1.5" strokeWidth={2.6} />}
        {buttonLabel}
      </button>
    </ClayCard>
  )
}
