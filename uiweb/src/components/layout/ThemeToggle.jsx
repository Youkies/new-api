import { Moon, Monitor, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'

const META = {
  light: { label: '浅色模式', next: '深色模式', icon: Sun },
  dark: { label: '深色模式', next: '跟随系统', icon: Moon },
  system: { label: '跟随系统', next: '浅色模式', icon: Monitor },
}

export default function ThemeToggle({ className = '' }) {
  const { mode, resolvedTheme, cycleMode } = useTheme()
  const meta = META[mode] ?? META.system
  const Icon = meta.icon
  const nextLabel = mode === 'system'
    ? (resolvedTheme === 'dark' ? '浅色模式' : '深色模式')
    : meta.next

  return (
    <button
      type="button"
      onClick={cycleMode}
      title={`${meta.label}，点击切换到${nextLabel}`}
      aria-label={`${meta.label}，点击切换主题`}
      className={`w-10 h-10 rounded-full bg-clay-bg shadow-clay hover:shadow-clay-hover active:shadow-clay-active transition-all duration-200 ease-clay flex items-center justify-center text-clay-faint hover:text-clay-ink ${className}`}
    >
      <Icon className="w-4 h-4" strokeWidth={2.5} />
      <span className="sr-only">{resolvedTheme === 'dark' ? '深色' : '浅色'}</span>
    </button>
  )
}
