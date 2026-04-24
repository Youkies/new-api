import { useState } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import ClayAuthShell from '../components/layout/ClayAuthShell.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayLink from '../components/clay/ClayLink.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { sendResetEmail } from '../services/auth.js'

export default function ResetRequest() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) {
      setError('请填写邮箱')
      return
    }
    setLoading(true)
    try {
      const res = await sendResetEmail({ email })
      if (res?.success) {
        toast('重置链接已发送,请查收邮箱', 'success')
        setSent(true)
      } else {
        setError(res?.message ?? '发送失败')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '发送失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ClayAuthShell
      title="忘记密码？"
      subtitle="别担心,邮件把链接递到你手里"
      footer={
        <>
          想起来了？ <ClayLink to="/login">返回登录</ClayLink>
        </>
      }
    >
      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {sent ? (
        <ClayAlert tone="success" title="已发送">
          我们已向 <strong>{email}</strong> 发送了密码重置邮件。
          请查收邮箱并点击邮件中的链接完成重置。
        </ClayAlert>
      ) : (
        <form onSubmit={onSubmit}>
          <ClayField
            label="注册邮箱"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@example.com"
            autoFocus
            autoComplete="email"
          />
          <ClayButton variant="primary" className="w-full" type="submit" disabled={loading}>
            {loading ? '发送中…' : (<><Mail className="w-4 h-4" /> 发送重置邮件</>)}
          </ClayButton>
        </form>
      )}
    </ClayAuthShell>
  )
}
