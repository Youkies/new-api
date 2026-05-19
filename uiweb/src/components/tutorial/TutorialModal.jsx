import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, BookOpen, ArrowRight } from 'lucide-react'
import { tutorials, getTutorial } from './registry.js'

/**
 * Renders an in-app tutorial walkthrough.
 *
 * Modes:
 *   - `tour="archive-create"` → directly play that single tour
 *   - `tours={['archive-create', 'archive-import']}` → show a picker first, then play
 *
 * Image source: `/tutorials/<feature>/<step>.jpg` (served from uiweb/public).
 *
 * The modal is intentionally Clay-styled but inlined (not via ClayModal)
 * because the image carousel needs full-bleed treatment that the default
 * card padding fights against.
 */
export default function TutorialModal({ open, onClose, tour, tours }) {
  const tourList = Array.isArray(tours) && tours.length > 0 ? tours : (tour ? [tour] : [])
  const [activeId, setActiveId] = useState(tourList.length === 1 ? tourList[0] : null)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (!open) return
    setActiveId(tourList.length === 1 ? tourList[0] : null)
    setStepIdx(0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (!activeId) return
      const total = getTutorial(activeId)?.steps?.length ?? 0
      if (e.key === 'ArrowRight') setStepIdx((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setStepIdx((i) => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, activeId, onClose])

  if (!open) return null

  const active = activeId ? getTutorial(activeId) : null
  const totalSteps = active?.steps?.length ?? 0
  const step = active?.steps?.[stepIdx]
  const isFirst = stepIdx === 0
  const isLast = stepIdx === totalSteps - 1

  const openTour = (id) => {
    setActiveId(id)
    setStepIdx(0)
  }
  const backToPicker = () => {
    if (tourList.length > 1) {
      setActiveId(null)
      setStepIdx(0)
    } else {
      onClose?.()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-clay-bg/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="clay-card clay-scrollbar-none relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-white rounded-clay-lg shadow-clay p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-clay-purple-100 shadow-clay-sm flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-clay-purple-ink" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl sm:text-2xl font-black tracking-tight truncate">
                {active ? active.title : '新手指引'}
              </h3>
              {active?.subtitle && (
                <p className="text-xs text-clay-faint font-bold mt-0.5 truncate">{active.subtitle}</p>
              )}
              {!active && (
                <p className="text-xs text-clay-faint font-bold mt-0.5">选一个流程开始</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-clay-bg shadow-clay flex items-center justify-center hover:shadow-clay-hover transition-shadow flex-shrink-0"
            aria-label="关闭"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Picker mode */}
        {!active && (
          <div className="flex flex-col gap-3">
            {tourList.map((id) => {
              const t = getTutorial(id)
              if (!t) return null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openTour(id)}
                  className="flex items-center gap-3 p-4 rounded-clay-lg bg-clay-bg shadow-clay-sm hover:shadow-clay transition-shadow text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-base text-clay-ink">{t.title}</div>
                    {t.subtitle && (
                      <div className="text-xs text-clay-faint font-bold mt-0.5">{t.subtitle}</div>
                    )}
                    <div className="text-[11px] text-clay-faint mt-1">{t.steps.length} 步</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-clay-faint flex-shrink-0" strokeWidth={2.5} />
                </button>
              )
            })}
          </div>
        )}

        {/* Tour mode */}
        {active && step && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-black text-clay-faint">
                第 <span className="text-clay-ink">{stepIdx + 1}</span> / {totalSteps} 步
              </div>
              <div className="flex items-center gap-1">
                {active.steps.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stepIdx ? 'w-6 bg-clay-purple-ink' : 'w-1.5 bg-clay-bg shadow-clay-inset-sm'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-clay-lg overflow-hidden shadow-clay-inset bg-clay-bg flex items-center justify-center">
              <img
                src={step.image}
                alt={step.caption}
                className="w-full max-h-[55vh] object-contain"
                decoding="async"
              />
            </div>

            <p className="text-sm sm:text-base text-clay-ink leading-relaxed font-bold px-1">
              {step.caption}
            </p>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => (isFirst ? backToPicker() : setStepIdx((i) => i - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-clay-pill bg-clay-bg shadow-clay-sm hover:shadow-clay text-clay-ink font-black text-sm transition-shadow"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                {isFirst ? (tourList.length > 1 ? '返回列表' : '关闭') : '上一步'}
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-clay-pill bg-clay-purple-100 text-clay-purple-ink shadow-clay hover:shadow-clay-hover font-black text-sm transition-shadow"
                >
                  完成
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => i + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-clay-pill bg-clay-purple-100 text-clay-purple-ink shadow-clay hover:shadow-clay-hover font-black text-sm transition-shadow"
                >
                  下一步
                  <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Re-export so callers can also enumerate available tours if needed.
export { tutorials }
