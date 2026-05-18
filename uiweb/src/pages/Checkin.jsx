import { useEffect, useState, useCallback, useRef } from 'react'
import {
  CalendarCheck2, Gift, Trophy, Flame, ChevronLeft, ChevronRight, Clock,
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

function formatCalendarReward(quota) {
  return quotaToDisplay(quota ?? 0).text
    .replace(/^\s*[+-]?\s*/u, '')
    .replace(/^[^\d.,]+/u, '')
}

function QuotaAmount({ quota, digits = 2, className = '' }) {
  const text = quotaToDisplay(quota ?? 0, digits).text
  const match = text.match(/^(-?)([^\d.,+-]*)([\d.,].*)$/u)
  if (!match) {
    return <span className={`inline-block max-w-full whitespace-nowrap ${className}`}>{text}</span>
  }
  const [, sign, symbol, amount] = match
  return (
    <span className={`inline-flex max-w-full min-w-0 items-baseline whitespace-nowrap ${className}`}>
      {sign && <span>{sign}</span>}
      {symbol && <span className="mr-1 shrink-0 text-[0.75em] leading-none">{symbol}</span>}
      <span className="min-w-0 tabular-nums">{amount}</span>
    </span>
  )
}

function QuotaRange({ minQuota, maxQuota }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 leading-tight">
      <QuotaAmount quota={minQuota} />
      <span className="opacity-80">~</span>
      <QuotaAmount quota={maxQuota} />
    </span>
  )
}

function getSecondsUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(0, Math.floor((midnight - now) / 1000))
}

function formatCountdown(totalSec) {
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return { h, m, s }
}

function CountdownTimer({ targetTs, onElapsed }) {
  const computeSecs = () => {
    if (!targetTs) return 0
    return Math.max(0, targetTs - Math.floor(Date.now() / 1000))
  }
  const [secs, setSecs] = useState(computeSecs)
  const ref = useRef()

  useEffect(() => {
    setSecs(computeSecs())
    ref.current = setInterval(() => {
      const v = computeSecs()
      setSecs(v)
      if (v <= 0) {
        clearInterval(ref.current)
        onElapsed?.()
      }
    }, 1000)
    return () => clearInterval(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetTs])

  const { h, m, s } = formatCountdown(secs)

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm font-bold text-clay-faint">
        <Clock className="w-3.5 h-3.5" />
        <span>下次签到倒计时</span>
      </div>
      <div className="flex items-center gap-1.5">
        {[h, m, s].map((v, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-lg font-black text-clay-faint">:</span>}
            <div className="w-10 h-10 rounded-clay-sm bg-clay-bg shadow-clay-inset flex items-center justify-center text-lg font-black tabular-nums">
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Checkin() {
  const toast = useToast()
  const [viewDate, setViewDate] = useState(new Date())
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [quotaRange, setQuotaRange] = useState([0, 0])
  const [lastAward, setLastAward] = useState(null)
  const [nextCheckinAt, setNextCheckinAt] = useState(null)

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
      // Prefer server-provided next checkin time (server's local midnight)
      // Adjust for clock skew: align server_now to client clock
      if (d.next_checkin_at) {
        if (d.server_now) {
          const skew = Math.floor(Date.now() / 1000) - d.server_now
          setNextCheckinAt(d.next_checkin_at + skew)
        } else {
          setNextCheckinAt(d.next_checkin_at)
        }
      } else {
        setNextCheckinAt(Math.floor(Date.now() / 1000) + getSecondsUntilMidnight())
      }
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
  const recordsByDay = new Map(
    (stats?.records ?? []).map((record) => {
      const parts = String(record.checkin_date || '').split('-')
      return [Number(parts[2]), record]
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
          value={<QuotaAmount quota={stats?.total_quota ?? 0} />}
          tone="green"
          valueClassName="text-[clamp(1.7rem,8vw,2.25rem)] leading-tight"
        />
        <ClayStat
          icon={Flame}
          label="每次可得"
          value={<QuotaRange minQuota={quotaRange[0]} maxQuota={quotaRange[1]} />}
          tone="pink"
          valueClassName="text-[clamp(1.5rem,7vw,2.05rem)] leading-tight"
        />
      </div>

      <div className="max-w-xl mx-auto">
        <ClayCard>
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="clay-icon-btn"
              aria-label="上个月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-black">{year} 年 {month + 1} 月</h2>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="clay-icon-btn disabled:opacity-30 disabled:pointer-events-none"
              aria-label="下个月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* DOW header */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-clay-faint mb-2">
            {DOW.map((d) => <div key={d}>{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="aspect-square" />
              const isToday = isCurrentMonth && day === today.getDate()
              const checked = checkedDates.has(day)
              const record = recordsByDay.get(day)
              const rewardText = record ? formatCalendarReward(record.quota_awarded) : ''
              return (
                <div
                  key={day}
                  className={`
                    aspect-square min-w-0 px-0.5 py-1 flex flex-col items-center justify-center rounded-[18px] sm:rounded-clay-sm text-sm sm:text-base font-bold transition-all
                    ${checked
                      ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
                      : isToday
                        ? 'bg-clay-pink-50/60 text-clay-pink-ink shadow-clay-inset-sm'
                        : 'text-clay-faint'
                    }
                  `}
                >
                  <span className="leading-none">{day}</span>
                  {checked ? (
                    <span className="mt-1 block max-w-full truncate text-[9px] sm:text-[10px] font-black leading-none text-clay-pink-ink/80 tabular-nums">
                      {rewardText}
                    </span>
                  ) : (
                    <span className="h-3 text-[10px] leading-none">&nbsp;</span>
                  )}
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
            {stats?.checked_in_today && (
              <CountdownTimer
                targetTs={nextCheckinAt}
                onElapsed={() => load(monthStr)}
              />
            )}
          </div>
        </ClayCard>
      </div>
    </ClayConsoleShell>
  )
}
