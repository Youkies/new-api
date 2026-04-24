import { Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

const TONE = {
  info: { icon: Info, bg: 'bg-clay-blue-50', ink: 'text-[#43658b]' },
  warning: { icon: AlertTriangle, bg: 'bg-clay-yellow-100', ink: 'text-[#8a6a32]' },
  error: { icon: XCircle, bg: 'bg-clay-pink-100', ink: 'text-[#8a4860]' },
  success: { icon: CheckCircle2, bg: 'bg-clay-green-100', ink: 'text-[#3d6b4f]' },
}

export default function ClayAlert({ tone = 'info', title, children, className = '' }) {
  const t = TONE[tone] ?? TONE.info
  const Icon = t.icon
  return (
    <div className={`${t.bg} ${t.ink} rounded-clay-lg p-4 shadow-clay flex gap-3 ${className}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" strokeWidth={2.5} />
      <div className="min-w-0">
        {title && <div className="font-extrabold mb-1">{title}</div>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  )
}
