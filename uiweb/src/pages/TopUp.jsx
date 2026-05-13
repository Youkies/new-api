import { useEffect, useMemo, useState } from 'react'
import {
  Gift,
  Wallet,
  Sparkles,
  CheckCircle2,
  CreditCard,
  QrCode,
  Tag,
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
} from '../services/topup.js'
import { quotaToDisplay } from '../utils/quota.js'

function PayMethodIcon({ type, className = 'w-7 h-7' }) {
  if (type === 'alipay' || type === 'kpay_alipay') {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full text-white font-black text-xs shadow-clay`}
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
        className={`${className} inline-flex items-center justify-center rounded-full text-white font-black text-xs shadow-clay`}
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

  useEffect(() => {
    ;(async () => {
      try {
        const r = await self()
        if (r?.data) setUser(r.data)
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
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!onlineMethods.length) {
      setPayWay('')
    } else if (!onlineMethods.find((m) => m.type === payWay)) {
      setPayWay(onlineMethods[0].type)
    }
  }, [onlineMethods, payWay])

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
          const nextOrder = {
            ...res.data,
            payment_method: res.data.payment_method || kpayMethod,
          }
          setConfirmOpen(false)
          setPayMsg(null)
          if (kpayMethod === 'alipay' && isMobilePaymentContext() && nextOrder.direct_pay_url) {
            window.location.assign(nextOrder.direct_pay_url)
            return
          }
          setKpayOrder(nextOrder)
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
      if (res?.message === 'success' && nextStatus === 'success') {
        setKpayOrder((prev) => ({ ...prev, status: 'success' }))
        setPayMsg({ tone: 'success', text: '支付已到账' })
        try {
          const r = await self()
          if (r?.data) setUser(r.data)
        } catch (_) {}
        return
      }
      if (!silent) {
        setPayMsg({ tone: 'info', text: '订单仍在等待支付确认' })
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
    if (!kpayOrder?.trade_no || kpayOrder.status === 'success') return undefined
    const timer = setInterval(() => {
      checkKpayStatus(true)
    }, 5000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpayOrder?.trade_no, kpayOrder?.status])

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
          const r = await self()
          if (r?.data) setUser(r.data)
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
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-white/70 rounded-full px-2 py-0.5 shadow-clay">
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
                  <span className="text-2xl font-black text-rose-500">
                    {amountLoading ? '…' : `${(amount || 0).toFixed(2)} 元`}
                  </span>
                </div>
              </div>
              {hasDiscount && !amountLoading && (
                <div className="mt-2 flex items-center justify-end gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-500 font-bold">
                    <Tag className="w-3 h-3" />
                    {Math.round(currentDiscount * 100)}%
                  </span>
                  <span className="text-emerald-600 font-bold">
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
            <span className="font-black text-rose-500">{(amount || 0).toFixed(2)} 元</span>
          </div>
          {hasDiscount && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">原价</span>
                <span className="line-through text-clay-faint">{originalAmount.toFixed(2)} 元</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">折扣</span>
                <span className="text-emerald-600">{Math.round(currentDiscount * 100)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-clay-faint">已节省</span>
                <span className="text-emerald-600 font-bold">
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
          {kpayOrder?.status === 'success' ? (
            <ClayAlert tone="success">支付已到账</ClayAlert>
          ) : null}
          {kpayOrder?.status !== 'success' ? (
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
              <span className="font-black text-rose-500">
                {(Number(kpayOrder?.amount) || amount || 0).toFixed(2)} 元
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-clay-faint">状态</span>
              <span className="font-bold">
                {kpayOrder?.status === 'success' ? '已到账' : '待支付'}
              </span>
            </div>
          </div>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
