import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, CheckCircle2, Megaphone } from 'lucide-react'
import ClayButton from '../clay/ClayButton.jsx'
import ClayCheckbox from '../clay/ClayCheckbox.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { ackAnnouncement, listActiveAnnouncements } from '../../services/announcements.js'

function localAckKey(announcement) {
  return `uiweb.announcement.ack.${announcement?.id}.${announcement?.version}`
}

function localHideKey(announcement) {
  return `uiweb.announcement.hide.${announcement?.id}.${announcement?.version}`
}

function isLocallyAcknowledged(announcement) {
  try {
    return (
      localStorage.getItem(localAckKey(announcement)) === '1' ||
      localStorage.getItem(localHideKey(announcement)) === '1'
    )
  } catch (_) {
    return false
  }
}

function markLocalAcknowledged(announcement, dontShowAgain) {
  try {
    localStorage.setItem(localAckKey(announcement), '1')
    if (dontShowAgain) localStorage.setItem(localHideKey(announcement), '1')
  } catch (_) {}
}

function getResponseItems(res) {
  return res?.data?.items ?? res?.data?.data?.items ?? res?.data ?? []
}

export default function AnnouncementProvider({ children }) {
  const { user } = useUser()
  const { refreshUnread } = useNotifications()
  const toast = useToast()
  const [queue, setQueue] = useState([])
  const [ackLoading, setAckLoading] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(true)

  const current = queue[0] ?? null

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await listActiveAnnouncements()
      if (res?.success === false) return
      const items = Array.isArray(getResponseItems(res)) ? getResponseItems(res) : []
      const pending = items.filter((item) => item && !isLocallyAcknowledged(item))
      setQueue(pending)
    } catch (_) {
      // Announcement checks should never block normal page loading.
    }
  }, [])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements, user?.id])

  useEffect(() => {
    if (!current) return
    setDontShowAgain(true)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [current])

  const positionText = useMemo(() => {
    if (!current || queue.length <= 1) return ''
    return `待确认 ${queue.length} 条`
  }, [current, queue.length])

  const handleAck = async () => {
    if (!current || ackLoading) return
    setAckLoading(true)
    try {
      if (user?.id) {
        const res = await ackAnnouncement(current.id, { dont_show_again: dontShowAgain })
        if (res?.success === false) {
          toast(res.message || '公告确认失败', 'error')
          return
        }
      }
      markLocalAcknowledged(current, dontShowAgain)
      setQueue((prev) => prev.filter((item) => item.id !== current.id || item.version !== current.version))
      refreshUnread()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '公告确认失败', 'error')
    } finally {
      setAckLoading(false)
    }
  }

  return (
    <>
      {children}
      {current && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center p-4 bg-clay-bg/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-clay-lg bg-clay-bg shadow-clay p-6 md:p-8 border-2 border-white/30">
            <div className="flex items-start gap-4 mb-5">
              <div className="clay-icon-box !w-14 !h-14 text-clay-pink-300 shrink-0">
                <BellRing className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="clay-badge !bg-clay-pink-100">公告</span>
                  {current.force_popup && (
                    <span className="text-[11px] font-black px-3 py-1 rounded-clay-pill bg-clay-yellow-100 text-[#8a6a32] shadow-clay-sm">
                      需要确认
                    </span>
                  )}
                  {positionText && (
                    <span className="text-[11px] font-black px-3 py-1 rounded-clay-pill bg-white/60 text-clay-faint shadow-clay-sm">
                      {positionText}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-clay-ink break-words">
                  {current.title}
                </h2>
                {current.summary && (
                  <p className="text-sm text-clay-faint font-semibold mt-2 leading-relaxed">
                    {current.summary}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-clay bg-white/45 shadow-clay-inset p-5 max-h-[42vh] overflow-y-auto">
              <div className="whitespace-pre-wrap break-words leading-7 text-clay-ink font-semibold">
                {current.content}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <ClayCheckbox
                checked={dontShowAgain}
                onChange={setDontShowAgain}
                label="不再显示此公告"
              />
              <ClayButton
                variant="primary"
                onClick={handleAck}
                disabled={ackLoading}
                className="!px-6"
              >
                {ackLoading ? (
                  <>
                    <Megaphone className="w-4 h-4 animate-pulse" />
                    确认中
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    我已知晓
                  </>
                )}
              </ClayButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
