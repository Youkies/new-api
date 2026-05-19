import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import TutorialModal from './TutorialModal.jsx'

/**
 * A small Clay pill that opens an in-app tutorial.
 *
 * Use `tour="archive-create"` for a single tour, or `tours={[...]}` for a
 * picker. Wrap children to customise the label; default is "指引".
 *
 *   <TutorialButton tour="archive-create" />
 *   <TutorialButton tours={['archive-create', 'archive-import']}>新手指引</TutorialButton>
 */
export default function TutorialButton({ tour, tours, label, children, className = '', variant = 'pill' }) {
  const [open, setOpen] = useState(false)
  const text = children ?? label ?? '指引'

  const base =
    variant === 'icon'
      ? 'w-9 h-9 rounded-full bg-clay-bg shadow-clay-sm hover:shadow-clay flex items-center justify-center text-clay-purple-ink'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-clay-pill bg-clay-bg shadow-clay-sm hover:shadow-clay text-clay-purple-ink font-black text-xs transition-shadow'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${base} ${className}`}
        title="查看教程"
        aria-label="查看教程"
      >
        <HelpCircle className="w-4 h-4" strokeWidth={2.5} />
        {variant !== 'icon' && <span>{text}</span>}
      </button>
      <TutorialModal open={open} onClose={() => setOpen(false)} tour={tour} tours={tours} />
    </>
  )
}
