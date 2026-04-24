import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import ClayAuthShell from '../components/layout/ClayAuthShell.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { oauthExchange } from '../services/auth.js'
import { useUser } from '../context/UserContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function OAuthCallback() {
  const { provider } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useUser()
  const toast = useToast()

  const [state, setState] = useState('loading')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    const oauthState = params.get('state')
    if (!code) {
      setState('error')
      setMessage('未收到 OAuth 授权码')
      return
    }

    ;(async () => {
      try {
        const res = await oauthExchange(provider, { code, state: oauthState })
        if (res?.success) {
          setUser(res.data)
          setState('success')
          toast(`${provider} 登录成功`, 'success')
          setTimeout(() => navigate('/dashboard', { replace: true }), 700)
        } else {
          setState('error')
          setMessage(res?.message ?? 'OAuth 登录失败')
        }
      } catch (err) {
        setState('error')
        setMessage(err?.response?.data?.message ?? err.message ?? 'OAuth 登录失败')
      }
    })()
  }, [provider, params, setUser, toast])

  return (
    <ClayAuthShell title={providerLabel(provider)} subtitle="正在完成 OAuth 登录">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-10 h-10 text-clay-blue-200 animate-spin" />
          <p className="text-clay-faint font-semibold">正在验证授权,请稍候…</p>
        </div>
      )}
      {state === 'success' && (
        <ClayAlert tone="success" title="登录成功">
          正在跳转到控制台…
        </ClayAlert>
      )}
      {state === 'error' && (
        <>
          <ClayAlert tone="error" title="登录失败" className="mb-5">
            {message}
          </ClayAlert>
          <ClayButton variant="primary" className="w-full" onClick={() => navigate('/login')}>
            返回登录
          </ClayButton>
        </>
      )}
    </ClayAuthShell>
  )
}

function providerLabel(p) {
  const map = {
    github: 'GitHub',
    discord: 'Discord',
    oidc: 'OIDC',
    linuxdo: 'LinuxDo',
    google: 'Google',
    wechat: '微信',
    telegram: 'Telegram',
  }
  return map[p] ?? (p ? p[0].toUpperCase() + p.slice(1) : 'OAuth')
}
