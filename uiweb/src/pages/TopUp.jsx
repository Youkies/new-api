import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Gift,
  Wallet,
  Sparkles,
  CheckCircle2,
  CreditCard,
  QrCode,
  Tag,
  History,
  RefreshCw,
  Clock3,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayStat from '../components/clay/ClayStat.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { self } from '../services/user.js'
import {
  redeem,
  topupInfo,
  quoteAmount,
  requestPay,
  requestKpayPay,
  checkKpayPay,
  listTopups,
} from '../services/topup.js'
import { quotaToDisplay } from '../utils/quota.js'

function PayMethodIcon({ type, className = 'w-7 h-7' }) {
  if (type === 'alipay' || type === 'kpay_alipay') {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full text-white font-black text-xs shadow-clay-sm`}
        style={{ background: '#1677FF' }}
        aria-label="支付宝"
      >
        支
      </span>
    )
  }
  if (type === 'wxpay' || type === 'wechat' || type === 'kpay_wechat') {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full text-white font-black text-xs shadow-clay-sm`}
        style={{ background: '#07C160' }}
        aria-label="微信支付"
      >
        微
      </span>
    )
  }
  return <CreditCard className={className} />
}

const PAY_NAME = {
  alipay: '支付宝',
  wxpay: '微信支付',
  wechat: '微信支付',
  kpay_alipay: '支付宝',
  kpay_wechat: '微信支付',
}

const TOPUP_STATUS = {
  success: { label: '已到账', tone: 'green', dot: 'bg-clay-green-300' },
  pending: { label: '待支付/待到账', tone: 'yellow', dot: 'bg-clay-yellow-300' },
  failed: { label: '失败', tone: 'pink', dot: 'bg-clay-pink-300' },
  expired: { label: '已过期', tone: 'pink', dot: 'bg-clay-pink-300/60' },
}

const isKpayMethod = (type) => String(type || '').startsWith('kpay_')
const toKpayMethod = (type) => (type === 'kpay_wechat' ? 'wechat' : 'alipay')
const getPayMethodName = (method) => {
  const type = typeof method === 'string' ? method : method?.type
  return PAY_NAME[type] || method?.name || type || ''
}
const isMobilePaymentContext = () => {
  if (typeof window === 'undefined') return false
  const ua = window.navigator?.userAgent || ''
  return (
    window.matchMedia?.('(max-width: 767px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua)
  )
}
const KPAY_PENDING_ORDER_KEY = 'youkies_pending_kpay_order'
const KPAY_PENDING_ORDER_TTL_MS = 30 * 60 * 1000

const normalizePendingKpayOrder = (order) => {
  if (!order?.trade_no) return null
  const savedAt = Number(order.saved_at) || Date.now()
  if (Date.now() - savedAt > KPAY_PENDING_ORDER_TTL_MS) return null
  return { ...order, saved_at: savedAt }
}

const readPendingKpayOrder = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage?.getItem(KPAY_PENDING_ORDER_KEY)
    if (!raw) return null
    const order = normalizePendingKpayOrder(JSON.parse(raw))
    if (!order) {
      window.localStorage?.removeItem(KPAY_PENDING_ORDER_KEY)
      return null
    }
    return order
  } catch (_) {
    try {
      window.localStorage?.removeItem(KPAY_PENDING_ORDER_KEY)
    } catch (_) {}
    return null
  }
}

const savePendingKpayOrder = (order) => {
  const nextOrder = normalizePendingKpayOrder({ ...order, saved_at: Date.now() })
  if (!nextOrder || typeof window === 'undefined') return nextOrder
  try {
    window.localStorage?.setItem(KPAY_PENDING_ORDER_KEY, JSON.stringify(nextOrder))
  } catch (_) {}
  return nextOrder
}

const clearPendingKpayOrder = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.removeItem(KPAY_PENDING_ORDER_KEY)
  } catch (_) {}
}

