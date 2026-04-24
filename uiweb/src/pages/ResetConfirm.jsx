import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck, Copy } from 'lucide-react'
import ClayAuthShell from '../components/layout/ClayAuthShell.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayLink from '../components/clay/ClayLink.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { confirmReset } from '../services/auth.js'

export default function ResetConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const missingInput = !email || !token

  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  const onConfirm = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await confirmReset({ email, token })
      if (res?.success) {
        setNewPassword(res.data)
        setDone(true)
        toast('密码已重置', 'success')
      } else {
        setError(res?.message ?? '重置失败,链接可能已过期')
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '重置失败')
    } finally {
      setLoading(false)
    }
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(newPassword)
      toast('已复制到剪贴板', 'success')
    } catch (_) {
      toast('复制失败,请手动选中复制', 'warning')
    }
  }

  return (
    <ClayAuthShell
      title={done ? '重置完成' : '重置密码'}
      subtitle={done ? '使用下方新密码登录' : '确认后将生成新密码'}
      footer={<ClayLink to="/login">返回登录</ClayLink>}
    >
      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {missingInput ? (
        <ClayAlert tone="warning">
          链接缺少参数,请检查邮件中完整的重置链接,或
          <ClayLink to="/reset" className="ml-1">
            重新申请
          </ClayLink>
          。
        </ClayAlert>
      ) : done ? (
        <>
          <ClayAlert tone="success" title="新密码已生成" className="mb-5">
            请妥善保管,可以在登录后在「个人设置」中修改成你喜欢的密码。
          </ClayAlert>
          <div className="clay-input !font-mono !text-base flex items-center justify-between gap-3">
            <span className="break-all">{newPassword}</span>
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 p-2 rounded-full hover:bg-white/40 transition-colors"
              title="复制"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <ClayButton
            variant="primary"
            className="w-full mt-5"
            onClick={() => navigate('/login')}
          >
            去登录
          </ClayButton>
        </>
      ) : (
        <>
          <div className="clay-input !bg-clay-bg mb-3 flex items-center gap-3">
            <span className="ml-2 text-clay-faint text-sm">邮箱</span>
            <span className="font-bold truncate">{email}</span>
          </div>
          <ClayButton
            variant="primary"
            className="w-full"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : (<><ShieldCheck className="w-4 h-4" /> 确认重置密码</>)}
          </ClayButton>
        </>
      )}
    </ClayAuthShell>
  )
}
