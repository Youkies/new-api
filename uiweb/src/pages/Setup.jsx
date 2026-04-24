import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Database, User, ShieldCheck } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getSetupState, submitSetup } from '../services/auth.js'

const STEPS = [
  { id: 'intro', title: '欢迎使用 New API', icon: Sparkles },
  { id: 'admin', title: '创建管理员账号', icon: User },
  { id: 'secret', title: '安全密钥', icon: ShieldCheck },
  { id: 'done', title: '开始使用', icon: Database },
]

export default function Setup() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [checking, setChecking] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    SessionSecret: '',
    CryptoSecret: '',
  })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getSetupState()
        if (res?.data?.status === true) {
          // already set up — redirect home
          setBlocked(true)
        }
      } catch (_) {
        // setup endpoint missing or not accessible — let user proceed
      } finally {
        setChecking(false)
      }
    })()
  }, [])

  const update = (k, v) => setForm({ ...form, [k]: v })

  const next = () => {
    setError('')
    if (step === 1) {
      if (!form.username || form.username.length < 3) {
        setError('用户名至少 3 位')
        return
      }
      if (!form.password || form.password.length < 8) {
        setError('密码至少 8 位')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('两次密码不一致')
        return
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => {
    setError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = {
        username: form.username,
        password: form.password,
        confirmPassword: form.confirmPassword,
        SessionSecret: form.SessionSecret,
        CryptoSecret: form.CryptoSecret,
      }
      const res = await submitSetup(payload)
      if (res?.success) {
        toast('初始化完成,欢迎来到 New API', 'success')
        setTimeout(() => {
          window.location.replace('/login')
        }, 800)
      } else {
        setError(res?.message ?? '初始化失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-clay-bg flex items-center justify-center">
        <p className="text-clay-faint font-semibold">加载中…</p>
      </div>
    )
  }

  if (blocked) {
    return (
      <div className="min-h-screen bg-clay-bg flex items-center justify-center px-6">
        <ClayCard className="max-w-md text-center">
          <div className="clay-icon-box !w-16 !h-16 mx-auto mb-5 text-clay-green-200">
            <ShieldCheck className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black mb-2">系统已初始化</h1>
          <p className="text-clay-faint mb-6">
            当前实例已完成安装向导,无需重复初始化。
          </p>
          <ClayButton variant="primary" onClick={() => navigate('/login')}>
            去登录
          </ClayButton>
        </ClayCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-clay-bg py-12 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="flex justify-between mb-10 gap-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    done
                      ? 'bg-clay-green-100 shadow-clay'
                      : active
                      ? 'bg-clay-blue-100 shadow-clay'
                      : 'bg-clay-bg shadow-clay-inset'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <span className={`text-xs font-bold ${active ? 'text-clay-ink' : 'text-clay-faint'}`}>
                  {s.title}
                </span>
              </div>
            )
          })}
        </div>

        <ClayCard>
          <h2 className="text-3xl font-black mb-3 tracking-tight">{STEPS[step].title}</h2>

          {error && (
            <ClayAlert tone="error" className="mb-5">
              {error}
            </ClayAlert>
          )}

          {step === 0 && (
            <>
              <p className="text-clay-ink leading-relaxed mb-4">
                这套向导会帮你完成:
              </p>
              <ul className="space-y-2 text-clay-ink mb-4 list-disc pl-6">
                <li>创建首个管理员账号</li>
                <li>配置 Session / Crypto 密钥(留空则自动生成)</li>
                <li>初始化数据库并启动服务</li>
              </ul>
              <p className="text-clay-faint text-sm">
                后续可以在「系统设置」中修改任何配置。整个过程通常少于一分钟。
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <ClayField
                label="管理员用户名"
                required
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="至少 3 位"
              />
              <ClayField
                label="密码"
                required
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="至少 8 位"
              />
              <ClayField
                label="确认密码"
                required
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
              />
            </>
          )}

          {step === 2 && (
            <>
              <ClayAlert tone="info" className="mb-5">
                下列密钥留空时,系统会自动生成强随机值。如果你想跨实例复用 session 或加密数据,
                可以在此显式指定相同值。
              </ClayAlert>
              <ClayField
                label="Session Secret"
                value={form.SessionSecret}
                onChange={(e) => update('SessionSecret', e.target.value)}
                placeholder="留空自动生成"
              />
              <ClayField
                label="Crypto Secret"
                value={form.CryptoSecret}
                onChange={(e) => update('CryptoSecret', e.target.value)}
                placeholder="留空自动生成"
              />
            </>
          )}

          {step === 3 && (
            <>
              <ClayAlert tone="success" title="准备就绪" className="mb-5">
                确认创建管理员并初始化系统。点击下方按钮开始。
              </ClayAlert>
              <div className="clay-input !bg-clay-bg !p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-clay-faint">用户名</span>
                  <span className="font-bold">{form.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clay-faint">Session Secret</span>
                  <span className="font-bold">{form.SessionSecret ? '自定义' : '自动生成'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clay-faint">Crypto Secret</span>
                  <span className="font-bold">{form.CryptoSecret ? '自定义' : '自动生成'}</span>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between mt-8 gap-3">
            <ClayButton
              variant="ghost"
              onClick={back}
              disabled={step === 0 || loading}
              className={step === 0 ? 'opacity-40 pointer-events-none' : ''}
            >
              上一步
            </ClayButton>
            {step < STEPS.length - 1 ? (
              <ClayButton variant="primary" onClick={next}>
                下一步
              </ClayButton>
            ) : (
              <ClayButton variant="primary" onClick={onSubmit} disabled={loading}>
                {loading ? '初始化中…' : '完成安装'}
              </ClayButton>
            )}
          </div>
        </ClayCard>
      </div>
    </div>
  )
}
