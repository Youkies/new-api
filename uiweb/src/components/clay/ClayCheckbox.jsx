import { Check } from 'lucide-react'

export default function ClayCheckbox({ checked = false, onChange, label, className = '', disabled = false }) {
  return (
    <label
      className={`inline-flex items-center gap-3 select-none ${
        disabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
      } ${className}`}
    >
      <span
        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ease-clay ${
          checked
            ? 'bg-clay-pink-200 shadow-clay-active text-white'
            : 'bg-clay-bg shadow-clay-sm text-transparent'
        }`}
      >
        <Check className="w-4 h-4" strokeWidth={3} />
      </span>
      {label && <span className="font-bold text-sm text-clay-ink">{label}</span>}
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  )
}
