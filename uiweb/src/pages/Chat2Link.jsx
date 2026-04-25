import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MessageSquarePlus, AlertTriangle } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import { listEnabledKeys } from '../services/tokens.js'
import { useStatus } from '../context/StatusContext.jsx'

function buildLink({ chatLink, serverAddress, key }) {
  if (!chatLink || !serverAddress || !key) return ''
  const settings = { key: `sk-${key}`, url: serverAddress }
  return `${chatLink}/#/?settings=${encodeURIComponent(JSON.stringify(settings))}`
}

export default function Chat2Link() {
  const { status } = useStatus()
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const chatLink = status?.chat_link || status?.ChatLink
      const serverAddress = status?.server_address || window.location.origin
      if (!chatLink) {
        setState('no_chat')
        return
      }
      try {
        const keys = await listEnabledKeys()
        if (!keys || keys.length === 0) {
          setState('no_token')
          return
        }
        const url = buildLink({ chatLink, serverAddress, key: keys[0] })
        if (!url) {
          setError('无法生成跳转链接')
          setState('error')
          return
        }
        setState('redirect')
        window.location.replace(url)
      } catch (err) {
        setError(err?.response?.data?.message ?? err.message ?? '加载失败')
        setState('error')
      }
    })()
  }, [status])

  return (
    <div className="min-h-screen bg-clay-bg flex items-center justify-center px-4">
      <ClayCard className="max-w-md w-full text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-clay-blue-200 animate-spin" />
            <h2 className="text-xl font-extrabold mb-2">正在加载</h2>
            <p className="text-clay-faint">正在读取你的 Token,稍候即将跳转…</p>
          </>
        )}
        {state === 'redirect' && (
          <>
            <MessageSquarePlus className="w-12 h-12 mx-auto mb-4 text-clay-green-200" />
            <h2 className="text-xl font-extrabold mb-2">正在跳转</h2>
            <p className="text-clay-faint">如果页面没有自动跳转,请检查弹窗拦截或重新加载。</p>
          </>
        )}
        {state === 'no_token' && (
          <>
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-clay-yellow-200" />
            <h2 className="text-xl font-extrabold mb-2">没有可用 Token</h2>
            <p className="text-clay-faint mb-5">
              你需要先启用一个 API Token,才能使用聊天跳转功能。
            </p>
            <a href="/tokens">
              <ClayButton variant="primary">去管理 Token</ClayButton>
            </a>
          </>
        )}
        {state === 'no_chat' && (
          <>
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-clay-yellow-200" />
            <h2 className="text-xl font-extrabold mb-2">未配置聊天地址</h2>
            <p className="text-clay-faint mb-5">
              管理员尚未在系统设置中配置外部聊天链接。
            </p>
            <Link to="/">
              <ClayButton variant="ghost">回首页</ClayButton>
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <ClayAlert tone="error" className="mb-5 text-left">
              {error}
            </ClayAlert>
            <Link to="/dashboard">
              <ClayButton variant="primary">回仪表盘</ClayButton>
            </Link>
          </>
        )}
      </ClayCard>
    </div>
  )
}
