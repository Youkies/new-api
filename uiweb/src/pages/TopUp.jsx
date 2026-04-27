import { useEffect, useMemo, useState } from 'react'
import {
  Gift,
  Wallet,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShoppingCart,
  CreditCard,
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
import { redeem, topupInfo, quoteAmount, requestPay } from '../services/topup.js'
import { quotaToDisplay } from '../utils/quota.js'

function PayMethodIcon({ type, className = 'w-5 h-5' }) {
  if (type === 'alipay') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="#1677FF"
          d="M19.5 2H4.5A2.5 2.5 0 0 0 2 4.5v11.2c3.6-.6 8.4-2 11.6-3.7-.5-1-1.1-2.1-1.7-3.2H8v-1h4v-1.3H7v-1h5V3.7h1.6v1.8H18v1h-4.4v1.3H17c-.4 1.4-1 2.9-1.8 4.1 1.3.6 2.5 1.2 3.5 1.7L20 12c-1 .5-2.4 1-3.9 1.6 1 1.5 2 2.6 2.7 3.4l-1 1c-.7-.9-1.7-2.1-2.8-3.7-3.5 1.3-7.7 2.4-12 3.1V19.5A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2Z"
        />
      </svg>
    )
  }
  if (type === 'wxpay') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path
          fill="#07C160"
          d="M9.3 3C4.7 3 1 6.1 1 10c0 2.2 1.2 4.2 3.2 5.5l-.8 2.4 2.8-1.4c1 .3 2 .5 3.1.5h.8c-.1-.4-.2-.9-.2-1.4 0-3.4 3.3-6.2 7.4-6.2h.7C17.4 5.8 13.7 3 9.3 3Zm-3 4.6c.6 0 1.1.4 1.1 1s-.5 1-1.1 1-1.1-.4-1.1-1 .5-1 1.1-1Zm6 0c.6 0 1.1.4 1.1 1s-.5 1-1.1 1-1.1-.4-1.1-1 .5-1 1.1-1Z"
        />
        <path
          fill="#07C160"
          d="M23 15.6c0-3.3-3.2-5.9-7-5.9s-7 2.6-7 5.9c0 3.3 3.2 5.9 7 5.9.8 0 1.5-.1 2.3-.3l2.2 1.1-.6-1.9C21.7 19.3 23 17.6 23 15.6Zm-9.3-1.5a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm4.6 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"
        />
      </svg>
    )
  }
  return <CreditCard className={className} />
}

const PAY_NAME = { alipay: '支付宝', wxpay: '微信支付' }

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

  const priceRatio = Number(status?.price) || 1
  const minTopUp = Number(info?.min_topup) || 1
  const enableOnline = !!info?.enable_online_topup
  const epayMethods = useMemo(
    () => (info?.pay_methods || []).filter((m) => m.type === 'alipay' || m.type === 'wxpay'),
    [info],
  )
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
          if (!Number(topUpCount)) setTopUpCount(Number(res.data.min_topup) || 1)
        }
      } catch (_) {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!epayMethods.length) {
      setPayWay('')
    } else if (!epayMethods.find((m) => m.type === payWay)) {
      setPayWay(epayMethods[0].type)
    }
  }, [epayMethods, payWay])

  const fetchAmount = async (value) => {
    const v = Number(value ?? topUpCount)
    if (!Number.isFinite(v) || v <= 0) {
      setAmount(0)
      return
    }
    setAmountLoading(true)
    try {
      const res = await quoteAmount({ amount: v })
      if (res?.success) setAmount(parseFloat(res.data) || 0)
      else setAmount(0)
    } catch (_) {
      setAmount(0)
    } finally {
      setAmountLoading(false)
    }
  }

  const onSelectPreset = (preset) => {
    setCustomMode(false)
    setSelectedPreset(preset.value)
    setTopUpCount(preset.value)
    const d = preset.discount || discountMap[preset.value] || 1
    setAmount(preset.value * priceRatio * d)
  }

  const onCustomChange = (e) => {
    const v = e.target.value
    setCustomMode(true)
    setSelectedPreset(null)
    if (v === '') {
      setTopUpCount(0)
      setAmount(0)
      return
    }
    const n = Math.max(0, Math.floor(Number(v)))
    setTopUpCount(n)
  }

  const onCustomBlur = () => {
    if (customMode && topUpCount > 0) fetchAmount(topUpCount)
  }

  const openConfirm = () => {
    setPayMsg(null)
    if (!enableOnline) {
      setPayMsg({ tone: 'error', text: '管理员未开启在线充值' })
      return
    }
    if (!epayMethods.length) {
      setPayMsg({ tone: 'error', text: '管理员未配置支付方式' })
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
  const topUpLink = status?.top_up_link

  const currentDiscount = discountMap[topUpCount] || 1
  const hasDiscount = currentDiscount > 0 && currentDiscount < 1 && amount > 0
  const originalAmount = hasDiscount ? amount / currentDiscount : 0

  return (
    <ClayConsoleShell title="充值中心" subtitle="兑换码或在线支付,任你选择">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <ClayStat icon={Wallet} label="当前余额" value={balance.text} tone="blue" />
        <ClayStat icon={Sparkles} label="累计用量" value={used.text} tone="pink" />
      </div>

      {enableOnline && epayMethods.length > 0 && (
        <ClayCard className="mb-6">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
            value={customMode ? topUpCount || '' : ''}
            onChange={onCustomChange}
            onBlur={onCustomBlur}
            placeholder={`输入充值额度,最低 ${minTopUp}`}
            hint="留空则使用上方档位"
          />

          <div className="mb-5">
            <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">
              支付方式
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {epayMethods.map((m) => {
                const active = payWay === m.type
                return (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => setPayWay(m.type)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-shadow ${
                      active
                        ? 'shadow-clay-inset bg-clay-blue-100'
                        : 'shadow-clay bg-clay-bg hover:shadow-clay-hover'
                    }`}
                  >
                    <PayMethodIcon type={m.type} />
                    <span className="font-bold">{m.name || PAY_NAME[m.type] || m.type}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-4 py-3 rounded-2xl shadow-clay-inset bg-clay-bg">
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

          <ClayButton
            variant="primary"
            className="w-full"
            disabled={paying || !topUpCount}
            onClick={openConfirm}
          >
            <CheckCircle2 className="w-4 h-4" /> 立即支付
          </ClayButton>
        </ClayCard>
      )}

      <div className={`grid gap-5 ${topUpLink ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
        <ClayCard className="flex flex-col">
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

        {topUpLink && (
          <ClayCard className="flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full shadow-clay bg-clay-green-100 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-xl font-black mb-2">购买额度</h2>
            <p className="text-clay-faint text-sm mb-5">
              前往商城购买兑换码,获取后在上方输入即可充值。
            </p>
            <a href={topUpLink} target="_blank" rel="noopener noreferrer" className="w-full">
              <ClayButton variant="secondary" className="w-full">
                <ExternalLink className="w-4 h-4" /> 前往购买
              </ClayButton>
            </a>
          </ClayCard>
        )}
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
              {paying ? '跳转中…' : '确认支付'}
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
            </>
          )}
          <div className="flex justify-between text-sm items-center">
            <span className="text-clay-faint">支付方式</span>
            <span className="inline-flex items-center gap-2 font-bold">
              <PayMethodIcon type={payWay} className="w-4 h-4" />
              {epayMethods.find((m) => m.type === payWay)?.name || PAY_NAME[payWay] || payWay}
            </span>
          </div>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
