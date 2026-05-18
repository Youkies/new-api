import { Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

const TONE = {
  info: { icon: Info, bg: 'bg-clay-blue-50', ink: 'text-clay-blue-ink' },
  warning: { icon: AlertTriangle, bg: 'bg-clay-yellow-100', ink: 'text-clay-yellow-ink' },
  error: { icon: XCircle, bg: 'bg-clay-pink-100', ink: 'text-clay-pink-ink' },
  success: { icon: CheckCircle2, bg: 'bg-clay-green-100', ink: 'text-clay-green-ink' },
}

export default function ClayAlert({ tone = 'info', title, children, className = '' }) {
  const t = TONE[tone] ?? TONE.info
  const Icon = t.icon
  return (
    <div className={`${t.bg} ${t.ink} rounded-clay-lg p-4 shadow-clay-sm flex gap-3 ${className}`}>
      <span className="w-8 h-8 rounded-full bg-clay-surface/70 shrink-0 flex items-center justify-center shadow-clay-xs">
        <Icon className="w-4 h-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 self-center">
        {title && <div className="font-extrabold leading-tight">{title}</div>}
        {children && <div className={`text-sm ${title ? 'mt-1' : ''}`}>{children}</div>}
      </div>
    </div>
  )
}
