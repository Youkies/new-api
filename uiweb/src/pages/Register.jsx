import { useState } from 'react'
import { UserPlus, Mail, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ClayAuthShell from '../components/layout/ClayAuthShell.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayLink from '../components/clay/ClayLink.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { register, requestVerificationCode } from '../services/auth.js'

export default function Register() {
  const navigate = useNavigate()
  const { status } = useStatus()
  const toast = useToast()

  const emailVerification = !!status?.email_verification
  const registerEnabled = status?.register_enabled !== false
  const inviteOnly = !!status?.invite_only_register

  const [form, setForm] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    verification_code: '',
    invite_code: '',
  })
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')

  const update = (k, v) => setForm({ ...form, [k]: v })

  const startCooldown = () => {
    setCooldown(60)
    const id = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(id)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  const onSendCode = async () => {
    if (!form.email) {
      setError('请先填写邮箱')
      return
    }
    setError('')
    setSending(true)
    try {
      const res = await requestVerificationCode({ email: form.email })
      if (res?.success) {
        toast('验证码已发送,请查收邮箱', 'success')
        startCooldown()
      } else {
        setError(res?.message ?? '发送失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '发送失败')
    } finally {
      setSending(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.password2) {
      setError('两次输入的密码不一致')
      return
    }
    if (emailVerification && !form.verification_code) {
      setError('请填写邮箱验证码')
      return
    }
    if (inviteOnly && !form.invite_code.trim()) {
      setError('请填写邀请码')
      return
    }
    setLoading(true)
    try {
      const res = await register(form)
      if (res?.success) {
        toast('注册成功,正在跳转登录', 'success')
        setTimeout(() => navigate('/login'), 800)
      } else {
        setError(res?.message ?? '注册失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '注册失败')
    } finally {
      setLoading(false)
    }
  }

  if (!registerEnabled) {
    return (
      <ClayAuthShell title="注册已关闭">
        <ClayAlert tone="warning">
          管理员已关闭用户自助注册。如需账号请联系管理员。
        </ClayAlert>
        <div className="text-center mt-5">
          <ClayLink to="/login">返回登录</ClayLink>
        </div>
      </ClayAuthShell>
    )
  }

  return (
    <ClayAuthShell
      title="创建账号"
      subtitle="欢迎加入 Youkies API"
      footer={
        <>
          已有账号？ <ClayLink to="/login">前往登录</ClayLink>
        </>
      }
    >
      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}
      <form onSubmit={onSubmit}>
        <ClayField
          label="用户名"
          required
          value={form.username}
          onChange={(e) => update('username', e.target.value)}
          placeholder="建议 4-12 位字母数字"
          autoComplete="username"
        />
        <ClayField
          label="密码"
          required
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          placeholder="至少 8 位"
          autoComplete="new-password"
        />
        <ClayField
          label="确认密码"
          required
          type="password"
          value={form.password2}
          onChange={(e) => update('password2', e.target.value)}
          placeholder="再输一次"
          autoComplete="new-password"
        />
        {emailVerification && (
          <>
            <ClayField
              label="邮箱"
              required
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="example@qq.com"
              hint="当前站点仅支持 QQ 邮箱注册(例如 xxx@qq.com)"
              autoComplete="email"
            />
            <div className="mb-5">
              <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">
                邮箱验证码 <span className="text-clay-pink-300">*</span>
              </label>
              <div className="flex gap-3">
                <ClayInput
                  value={form.verification_code}
                  onChange={(e) => update('verification_code', e.target.value)}
                  placeholder="6 位数字"
                  className="flex-1"
                />
                <ClayButton
                  type="button"
                  variant="secondary"
                  className="!px-5 !py-3 !text-sm whitespace-nowrap"
                  disabled={sending || cooldown > 0}
                  onClick={onSendCode}
                >
                  {cooldown > 0 ? (
                    <>
                      <Timer className="w-4 h-4" /> {cooldown}s
                    </>
                  ) : sending ? (
                    '发送中…'
                  ) : (
                    <>
                      <Mail className="w-4 h-4" /> 获取验证码
                    </>
                  )}
                </ClayButton>
              </div>
            </div>
          </>
        )}

        {inviteOnly && (
          <ClayField
            label="邀请码"
            required
            value={form.invite_code}
            onChange={(e) => update('invite_code', e.target.value.toUpperCase())}
            placeholder="8 位邀请码"
            autoComplete="off"
            maxLength={8}
          />
        )}

        <ClayButton variant="primary" className="w-full" type="submit" disabled={loading}>
          {loading ? '注册中…' : (<><UserPlus className="w-4 h-4" /> 立即注册</>)}
        </ClayButton>
      </form>
    </ClayAuthShell>
  )
}
