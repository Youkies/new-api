import { useEffect, useState, useCallback } from 'react'
import {
  CalendarCheck2, Gift, Trophy, Flame, ChevronLeft, ChevronRight,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayStat from '../components/clay/ClayStat.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { quotaToDisplay } from '../utils/quota.js'
import { getCheckinStatus, doCheckin } from '../services/checkin.js'

function getMonthStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildCalendar(year, month) {
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const startDow = first.getDay()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay; d++) cells.push(d)
  return cells
}

const DOW = ['日', '一', '二', '三', '四', '五', '六']

export default function Checkin() {
  const toast = useToast()
  const [viewDate, setViewDate] = useState(new Date())
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [quotaRange, setQuotaRange] = useState([0, 0])
  const [lastAward, setLastAward] = useState(null)

  const monthStr = getMonthStr(viewDate)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const cells = buildCalendar(year, month)
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const load = useCallback(async (m) => {
    setLoading(true)
    try {
      const res = await getCheckinStatus(m)
      if (!res?.success) {
        if (res?.message?.includes('未启用')) {
          setEnabled(false)
        }
        return
      }
      setEnabled(true)
      const d = res.data
      setStats(d.stats)
      setQuotaRange([d.min_quota ?? 0, d.max_quota ?? 0])
    } catch (e) {
      if (e?.response?.data?.message?.includes('未启用')) {
        setEnabled(false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(monthStr) }, [monthStr, load])

  const checkedDates = new Set(
    (stats?.records ?? []).map((r) => {
      const parts = r.checkin_date.split('-')
      return Number(parts[2])
    })
  )

  const onCheckin = async () => {
    setChecking(true)
    setLastAward(null)
    try {
      const res = await doCheckin()
      if (res?.success) {
        const q = res.data?.quota_awarded
        setLastAward(q)
        toast(`签到成功！获得 ${quotaToDisplay(q ?? 0).text}`, 'success')
        load(monthStr)
      } else {
        toast(res?.message ?? '签到失败', 'error')
      }
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '签到失败', 'error')
    } finally {
      setChecking(false)
    }
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => {
    const n = new Date(year, month + 1, 1)
    if (n <= new Date()) setViewDate(n)
  }

  if (!enabled) {
    return (
      <ClayConsoleShell title="每日签到">
        <ClayAlert tone="info">签到功能暂未开放。</ClayAlert>
      </ClayConsoleShell>
    )
  }

  return (
    <ClayConsoleShell title="每日签到" subtitle="每天签到领取免费额度">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <ClayStat
          icon={CalendarCheck2}
          label="本月签到"
          value={`${stats?.checkin_count ?? 0} 天`}
          tone="blue"
        />
        <ClayStat
          icon={Trophy}
          label="累计签到"
          value={`${stats?.total_checkins ?? 0} 天`}
          tone="purple"
        />
        <ClayStat
          icon={Gift}
          label="累计奖励"
          value={quotaToDisplay(stats?.total_quota ?? 0).text}
          tone="green"
        />
        <ClayStat
          icon={Flame}
          label="每次可得"
          value={`${quotaToDisplay(quotaRange[0]).text} ~ ${quotaToDisplay(quotaRange[1]).text}`}
          tone="pink"
        />
      </div>

      <div className="max-w-md mx-auto">
        <ClayCard>
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-clay-sm hover:bg-white/40">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-black">{year} 年 {month + 1} 月</h2>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded-clay-sm hover:bg-white/40 disabled:opacity-30">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* DOW header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-clay-faint mb-2">
            {DOW.map((d) => <div key={d}>{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />
              const isToday = isCurrentMonth && day === today.getDate()
              const checked = checkedDates.has(day)
              return (
                <div
                  key={day}
                  className={`
                    aspect-square flex items-center justify-center rounded-clay-sm text-sm font-bold transition-all
                    ${checked
                      ? 'bg-clay-pink-200 text-[#8a4860] shadow-clay-sm'
                      : isToday
                        ? 'ring-2 ring-clay-pink-300 ring-inset'
                        : 'text-clay-faint'
                    }
                  `}
                >
                  {checked ? <CalendarCheck2 className="w-4 h-4" /> : day}
                </div>
              )
            })}
          </div>

          {/* Checkin button */}
          <div className="mt-6 text-center">
            {lastAward != null && (
              <ClayAlert tone="success" className="mb-4">
                🎉 获得 {quotaToDisplay(lastAward).text}
              </ClayAlert>
            )}
            <ClayButton
              variant="primary"
              className="w-full"
              disabled={checking || stats?.checked_in_today}
              onClick={onCheckin}
            >
              {stats?.checked_in_today
                ? '✓ 今日已签到'
                : checking
                  ? '签到中…'
                  : '立即签到'}
            </ClayButton>
          </div>
        </ClayCard>
      </div>
    </ClayConsoleShell>
  )
}
