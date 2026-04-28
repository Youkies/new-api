import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LogIn, User, Lock, Github } from 'lucide-react'
import ClayAuthShell from '../components/layout/ClayAuthShell.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayDivider from '../components/clay/ClayDivider.jsx'
import ClayLink from '../components/clay/ClayLink.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { login } from '../services/auth.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useUser()
  const { status } = useStatus()
  const toast = useToast()

  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const passwordLoginDisabled = status?.password_login === false

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    let expired = params.get('expired') === '1'
    try {
      expired = expired || sessionStorage.getItem('uiweb.auth.expired') === '1'
      sessionStorage.removeItem('uiweb.auth.expired')
    } catch (_) {}
    if (expired) {
      setNotice('登录状态已过期，请重新登录。')
    }
  }, [location.search])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.username || !form.password) {
      setError('请输入用户名与密码')
      return
    }
    setLoading(true)
    try {
      const res = await login(form)
      if (res?.success) {
        setUser(res.data)
        toast('登录成功,欢迎回来', 'success')
        let storedFrom = ''
        try {
          storedFrom = sessionStorage.getItem('uiweb.auth.redirect') || ''
          sessionStorage.removeItem('uiweb.auth.redirect')
        } catch (_) {}
        const from = location.state?.from || storedFrom || '/dashboard'
        if (from.startsWith('/console') || from.startsWith('http')) {
          // Explicit legacy path: bridge back to original web/.
          window.location.replace(from)
        } else {
          navigate(from, { replace: true })
        }
      } else {
        setError(res?.message ?? '登录失败,请检查用户名或密码')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const oauthProviders = []
  if (status?.github_oauth) oauthProviders.push({ id: 'github', label: 'GitHub', icon: Github })

  return (
    <ClayAuthShell
      title="欢迎回来"
      subtitle="登录你的 Youkies API 账号"
      footer={
        <>
          还没有账号？ <ClayLink to="/register">立即注册</ClayLink>
        </>
      }
    >
      {notice && !error && (
        <ClayAlert tone="info" className="mb-5">
          {notice}
        </ClayAlert>
      )}

      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {passwordLoginDisabled ? (
        <ClayAlert tone="warning" className="mb-5">
          管理员已关闭账号密码登录,请使用下方第三方登录。
        </ClayAlert>
      ) : (
        <form onSubmit={onSubmit}>
          <ClayField
            label="用户名 / 邮箱"
            required
            as={ClayInput}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="请输入用户名"
            autoFocus
            autoComplete="username"
          />
          <ClayField
            label="密码"
            required
            as={ClayInput}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <div className="flex justify-end -mt-2 mb-5">
            <ClayLink to="/reset" className="text-sm">
              忘记密码？
            </ClayLink>
          </div>
          <ClayButton variant="primary" className="w-full" type="submit" disabled={loading}>
            {loading ? '登录中…' : (<><LogIn className="w-4 h-4" /> 登录</>)}
          </ClayButton>
        </form>
      )}

      {oauthProviders.length > 0 && (
        <>
          <ClayDivider label="或使用" />
          <div className="flex flex-col gap-3">
            {oauthProviders.map((p) => {
              const Icon = p.icon
              return (
                <ClayButton
                  key={p.id}
                  as="a"
                  href={`/api/oauth/state`}
                  variant="ghost"
                  className="w-full"
                >
                  <Icon className="w-4 h-4" /> 使用 {p.label} 登录
                </ClayButton>
              )
            })}
          </div>
        </>
      )}
    </ClayAuthShell>
  )
}
