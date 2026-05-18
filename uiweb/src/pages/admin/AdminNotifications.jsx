import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayToggle from '../../components/clay/ClayToggle.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  adminGetNotificationSettings,
  adminSaveNotificationSettings,
} from '../../services/notifications.js'

const defaultSettings = {
  billing_enabled: true,
  billing_require_ack: false,
  appeal_submitted_enabled: true,
  appeal_submitted_require_ack: false,
  appeal_approved_enabled: true,
  appeal_approved_require_ack: false,
  appeal_rejected_enabled: true,
  appeal_rejected_require_ack: false,
}

const notificationRules = [
  {
    key: 'billing',
    title: '充值到账',
    desc: '兑换码、在线支付和管理员补单成功后通知用户。',
    icon: CircleDollarSign,
    tone: 'green',
    enabledKey: 'billing_enabled',
    ackKey: 'billing_require_ack',
  },
  {
    key: 'appeal_submitted',
    title: '申诉已提交',
    desc: '用户提交空回补偿申诉后写入通知中心。',
    icon: ShieldCheck,
    tone: 'blue',
    enabledKey: 'appeal_submitted_enabled',
    ackKey: 'appeal_submitted_require_ack',
  },
  {
    key: 'appeal_approved',
    title: '申诉通过',
    desc: '管理员通过申诉并补偿余额后通知用户。',
    icon: CheckCircle2,
    tone: 'green',
    enabledKey: 'appeal_approved_enabled',
    ackKey: 'appeal_approved_require_ack',
  },
  {
    key: 'appeal_rejected',
    title: '申诉驳回',
    desc: '管理员驳回申诉后把审核说明通知给用户。',
    icon: Bell,
    tone: 'yellow',
    enabledKey: 'appeal_rejected_enabled',
    ackKey: 'appeal_rejected_require_ack',
  },
]

function getData(res) {
  return res?.data?.data ?? res?.data ?? null
}

export default function AdminNotifications() {
  const toast = useToast()
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminGetNotificationSettings()
      if (res?.success === false) throw new Error(res.message || '通知设置加载失败')
      setSettings({ ...defaultSettings, ...(getData(res) || {}) })
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '通知设置加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => {
    const enabled = notificationRules.filter((rule) => settings[rule.enabledKey]).length
    const ack = notificationRules.filter((rule) => settings[rule.enabledKey] && settings[rule.ackKey]).length
    return { total: notificationRules.length, enabled, ack }
  }, [settings])

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const saveSettings = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await adminSaveNotificationSettings(settings)
      if (res?.success === false) throw new Error(res.message || '通知设置保存失败')
      setSettings({ ...defaultSettings, ...(getData(res) || {}) })
      toast('通知设置已保存', 'success')
    } catch (err) {
      const message = err?.response?.data?.message || err.message || '通知设置保存失败'
      setError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchData} disabled={loading || saving} className="!px-5">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        刷新
      </ClayButton>
      <ClayButton variant="primary" onClick={saveSettings} disabled={loading || saving} className="!px-5">
        <Save className="w-4 h-4" />
        {saving ? '保存中' : '保存设置'}
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="通知设置"
      subtitle="配置系统事件是否自动写入用户通知中心，以及是否必须点击确认。"
      actions={actions}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="自动通知项" value={stats.total} tone="blue" />
        <Stat label="已启用" value={stats.enabled} tone="green" />
        <Stat label="需确认" value={stats.ack} tone="yellow" />
      </div>

      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-semibold">加载通知设置中…</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {notificationRules.map((rule) => (
            <NotificationRuleCard
              key={rule.key}
              rule={rule}
              settings={settings}
              onChange={updateSetting}
            />
          ))}

          <ClayCard className="!p-6 lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 shrink-0">
                  <Megaphone className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl font-black mb-1">公告通知</h2>
                  <p className="text-sm font-semibold text-clay-faint leading-relaxed">
                    公告的通知送达、强制确认和弹窗由公告本身决定。
                  </p>
                </div>
              </div>
              <ClayButton as={Link} to="/admin/announcements" variant="secondary" className="!px-5">
                <Megaphone className="w-4 h-4" />
                去公告设置
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      )}
    </ClayAdminShell>
  )
}

function NotificationRuleCard({ rule, settings, onChange }) {
  const Icon = rule.icon
  const enabled = Boolean(settings[rule.enabledKey])
  const requireAck = Boolean(settings[rule.ackKey])
  const toneCls = {
    blue: 'text-clay-blue-300',
    green: 'text-clay-green-300',
    yellow: 'text-clay-yellow-300',
  }[rule.tone]

  return (
    <ClayCard className="!p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`clay-icon-box !w-12 !h-12 ${toneCls} shrink-0`}>
            <Icon className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black mb-1">{rule.title}</h2>
            <p className="text-sm font-semibold text-clay-faint leading-relaxed">{rule.desc}</p>
          </div>
        </div>
        <StatusPill enabled={enabled} requireAck={requireAck} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <ToggleCell
          label="自动通知"
          checked={enabled}
          onChange={(value) => onChange(rule.enabledKey, value)}
        />
        <ToggleCell
          label="要求确认"
          checked={requireAck}
          disabled={!enabled}
          onChange={(value) => onChange(rule.ackKey, value)}
        />
      </div>
    </ClayCard>
  )
}

function StatusPill({ enabled, requireAck }) {
  if (!enabled) {
    return (
      <span className="shrink-0 px-3 py-1 rounded-clay-pill text-xs font-black bg-white/60 text-clay-faint">
        关闭
      </span>
    )
  }
  return (
    <span className={`shrink-0 px-3 py-1 rounded-clay-pill text-xs font-black shadow-clay-sm ${requireAck ? 'bg-clay-yellow-100 text-clay-yellow-ink' : 'bg-clay-green-100 text-clay-green-ink'}`}>
      {requireAck ? '需确认' : '仅未读'}
    </span>
  )
}

function ToggleCell({ label, checked, disabled = false, onChange }) {
  return (
    <div className={`rounded-clay bg-white/45 shadow-clay-inset p-4 flex items-center justify-between gap-3 ${disabled ? 'opacity-55' : ''}`}>
      <span className="font-extrabold text-sm">{label}</span>
      <ClayToggle checked={checked} onChange={disabled ? undefined : onChange} />
    </div>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-clay-blue-ink',
    green: 'text-clay-green-ink',
    yellow: 'text-clay-yellow-ink',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}
