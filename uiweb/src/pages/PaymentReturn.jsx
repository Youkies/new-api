import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'

export default function PaymentReturn() {
  const [params] = useSearchParams()
  const status = params.get('trade_status')
  const success = status === 'TRADE_SUCCESS'
  const money = params.get('money')
  const tradeNo = params.get('trade_no')
  const type = params.get('type')

  const payName = useMemo(() => {
    if (type === 'alipay') return '支付宝'
    if (type === 'wxpay') return '微信支付'
    return type || '在线支付'
  }, [type])

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => {
      window.location.replace('/topup')
    }, 4000)
    return () => clearTimeout(t)
  }, [success])

  if (!status) {
    return <Navigate to="/topup" replace />
  }

  return (
    <ClayConsoleShell title="支付结果" subtitle="易支付回调页面">
      <ClayCard className="max-w-xl mx-auto text-center py-10">
        <div
          className={`w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center shadow-clay ${
            success ? 'bg-clay-green-100' : 'bg-clay-pink-100'
          }`}
        >
          {success ? (
            <CheckCircle2 className="w-8 h-8 text-clay-green-ink" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-clay-pink-400" />
          )}
        </div>
        <h2 className="text-2xl font-black mb-2">
          {success ? '支付成功' : '支付未完成'}
        </h2>
        <p className="text-clay-faint text-sm mb-6">
          {success
            ? `已通过 ${payName} 支付 ${money} 元,额度将在到账后立即更新`
            : `当前订单状态:${status}`}
        </p>
        {tradeNo && (
          <p className="text-xs text-clay-faint mb-6">订单号 {tradeNo}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/topup" className="flex-1">
            <ClayButton variant="primary" className="w-full">
              返回充值中心
            </ClayButton>
          </a>
          <a href="/dashboard" className="flex-1">
            <ClayButton variant="secondary" className="w-full">
              返回控制台
            </ClayButton>
          </a>
        </div>
        {success && (
          <p className="mt-5 text-xs text-clay-faint">4 秒后自动返回充值中心…</p>
        )}
      </ClayCard>
    </ClayConsoleShell>
  )
}
