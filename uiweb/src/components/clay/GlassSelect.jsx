import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

// Liquid-glass styled compact select.
// Use inside InputBar chip rows where the small inset-pill ClaySelect feels too heavy.
//
// Variants:
//   "chip"    — compact pill, shown in toolbars
//   "field"   — full-width row, shown in panels (e.g. modal)
//
// Tone (controls color accent when selected/open):
//   "pink" | "purple" | "blue" | "neutral" (default)
export default function GlassSelect({
  value,
  options = [],
  onChange,
  placeholder = '请选择',
  icon = null,
  label = '',
  variant = 'chip',
  tone = 'neutral',
  disabled = false,
  className = '',
  minWidth = 160,
  maxWidth = 260,
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, placeAbove: false })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const selected = options.find((o) => o.value === value)
  const display = selected?.label ?? placeholder

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const desiredWidth = Math.max(r.width, minWidth)
    const winH = window.innerHeight
    const spaceBelow = winH - r.bottom
    const placeAbove = spaceBelow < 240 && r.top > 240
    const top = placeAbove ? r.top - 8 : r.bottom + 8
    let left = r.left
    if (left + desiredWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - desiredWidth - 8)
    }
    setPos({ top, left, width: desiredWidth, placeAbove })
  }, [open, minWidth])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = (e) => {
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toneRing = {
    pink: 'ring-clay-pink-200/70',
    purple: 'ring-clay-purple-200/70',
    blue: 'ring-clay-blue-200/70',
    neutral: 'ring-black/[0.05]',
  }[tone] || 'ring-black/[0.05]'

  const toneText = {
    pink: 'text-clay-pink-ink',
    purple: 'text-[#6b4d83]',
    blue: 'text-[#43658b]',
    neutral: 'text-clay-ink',
  }[tone] || 'text-clay-ink'

  const baseTrigger = 'inline-flex items-center gap-1.5 select-none transition active:scale-95'
  const triggerByVariant = variant === 'field'
    ? `w-full min-h-10 rounded-2xl px-3 py-2 text-[13.5px] font-semibold ${toneText} bg-white/55 border border-white/55 ring-1 ${toneRing} hover:bg-white/75`
    : `min-h-7 rounded-full px-2.5 py-1 text-[12px] font-bold ${open ? 'bg-white/90 ring-2' : 'bg-white/55 ring-1 hover:bg-white/80'} ${open ? toneRing : toneRing} border border-white/60 ${toneText}`

  const disabledClass = disabled ? '!opacity-50 !cursor-not-allowed !pointer-events-none' : ''

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${baseTrigger} ${triggerByVariant} ${disabledClass} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {icon ? <span className="shrink-0 opacity-80">{icon}</span> : null}
        {label ? <span className="shrink-0 text-clay-faint opacity-75">{label}</span> : null}
        <span className="min-w-0 max-w-[180px] truncate text-left font-bold">{display}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 opacity-60 transition ${open ? 'rotate-180' : ''}`} strokeWidth={2.8} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxWidth,
            transform: pos.placeAbove ? 'translateY(-100%)' : 'none',
          }}
          className="fixed z-[9999] max-h-[60vh] overflow-y-auto rounded-2xl border border-white/60 bg-white/85 p-1 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.05] backdrop-blur-2xl"
          role="listbox"
        >
          {options.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs font-bold text-clay-faint">{placeholder}</div>
          ) : (
            options.map((o) => {
              const active = o.value === value
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange?.(o.value); setOpen(false) }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-bold transition ${
                    active
                      ? `${toneText} bg-white/95 ring-1 ${toneRing}`
                      : 'text-clay-ink hover:bg-white/70'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.8} />}
                </button>
              )
            })
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
