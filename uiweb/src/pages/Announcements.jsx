import { useEffect, useState } from 'react'
import { Bell, CalendarClock, Loader2, Megaphone, Pin } from 'lucide-react'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { listAnnouncements } from '../services/announcements.js'

function formatTime(ts) {
  if (!ts) return '长期有效'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
}

export default function Announcements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listAnnouncements({ p: 1, size: 30 })
      if (res?.success === false) throw new Error(res.message || '公告加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '公告加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  return (
    <ClayPageShell>
      <section className="max-w-4xl mx-auto">
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-pink-300">
          <Megaphone className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-4 tracking-tight">
          站点公告
        </h1>
        <p className="text-center text-clay-faint mb-8 text-lg">
          查看最近发布的服务通知、使用提醒和运营信息。
        </p>

        {error && (
          <ClayAlert tone="error" className="mb-6">
            {error}
          </ClayAlert>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">加载公告中…</p>
          </div>
        ) : items.length === 0 ? (
          <ClayCard className="text-center !py-16">
            <Bell className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
            <p className="font-bold text-clay-faint">暂时没有公告</p>
          </ClayCard>
        ) : (
          <div className="space-y-5">
            {items.map((item) => (
              <ClayCard key={`${item.id}-${item.version}`} className="!p-6 md:!p-7">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {item.pinned && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-3 py-1 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm">
                          <Pin className="w-3 h-3" />
                          置顶
                        </span>
                      )}
                      {item.force_popup && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-3 py-1 rounded-clay-pill bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm">
                          <Bell className="w-3 h-3" />
                          重要
                        </span>
                      )}
                      <span className="text-[11px] font-black px-3 py-1 rounded-clay-pill bg-white/60 text-clay-faint shadow-clay-sm">
                        v{item.version}
                      </span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight break-words">{item.title}</h2>
                    {item.summary && (
                      <p className="text-sm text-clay-faint font-semibold mt-2 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-clay-faint shrink-0">
                    <CalendarClock className="w-4 h-4" />
                    {formatTime(item.created_at)}
                  </div>
                </div>
                <div className="rounded-clay bg-white/45 shadow-clay-inset p-5">
                  <div className="whitespace-pre-wrap break-words leading-7 text-clay-ink font-semibold">
                    {item.content}
                  </div>
                </div>
              </ClayCard>
            ))}
          </div>
        )}

        {!loading && (
          <div className="mt-8 flex justify-center">
            <ClayButton variant="ghost" onClick={fetchData}>
              <Bell className="w-4 h-4" />
              刷新公告
            </ClayButton>
          </div>
        )}
      </section>
    </ClayPageShell>
  )
}
