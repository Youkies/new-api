import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, QrCode, AlertCircle, CheckCircle2, Clock, Heart, ArrowDown, X as XIcon } from 'lucide-react'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import PayMethodIcon from '../components/clay/PayMethodIcon.jsx'
import api from '../services/api.js'
import { useToast } from '../context/ToastContext.jsx'
import { getCurrencyConfig } from '../utils/quota.js'

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
      setKpayOrder({ ...j.data, status: 'pending' })
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
      <ClayConsoleShell title="加载活动…" compactHeader>
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
  const theme = campaign.theme_color || 'pink'

  return (
    <ClayConsoleShell title={campaign.title} subtitle={campaign.subtitle} compactHeader>
      {/* Hero 头图区 */}
      <ClayCard
        className={`relative overflow-hidden text-center py-12 mb-6 bg-gradient-to-br from-clay-${theme}-50 via-white to-clay-${theme}-100`}
      >
        <div className="text-7xl sm:text-8xl mb-4 select-none" aria-hidden>
          {campaign.emoji || '🎉'}
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-clay-ink mb-2">
          {campaign.title}
        </h1>
        <p className="text-sm sm:text-base text-clay-faint font-bold mb-6 px-4">
          {campaign.subtitle}
        </p>
        {ended ? (
          <ClayAlert tone="info">活动已结束，期待下次再见</ClayAlert>
        ) : inactive ? (
          <ClayAlert tone="warning">活动尚未开始</ClayAlert>
        ) : (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-clay-pill bg-white shadow-clay-sm">
            <Clock className={`w-4 h-4 text-clay-${theme}-ink`} strokeWidth={2.5} />
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

      {/* 提示文案 */}
      {!inactive && !ended && (
        <div className="text-center mb-4 text-xs sm:text-sm text-clay-faint font-bold flex items-center justify-center gap-1.5">
          <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.5} />
          选择一个套餐 · 下方选择支付方式
        </div>
      )}

      {/* SKU 网格 */}
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
              {kpayOrder?.payment_method === 'wechat'
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
                {currencySymbol}{Number(kpayOrder?.amount || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 items-baseline">
              <span className="text-clay-faint font-bold">到账</span>
              <span className="font-black text-emerald-600 text-lg tabular-nums">
                {currencySymbol}{Number(kpayOrder?.delivered_yuan || 0).toFixed(2)}
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
      {/* 主推/已选 角标 */}
      {selected ? (
        <span className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-${theme}-100 text-clay-${theme}-ink shadow-clay-sm text-[10px] font-black`}>
          <CheckCircle2 className="w-3 h-3" strokeWidth={2.6} />
          已选中
        </span>
      ) : sku.highlight ? (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm text-[10px] font-black">
          <Sparkles className="w-3 h-3" strokeWidth={2.6} />
          主推
        </span>
      ) : null}

      <div className="text-5xl mb-3 select-none">{sku.emoji || '🎁'}</div>
      <div className="text-lg sm:text-xl font-black text-clay-ink mb-1 truncate">{sku.label}</div>
      <div className="text-xs text-clay-faint font-bold mb-4 truncate">{sku.subtitle}</div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-black tabular-nums text-clay-pink-400">
          {currencySymbol}{sku.price_yuan.toFixed(2)}
        </span>
        <span className="text-sm text-clay-faint font-bold line-through tabular-nums">
          {currencySymbol}{sku.delivered_yuan.toFixed(2)}
        </span>
      </div>

      {/* 销量进度 */}
      {sku.total_limit > 0 && (
        <div className="mb-2">
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
      <ClayCard className="p-4 sm:p-5 bg-white">
        {/* 顶部一行：已选商品摘要 + 取消选择按钮 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl select-none flex-shrink-0">{sku.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-clay-ink truncate">{sku.label}</div>
            <div className="text-[11px] text-clay-faint font-bold truncate">
              {currencySymbol}{sku.price_yuan.toFixed(2)} → 到账 {currencySymbol}{sku.delivered_yuan.toFixed(2)}
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
            {currencySymbol}{sku.price_yuan.toFixed(2)}
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
