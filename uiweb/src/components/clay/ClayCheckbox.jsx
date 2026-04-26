import { Check } from 'lucide-react'

export default function ClayCheckbox({ checked = false, onChange, label, className = '' }) {
  return (
    <label className={`inline-flex items-center gap-3 cursor-pointer select-none ${className}`}>
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
          checked
            ? 'bg-clay-pink-200 shadow-clay-active text-white'
            : 'bg-clay-bg shadow-clay text-transparent'
        }`}
      >
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
      {label && <span className="font-semibold text-sm text-clay-ink">{label}</span>}
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange?.(e.target.checked)} />
    </label>
  )
}
