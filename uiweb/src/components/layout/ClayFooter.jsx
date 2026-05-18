import { Link } from 'react-router-dom'

export default function ClayFooter() {
  return (
    <footer className="mt-20 pb-8">
      <div className="mx-auto inline-flex items-center gap-1 px-2 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm flex-wrap justify-center">
        <Link
          to="/user-agreement"
          className="px-4 py-1.5 rounded-clay-pill text-xs font-extrabold text-clay-faint hover:text-clay-ink hover:shadow-clay-xs transition-all"
        >
          用户协议
        </Link>
        <Link
          to="/privacy-policy"
          className="px-4 py-1.5 rounded-clay-pill text-xs font-extrabold text-clay-faint hover:text-clay-ink hover:shadow-clay-xs transition-all"
        >
          隐私政策
        </Link>
        <Link
          to="/about"
          className="px-4 py-1.5 rounded-clay-pill text-xs font-extrabold text-clay-faint hover:text-clay-ink hover:shadow-clay-xs transition-all"
        >
          关于
        </Link>
      </div>
      <p className="mt-5 text-center text-clay-faint text-xs font-bold">&copy; 2026 Youkies API · Clay Edition</p>
    </footer>
  )
}
