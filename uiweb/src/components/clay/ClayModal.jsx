import { useEffect } from 'react'
import { X } from 'lucide-react'
import ClayCard from './ClayCard.jsx'

export default function ClayModal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null

  const sizeCls = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size] ?? 'max-w-md'

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-clay-bg/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <ClayCard className={`relative w-full ${sizeCls} max-h-[85vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-2xl font-black tracking-tight">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-clay-bg shadow-clay flex items-center justify-center hover:shadow-clay-hover transition-shadow"
              aria-label="关闭"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div>{children}</div>
        {footer && (
          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        )}
      </ClayCard>
    </div>
  )
}
