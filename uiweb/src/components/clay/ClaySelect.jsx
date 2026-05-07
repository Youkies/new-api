import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function ClaySelect({
  value,
  options = [],
  onChange,
  placeholder = '请选择',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="clay-input w-full flex items-center justify-between text-left"
      >
        <span className={current ? '' : 'text-clay-faint'}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="clay-scrollbar-none absolute z-30 mt-2 w-full rounded-clay bg-clay-bg shadow-clay p-2 max-h-72 overflow-y-auto">
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                type="button"
                key={String(o.value)}
                onClick={() => {
                  onChange?.(o.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 rounded-clay-sm text-sm transition-all flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay-active'
                    : 'hover:bg-white/40'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-bold truncate">{o.label}</span>
                  {o.subtitle && (
                    <span className="text-xs text-clay-faint truncate">{o.subtitle}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {o.extra && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-clay-faint shadow-sm">
                      {o.extra}
                    </span>
                  )}
                  {active && <Check className="w-4 h-4" strokeWidth={3} />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
