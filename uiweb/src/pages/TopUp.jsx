import { useEffect, useState } from 'react'
import { Gift, Wallet, Sparkles, CheckCircle2, ExternalLink, ShoppingCart } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayStat from '../components/clay/ClayStat.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { self } from '../services/user.js'
import { redeem } from '../services/topup.js'
import { quotaToDisplay } from '../utils/quota.js'

export default function TopUp() {
  const { user, setUser } = useUser()
  const { status } = useStatus()

  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const r = await self()
        if (r?.data) setUser(r.data)
      } catch (_) {}
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <ClayConsoleShell title="充值中心" subtitle="使用兑换码给账户补充额度">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <ClayStat icon={Wallet} label="当前余额" value={balance.text} tone="blue" />
        <ClayStat icon={Sparkles} label="累计用量" value={used.text} tone="pink" />
      </div>

      <div className={`grid gap-5 ${topUpLink ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
        {/* Redemption card */}
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

          <p className="mt-6 text-xs text-clay-faint leading-relaxed">
            本站采用兑换码充值。如需兑换码,请联系管理员。
          </p>
        </ClayCard>

        {/* Purchase link card */}
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
    </ClayConsoleShell>
  )
}
