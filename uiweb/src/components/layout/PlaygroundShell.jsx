import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react'

export default function PlaygroundShell({ tab, actions, children, footer }) {
  return (
    <div className="min-h-screen bg-clay-bg">
      <header
        className="fixed top-0 left-0 right-0 z-30 border-b border-white/40 bg-clay-bg/85 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Link
            to="/playground"
            className="clay-icon-btn shrink-0"
            aria-label="返回游乐场"
            title="返回"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.8} />
          </Link>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Sparkles className="h-4 w-4 text-clay-pink-300" strokeWidth={2.8} />
            <span className="text-sm font-black text-clay-ink">游乐场</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-clay-pill bg-clay-bg p-0.5 shadow-clay-inset-sm sm:ml-2">
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
    ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
    : 'bg-clay-purple-100 text-[#6b4d83] shadow-clay-sm'
  return (
    <Link
      to={to}
      className={`inline-flex h-7 items-center gap-1 rounded-clay-pill px-2.5 text-[12.5px] font-black transition active:scale-95 ${
        active ? activeClass : 'text-clay-faint hover:text-clay-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.8} />
      {label}
    </Link>
  )
}
