import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export default function ClaySelect({
  value,
  options = [],
  onChange,
  placeholder = '请选择',
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // Reposition the portal panel each time it opens, anchored to the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: r.left, width: r.width })
  }, [open])

  // Close on outside click. Because the panel is portalled to body, we must
  // explicitly allow clicks inside the panel; otherwise outside-click would
  // include the panel itself.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // Close when an ancestor (page / modal body) scrolls — the portal stays
    // fixed and would float away from the trigger. But DON'T close when the
    // panel itself scrolls (e.g. user spinning the wheel inside the option
    // list on mobile or desktop); that's exactly the gesture we want to keep
    // working.
    const onScroll = (e) => {
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', () => setOpen(false))
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', () => setOpen(false))
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`clay-input w-full flex items-center justify-between text-left ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={current ? '' : 'text-clay-faint'}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 10000,
          }}
          className="clay-scrollbar-none rounded-clay bg-clay-bg shadow-clay p-2 max-h-72 overflow-y-auto"
        >
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
                    ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-active'
                    : 'hover:bg-white/40 hover:shadow-clay-xs'
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-clay-faint shadow-clay-xs">
                      {o.extra}
                    </span>
                  )}
                  {active && <Check className="w-4 h-4" strokeWidth={3} />}
                </div>
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
