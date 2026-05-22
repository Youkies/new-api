import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'

export default function PlaygroundShell({ tab, actions, children, footer }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e9eef6] via-[#f1ecf5] to-[#fde9ef]">
      <header
        className="fixed top-0 left-0 right-0 z-30 border-b border-white/45 bg-white/55 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] backdrop-blur-2xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link
            to="/playground"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/60 text-clay-ink ring-1 ring-black/[0.04] transition hover:bg-white/85 active:scale-95"
            aria-label="返回游乐场"
            title="返回"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.8} />
          </Link>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Sparkles className="h-4 w-4 text-clay-pink-300" strokeWidth={2.8} />
            <span className="text-sm font-black text-clay-ink">游乐场</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-white/55 bg-white/45 p-0.5 ring-1 ring-black/[0.04] backdrop-blur sm:ml-2">
            <TabLink to="/playground/chat" label="对话" icon={MessageSquare} active={tab === 'chat'} tone="pink" />
            <TabLink to="/playground/image" label="生图" icon={ImageIcon} active={tab === 'image'} tone="purple" />
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">{actions}</div>
        </div>
      </header>

      <div className="h-14" />

      <main className="mx-auto w-full max-w-4xl px-3 pb-44 sm:px-6 sm:pb-48">
        {children}
      </main>

      {footer}
    </div>
  )
}

function TabLink({ to, label, icon: Icon, active, tone }) {
  const activeClass = tone === 'pink'
    ? 'bg-white/95 text-clay-pink-ink shadow-[0_2px_8px_-2px_rgba(255,143,179,0.45)] ring-1 ring-clay-pink-200/60'
    : 'bg-white/95 text-[#6b4d83] shadow-[0_2px_8px_-2px_rgba(180,142,232,0.45)] ring-1 ring-clay-purple-200/60'
  return (
    <Link
      to={to}
      className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-black transition active:scale-95 ${
        active ? activeClass : 'text-clay-faint hover:bg-white/55 hover:text-clay-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.8} />
      {label}
    </Link>
  )
}