const formatTopupTime = (value) => {
  const ts = Number(value) || 0
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeTopupStatus = (status) => String(status || '').toLowerCase()

const getTopupStatusMeta = (status) => {
  const normalized = normalizeTopupStatus(status)
  return TOPUP_STATUS[normalized] || { label: status || '未知', cls: 'bg-clay-bg text-clay-faint' }
}

const getTopupProviderName = (order) => {
  const provider = String(order?.payment_provider || '').toLowerCase()
  if (provider === 'kpay') return 'KPay'
  if (provider === 'epay') return '易支付'
  if (provider === 'stripe') return 'Stripe'
  if (provider === 'creem') return 'Creem'
  if (provider === 'waffo') return 'Waffo'
  if (provider === 'waffo_pancake') return 'Waffo Pancake'
  return provider || '兑换码'
}

const isKpayTopupOrder = (order) =>
  String(order?.payment_provider || '').toLowerCase() === 'kpay' ||
  String(order?.trade_no || '').startsWith('KPAY')

const canCheckTopupOrder = (order) =>
  isKpayTopupOrder(order) && normalizeTopupStatus(order?.status) === 'pending'

const isKpayFinalStatus = (status) =>
  ['success', 'failed', 'expired'].includes(normalizeTopupStatus(status))

const getKpayFinalMessage = (status, prefix = '订单') => {
  switch (normalizeTopupStatus(status)) {
    case 'success':
      return `${prefix}已到账`
    case 'failed':
      return `${prefix}支付失败`
    case 'expired':
      return `${prefix}已过期`
    default:
      return `${prefix}仍待支付或待到账`
  }
}

export default function TopUp() {
  const { user, setUser } = useUser()
  const { status } = useStatus()

  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState(null)

  const [info, setInfo] = useState(null)
  const [topUpCount, setTopUpCount] = useState(0)
  const [customMode, setCustomMode] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [amount, setAmount] = useState(0)
  const [amountLoading, setAmountLoading] = useState(false)
  const [payWay, setPayWay] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payMsg, setPayMsg] = useState(null)
  const [kpayOrder, setKpayOrder] = useState(null)
  const [, setKpayChecking] = useState(false)
  const [topupOrders, setTopupOrders] = useState([])
  const [topupTotal, setTopupTotal] = useState(0)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [historyMsg, setHistoryMsg] = useState(null)
  const [checkingTradeNo, setCheckingTradeNo] = useState('')
  const autoCheckedKpayTradeRef = useRef('')
  const autoCheckedHistoryTradesRef = useRef(new Set())

  const priceRatio = Number(status?.price) || 1
  const minTopUp = Number(info?.min_topup) || 1
  const enableOnline = !!info?.enable_online_topup
  const enableKpay = !!info?.enable_kpay_topup
  const epayMethods = useMemo(
    () => (info?.pay_methods || []).filter((m) => m.type === 'alipay' || m.type === 'wxpay'),
    [info],
  )
  const kpayMethods = useMemo(
    () => (info?.kpay_pay_methods || []).filter((m) => m.type === 'kpay_alipay' || m.type === 'kpay_wechat'),
    [info],
  )
  const onlineMethods = useMemo(() => {
    if (enableKpay && kpayMethods.length > 0) {
      return kpayMethods.map((m) => ({ ...m, provider: 'kpay', name: getPayMethodName(m) }))
    }
    if (enableOnline) {
      return epayMethods.map((m) => ({ ...m, provider: 'epay', name: getPayMethodName(m) }))
    }
    return []
  }, [enableOnline, epayMethods, enableKpay, kpayMethods])
  const amountOptions = info?.amount_options || []
  const discountMap = info?.discount || {}

  const presets = useMemo(() => {
    if (amountOptions.length > 0) {
      return amountOptions.map((v) => ({ value: v, discount: discountMap[v] || 1 }))
    }
    const multipliers = [1, 5, 10, 30, 50, 100, 300, 500]
    return multipliers.map((m) => ({ value: minTopUp * m, discount: 1 }))
  }, [amountOptions, discountMap, minTopUp])

  const refreshUser = useCallback(async () => {
    const r = await self()
    if (r?.data) setUser(r.data)
  }, [setUser])

  const fetchTopupOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setOrdersLoading(true)
    try {
      const res = await listTopups({ p: 1, page_size: 10, size: 10 })
      if (res?.success && res.data) {
        setTopupOrders(Array.isArray(res.data.items) ? res.data.items : [])
        setTopupTotal(Number(res.data.total) || 0)
        if (!silent) setHistoryMsg(null)
      } else if (!silent) {
        setHistoryMsg({ tone: 'error', text: res?.message || '订单加载失败' })
      }
    } catch (err) {
      if (!silent) {
        setHistoryMsg({
          tone: 'error',
          text: err?.response?.data?.message ?? err.message ?? '订单加载失败',
        })
      }
    } finally {
      if (!silent) setOrdersLoading(false)
    }
  }, [])

  const refreshTopupOrders = useCallback(() => {
    autoCheckedHistoryTradesRef.current.clear()
    fetchTopupOrders()
  }, [fetchTopupOrders])

  const checkRestoredKpayOrder = useCallback(
    async (order) => {
      if (!order?.trade_no) return
      setKpayChecking(true)
      try {
        const res = await checkKpayPay({
          trade_no: order.trade_no,
          provider_order_no: order.provider_order_no || '',
        })
        const nextStatus = res?.data?.status
        if (res?.message === 'success' && isKpayFinalStatus(nextStatus)) {
          const normalizedStatus = normalizeTopupStatus(nextStatus)
          clearPendingKpayOrder()
          setKpayOrder((prev) =>
            prev?.trade_no === order.trade_no ? { ...prev, status: normalizedStatus } : prev,
          )
          setPayMsg({
            tone: normalizedStatus === 'success' ? 'success' : 'error',
            text: getKpayFinalMessage(normalizedStatus, '上一笔订单'),
          })
          if (normalizedStatus === 'success') {
            try {
              await refreshUser()
            } catch (_) {}
          }
          fetchTopupOrders({ silent: true })
          return
        }
        setPayMsg((prev) =>
          prev?.tone === 'success'
            ? prev
            : { tone: 'info', text: '上一笔订单仍待支付或待到账' },
        )
      } catch (_) {
        setPayMsg((prev) =>
          prev?.tone === 'success'
            ? prev
            : { tone: 'info', text: '已恢复上一笔订单，稍后会继续自动检查到账' },
        )
      } finally {
        setKpayChecking(false)
      }
    },
    [fetchTopupOrders, refreshUser],
  )

  useEffect(() => {
    ;(async () => {
      try {
        await refreshUser()
      } catch (_) {}
      try {
        const res = await topupInfo()
        if (res?.success && res.data) {
          setInfo(res.data)
          if (!Number(topUpCount)) {
            const m = Number(res.data.min_topup) || 1
            setTopUpCount(m)
            setSelectedPreset(m)
            fetchAmount(m)
          }
        }
      } catch (_) {}
      fetchTopupOrders({ silent: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTopupOrders, refreshUser])

  useEffect(() => {
    if (!onlineMethods.length) {
      setPayWay('')
    } else if (!onlineMethods.find((m) => m.type === payWay)) {
      setPayWay(onlineMethods[0].type)
    }
  }, [onlineMethods, payWay])

  useEffect(() => {
    const pendingOrders = topupOrders
      .filter((order) => canCheckTopupOrder(order))
      .filter((order) => !autoCheckedHistoryTradesRef.current.has(order.trade_no))
      .slice(0, 5)
    if (!pendingOrders.length) return undefined

    pendingOrders.forEach((order) => autoCheckedHistoryTradesRef.current.add(order.trade_no))
    let cancelled = false
    ;(async () => {
      const results = await Promise.allSettled(
        pendingOrders.map((order) =>
          checkKpayPay({
            trade_no: order.trade_no,
            provider_order_no: order.provider_order_no || '',
          }),
        ),
      )
      if (cancelled) return
      let shouldRefreshOrders = false
      let shouldRefreshUser = false
      for (const result of results) {
        if (result.status !== 'fulfilled') continue
        const nextStatus = result.value?.data?.status
        if (!isKpayFinalStatus(nextStatus)) continue
        shouldRefreshOrders = true
        if (normalizeTopupStatus(nextStatus) === 'success') {
          shouldRefreshUser = true
        }
      }
      if (shouldRefreshUser) {
        try {
          await refreshUser()
        } catch (_) {}
      }
      if (shouldRefreshOrders) {
        fetchTopupOrders({ silent: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [fetchTopupOrders, refreshUser, topupOrders])

  useEffect(() => {
    const restorePendingOrder = () => {
      const pendingOrder = readPendingKpayOrder()
      if (!pendingOrder || pendingOrder.status === 'success') return
      setKpayOrder((prev) => (prev?.trade_no === pendingOrder.trade_no ? prev : pendingOrder))
      setPayMsg((prev) =>
        prev?.tone === 'success'
          ? prev
          : { tone: 'info', text: '正在检查上一笔支付结果' },
      )
      if (autoCheckedKpayTradeRef.current !== pendingOrder.trade_no) {
        autoCheckedKpayTradeRef.current = pendingOrder.trade_no
        window.setTimeout(() => checkRestoredKpayOrder(pendingOrder), 0)
      }
    }

    restorePendingOrder()
    if (typeof window === 'undefined') return undefined

    const onVisibilityChange = () => {
      if (!document.hidden) restorePendingOrder()
    }
    window.addEventListener('focus', restorePendingOrder)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', restorePendingOrder)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkRestoredKpayOrder])

  const fetchAmount = async (value) => {
    const v = Number(value ?? topUpCount)
    if (!Number.isFinite(v) || v <= 0) {
      setAmount(0)
      return
    }
    setAmountLoading(true)
    try {
      const res = await quoteAmount({ amount: v })
      if (res?.message === 'success') {
        setAmount(parseFloat(res.data) || 0)
        setPayMsg(null)
      } else {
        setAmount(0)
        setPayMsg({ tone: 'error', text: res?.data || res?.message || '获取金额失败' })
      }
    } catch (err) {
      setAmount(0)
      setPayMsg({
        tone: 'error',
        text: err?.response?.data?.data || err?.response?.data?.message || err.message || '获取金额失败',
      })
    } finally {
      setAmountLoading(false)
    }
  }

  const onSelectPreset = (preset) => {
    setCustomMode(false)
    setSelectedPreset(preset.value)
    setTopUpCount(preset.value)
    fetchAmount(preset.value)
  }

  const [customInput, setCustomInput] = useState('')

  const onCustomChange = (e) => {
    const v = e.target.value
    setCustomInput(v)
    setCustomMode(true)
    setSelectedPreset(null)
    if (v === '') {
      setTopUpCount(0)
      setAmount(0)
      return
    }
    const n = Math.max(0, Math.floor(Number(v)))
    setTopUpCount(Number.isFinite(n) ? n : 0)
  }

  const onCustomBlur = () => {
    if (customMode && topUpCount > 0) fetchAmount(topUpCount)
  }

  useEffect(() => {
    if (!customMode) return
    if (!topUpCount || topUpCount <= 0) {
      setAmount(0)
      return
    }
    const handle = setTimeout(() => {
      fetchAmount(topUpCount)
    }, 350)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpCount, customMode])

  const openConfirm = () => {
    setPayMsg(null)
    if (!onlineMethods.length) {
      setPayMsg({ tone: 'error', text: '管理员未开启在线充值' })
      return
    }
    if (!payWay) {
      setPayMsg({ tone: 'error', text: '请选择支付方式' })
      return
    }
    if (!Number(topUpCount) || Number(topUpCount) < minTopUp) {
      setPayMsg({ tone: 'error', text: `充值数量不能小于 ${minTopUp}` })
      return
    }
    setConfirmOpen(true)
  }

  const submitPay = async () => {
    setPaying(true)
    try {
      if (isKpayMethod(payWay)) {
        const kpayMethod = toKpayMethod(payWay)
        const res = await requestKpayPay({
          amount: parseInt(topUpCount, 10),
          payment_method: kpayMethod,
        })
        if (res?.message === 'success' && res.data) {
          const orderPayload = {
            ...res.data,
            payment_method: res.data.payment_method || kpayMethod,
          }
          const nextOrder = savePendingKpayOrder(orderPayload) || orderPayload
          setConfirmOpen(false)
          setPayMsg(null)
          setKpayOrder(nextOrder)
          fetchTopupOrders({ silent: true })
          if (kpayMethod === 'alipay' && isMobilePaymentContext() && nextOrder.direct_pay_url) {
            window.location.assign(nextOrder.direct_pay_url)
            return
          }
        } else {
          const errText =
            typeof res?.data === 'string' ? res.data : res?.message || '支付请求失败'
          setPayMsg({ tone: 'error', text: errText })
        }
        return
      }
      const res = await requestPay({
        amount: parseInt(topUpCount, 10),
        payment_method: payWay,
      })
      if (res?.message === 'success') {
        const params = res.data
        const url = res.url
        const form = document.createElement('form')
        form.action = url
        form.method = 'POST'
        const isSafari =
          navigator.userAgent.indexOf('Safari') > -1 &&
          navigator.userAgent.indexOf('Chrome') < 1
        if (!isSafari) form.target = '_blank'
        for (const k in params) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = k
          input.value = params[k]
          form.appendChild(input)
        }
        document.body.appendChild(form)
        form.submit()
        document.body.removeChild(form)
        setConfirmOpen(false)
      } else {
        const errText =
          typeof res?.data === 'string' ? res.data : res?.message || '支付请求失败'
        setPayMsg({ tone: 'error', text: errText })
      }
    } catch (err) {
      setPayMsg({
        tone: 'error',
        text: err?.response?.data?.message ?? err.message ?? '支付请求失败',
      })
    } finally {
      setPaying(false)
    }
  }

  const checkKpayStatus = async (silent = false) => {
    if (!kpayOrder?.trade_no) return
    setKpayChecking(true)
    try {
      const res = await checkKpayPay({
        trade_no: kpayOrder.trade_no,
        provider_order_no: kpayOrder.provider_order_no || '',
      })
      const nextStatus = res?.data?.status
      if (res?.message === 'success' && isKpayFinalStatus(nextStatus)) {
        const normalizedStatus = normalizeTopupStatus(nextStatus)
        clearPendingKpayOrder()
        setKpayOrder((prev) => ({ ...prev, status: normalizedStatus }))
        setPayMsg({
          tone: normalizedStatus === 'success' ? 'success' : 'error',
          text: getKpayFinalMessage(normalizedStatus),
        })
        if (normalizedStatus === 'success') {
          try {
            await refreshUser()
          } catch (_) {}
        }
        fetchTopupOrders({ silent: true })
        return
      }
      if (!silent) {
        setPayMsg({ tone: 'info', text: '订单仍待支付或待到账' })
      }
    } catch (err) {
      if (!silent) {
        setPayMsg({
          tone: 'error',
          text: err?.response?.data?.message ?? err.message ?? '检查失败',
        })
      }
    } finally {
      setKpayChecking(false)
    }
  }

  useEffect(() => {
    if (!kpayOrder?.trade_no || isKpayFinalStatus(kpayOrder.status)) return undefined
    const timer = setInterval(() => {
      checkKpayStatus(true)
    }, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpayOrder?.trade_no, kpayOrder?.status])

  const checkTopupOrder = async (order) => {
    if (!order?.trade_no || !canCheckTopupOrder(order)) return
    setCheckingTradeNo(order.trade_no)
    setHistoryMsg(null)
    try {
      const res = await checkKpayPay({
        trade_no: order.trade_no,
        provider_order_no: order.provider_order_no || '',
      })
      const nextStatus = res?.data?.status
      if (res?.message === 'success' && isKpayFinalStatus(nextStatus)) {
        const normalizedStatus = normalizeTopupStatus(nextStatus)
        clearPendingKpayOrder()
        setHistoryMsg({
          tone: normalizedStatus === 'success' ? 'success' : 'error',
          text:
            normalizedStatus === 'success'
              ? '支付已到账，余额已刷新'
              : getKpayFinalMessage(normalizedStatus),
        })
        setKpayOrder((prev) =>
          prev?.trade_no === order.trade_no ? { ...prev, status: normalizedStatus } : prev,
        )
        if (normalizedStatus === 'success') {
          await refreshUser()
        }
        await fetchTopupOrders({ silent: true })
      } else if (res?.message === 'success') {
        setHistoryMsg({ tone: 'info', text: '订单仍待支付或待到账' })
        await fetchTopupOrders({ silent: true })
      } else {
        setHistoryMsg({
          tone: 'error',
          text: typeof res?.data === 'string' ? res.data : res?.message || '检查失败',
        })
      }
    } catch (err) {
      setHistoryMsg({
        tone: 'error',
        text: err?.response?.data?.message ?? err.message ?? '检查失败',
      })
    } finally {
      setCheckingTradeNo('')
    }
  }

  const onRedeem = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setRedeeming(true)
    setRedeemMsg(null)
    try {
      const res = await redeem(code.trim())
      if (res?.success) {
        setRedeemMsg({
          tone: 'success',
          text: `兑换成功,${res.message ? '已入账 ' + res.message : '额度已入账'}`.trim(),
        })
        setCode('')
        try {
          await refreshUser()
          fetchTopupOrders({ silent: true })
        } catch (_) {}
      } else {
        setRedeemMsg({ tone: 'error', text: res?.message ?? '兑换失败' })
      }
    } catch (err) {
      setRedeemMsg({
        tone: 'error',
        text: err?.response?.data?.message ?? err.message ?? '兑换失败',
      })
    } finally {
      setRedeeming(false)
    }
  }

  const balance = quotaToDisplay(user?.quota ?? 0)
  const used = quotaToDisplay(user?.used_quota ?? 0)

  const currentDiscount = discountMap[topUpCount] || 1
  const hasDiscount = currentDiscount > 0 && currentDiscount < 1 && amount > 0
  const originalAmount = hasDiscount ? amount / currentDiscount : 0
  const kpayPaymentMethod = kpayOrder?.payment_method || toKpayMethod(payWay)
  const kpayStatus = normalizeTopupStatus(kpayOrder?.status || 'pending')
  const kpayStatusMeta = getTopupStatusMeta(kpayStatus)
  const kpayTip =
    isMobilePaymentContext() && kpayPaymentMethod === 'wechat'
      ? '请保存二维码或截图后，打开微信支付完成付款。'
      : '请使用对应支付 App 扫码，完成后会自动检查到账。'

  return (
    <ClayConsoleShell title="充值中心" subtitle="兑换码或在线支付,任你选择">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-stretch">
        {/* 左上:余额 + 用量 */}
        <div className="grid grid-cols-2 gap-5">
          <ClayStat icon={Wallet} label="当前余额" value={balance.text} tone="blue" />
          <ClayStat icon={Sparkles} label="累计用量" value={used.text} tone="pink" />
        </div>

        {/* 右上:在线充值,跨两行 */}
        {onlineMethods.length > 0 ? (
          <ClayCard className="lg:row-span-2">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-clay-blue-300" />
              <h2 className="text-xl font-black">在线充值</h2>
            </div>

            {payMsg && (
              <ClayAlert tone={payMsg.tone} className="mb-4">
                {payMsg.text}
              </ClayAlert>
            )}

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2 ml-4">
                <label className="font-bold text-sm text-clay-ink">选择档位</label>
                <span className="text-xs text-clay-faint">最低 {minTopUp}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {presets.map((p) => {
                  const active = !customMode && selectedPreset === p.value
                  const d = p.discount || discountMap[p.value] || 1
                  const showDiscount = d > 0 && d < 1
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onSelectPreset(p)}
                      className={`relative rounded-2xl px-4 py-3 text-left transition-shadow ${
                        active
                          ? 'shadow-clay-inset bg-clay-blue-100'
                          : 'shadow-clay bg-clay-bg hover:shadow-clay-hover'
                      }`}
                    >
                      <div className="font-black text-lg">{p.value}</div>
                      <div className="text-xs text-clay-faint">额度</div>
                      {showDiscount && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold text-clay-pink-400 bg-white/70 rounded-full px-2 py-0.5 shadow-clay-xs">
                          <Tag className="w-3 h-3" />
                          {Math.round(d * 100)}%
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <ClayField
              label="自定义数量"
              type="number"
              min={minTopUp}
              value={customInput}
              onChange={onCustomChange}
              onBlur={onCustomBlur}
              placeholder={`输入充值额度,最低 ${minTopUp}`}
              hint="留空则使用上方档位"
            />

            <div className="mb-5">
              <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">
                支付方式
              </label>
              <div className="grid grid-cols-2 gap-3">
                {onlineMethods.map((m) => {
                  const active = payWay === m.type
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => setPayWay(m.type)}
                      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 transition-shadow ${
                        active
                          ? 'shadow-clay-inset bg-clay-blue-100'
                          : 'shadow-clay bg-clay-bg hover:shadow-clay-hover'
                      }`}
                    >
                      <PayMethodIcon type={m.type} />
                      <span className="font-bold text-sm">{getPayMethodName(m)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mb-4 px-4 py-3 rounded-2xl shadow-clay-inset bg-clay-bg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-sm text-clay-faint">实付金额</div>
                <div className="flex items-baseline gap-2">
                  {hasDiscount && (
                    <span className="text-sm text-clay-faint line-through">
                      {originalAmount.toFixed(2)} 元
                    </span>
                  )}
                  <span className="text-2xl font-black text-clay-pink-400">
                    {amountLoading ? '…' : `${(amount || 0).toFixed(2)} 元`}
                  </span>
                </div>
              </div>
              {hasDiscount && !amountLoading && (
                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-clay-pink-100 text-clay-pink-ink font-bold shadow-clay-xs">
                    <Tag className="w-3 h-3" />
                    {Math.round(currentDiscount * 100)}%
                  </span>
                  <span className="text-clay-green-ink font-bold">
                    已节省 {(originalAmount - amount).toFixed(2)} 元
                  </span>
                </div>
              )}
            </div>

            <ClayButton
              variant="primary"
              className="w-full"
              disabled={paying || !topUpCount}
              onClick={openConfirm}
            >
              <CheckCircle2 className="w-4 h-4" /> 立即支付
            </ClayButton>
          </ClayCard>
        ) : (
          <div className="hidden lg:block" />
        )}

        {/* 左下:兑换码 */}
        <ClayCard className="flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-clay-pink-300" />
            <h2 className="text-xl font-black">兑换码充值</h2>
          </div>
          <p className="text-clay-faint text-sm mb-5">
            输入管理员发放的兑换码,额度将立即到账。
          </p>

          {redeemMsg && (
            <ClayAlert tone={redeemMsg.tone} className="mb-4">
              {redeemMsg.text}
            </ClayAlert>
          )}

          <form onSubmit={onRedeem} className="flex-1 flex flex-col">
            <ClayField
              label="兑换码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="粘贴兑换码"
              autoComplete="off"
            />
            <div className="mt-auto">
              <ClayButton
                variant="primary"
                type="submit"
                className="w-full"
                disabled={redeeming || !code.trim()}
              >
                {redeeming ? '处理中…' : (<><CheckCircle2 className="w-4 h-4" /> 立即兑换</>)}
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      </div>

      <ClayCard className="mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-clay-blue-300" />
            <h2 className="text-xl font-black">充值订单</h2>
            {topupTotal > 0 && (
              <span className="text-xs font-bold text-clay-faint">最近 {Math.min(topupOrders.length, topupTotal)} / {topupTotal}</span>
            )}
          </div>
          <ClayButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={refreshTopupOrders}
            disabled={ordersLoading}
          >
            <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
            刷新
          </ClayButton>
        </div>

        {historyMsg && (
          <ClayAlert tone={historyMsg.tone} className="mb-4">
            {historyMsg.text}
          </ClayAlert>
        )}

        <div className="space-y-3">
          {ordersLoading ? (
            <div className="rounded-2xl shadow-clay-inset bg-clay-bg px-4 py-6 text-sm font-bold text-clay-faint text-center">
              正在加载订单…
            </div>
          ) : topupOrders.length === 0 ? (
            <div className="rounded-2xl shadow-clay-inset bg-clay-bg px-4 py-6 text-sm font-bold text-clay-faint text-center">
              暂无充值订单
            </div>
          ) : (
            topupOrders.map((order) => {
              const statusMeta = getTopupStatusMeta(order.status)
              const checking = checkingTradeNo === order.trade_no
              return (
                <div
                  key={order.id || order.trade_no}
                  className="rounded-2xl shadow-clay-inset bg-clay-bg px-4 py-3 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(120px,0.7fr)_minmax(110px,0.65fr)_minmax(90px,0.55fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-clay-faint mb-1">
                      <Clock3 className="w-3.5 h-3.5" />
                      {formatTopupTime(order.create_time)}
                    </div>
                    <div className="font-mono text-xs font-black break-all text-clay-ink">
                      {order.trade_no || '-'}
                    </div>
                    {order.provider_order_no ? (
                      <div className="mt-1 font-mono text-[11px] text-clay-faint break-all">
                        {order.provider_order_no}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:block">
                    <span className="text-xs font-bold text-clay-faint lg:block">支付方式</span>
                    <div className="inline-flex items-center gap-2 font-black text-sm">
                      <PayMethodIcon type={order.payment_method} className="w-5 h-5" />
                      <span>{getTopupProviderName(order)} · {getPayMethodName(order.payment_method)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:block">
                    <span className="text-xs font-bold text-clay-faint lg:block">充值数量</span>
                    <div className="font-black text-sm">{Number(order.amount || 0)} 额度</div>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:block">
                    <span className="text-xs font-bold text-clay-faint lg:block">实付金额</span>
                    <div className="font-black text-clay-pink-400 text-sm">
                      {(Number(order.money) || 0).toFixed(2)} 元
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-clay-ink">
                      <span className={`inline-block w-2 h-2 rounded-full shadow-clay-xs ${statusMeta.dot}`} aria-hidden="true" />
                      {statusMeta.label}
                    </span>
                    {canCheckTopupOrder(order) ? (
                      <button
                        type="button"
                        onClick={() => checkTopupOrder(order)}
                        disabled={checking}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-clay-pill bg-clay-blue-100 px-3 text-xs font-black text-clay-blue-ink shadow-clay-sm transition-all duration-200 ease-clay hover:shadow-clay-hover active:scale-95 active:shadow-clay-active disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                        {checking ? '检查中' : '检查到账'}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ClayCard>

      <ClayModal
        open={confirmOpen}
        onClose={() => !paying && setConfirmOpen(false)}
        title="充值确认"
        size="sm"
        footer={
          <>
            <ClayButton variant="secondary" disabled={paying} onClick={() => setConfirmOpen(false)}>
              取消
            </ClayButton>
            <ClayButton variant="primary" disabled={paying} onClick={submitPay}>
              {paying ? '处理中…' : '确认支付'}
            </ClayButton>
          </>
        }
      >
        <div className="space-y-3 px-4 py-3 rounded-2xl shadow-clay-inset bg-clay-bg">
          <div className="flex justify-between text-sm">
            <span className="text-clay-faint">充值数量</span>
            <span className="font-bold">{topUpCount} 额度</span>
          </div>
          <div className="flex justify-between text-sm items-baseline">
            <span className="text-clay-faint">实付金额</span>
            <span className="font-black text-clay-pink-400">{(amount || 0).toFixed(2)} 元</span>
          </div>
          {hasDiscount && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">原价</span>
                <span className="line-through text-clay-faint">{originalAmount.toFixed(2)} 元</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">折扣</span>
                <span className="text-clay-green-ink font-bold">{Math.round(currentDiscount * 100)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">已节省</span>
                <span className="text-clay-green-ink font-bold">
                  {(originalAmount - amount).toFixed(2)} 元
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm items-center">
            <span className="text-clay-faint">支付方式</span>
            <span className="inline-flex items-center gap-2 font-bold">
              <PayMethodIcon type={payWay} className="w-4 h-4" />
              {getPayMethodName(onlineMethods.find((m) => m.type === payWay) || payWay)}
            </span>
          </div>
        </div>
      </ClayModal>

      <ClayModal
        open={!!kpayOrder}
        onClose={() => setKpayOrder(null)}
        title="扫码支付"
        size="sm"
      >
        <div className="space-y-4">
          {kpayStatus === 'success' ? (
            <ClayAlert tone="success">支付已到账</ClayAlert>
          ) : null}
          {kpayStatus === 'failed' || kpayStatus === 'expired' ? (
            <ClayAlert tone="error">{getKpayFinalMessage(kpayStatus)}</ClayAlert>
          ) : null}
          {!isKpayFinalStatus(kpayStatus) ? (
            <ClayAlert tone="info">{kpayTip}</ClayAlert>
          ) : null}
          <div className="mx-auto w-56 h-56 rounded-2xl shadow-clay-inset bg-white flex items-center justify-center p-3">
            {kpayOrder?.qr_code_data_uri || kpayOrder?.qr_code_image_url ? (
              <img
                src={kpayOrder.qr_code_data_uri || kpayOrder.qr_code_image_url}
                alt="KPay QR code"
                className="w-full h-full object-contain"
              />
            ) : (
              <QrCode className="w-20 h-20 text-clay-faint" />
            )}
          </div>
          <div className="space-y-2 px-4 py-3 rounded-2xl shadow-clay-inset bg-clay-bg text-sm">
            <div className="flex justify-between">
              <span className="text-clay-faint">订单号</span>
              <span className="font-mono text-xs break-all text-right">{kpayOrder?.trade_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-clay-faint">实付金额</span>
              <span className="font-black text-clay-pink-400">
                {(Number(kpayOrder?.amount) || amount || 0).toFixed(2)} 元
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-clay-faint">状态</span>
              <span className="font-bold">{kpayStatusMeta.label}</span>
            </div>
          </div>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
