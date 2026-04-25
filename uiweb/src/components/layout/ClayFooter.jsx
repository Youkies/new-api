import { Link } from 'react-router-dom'

export default function ClayFooter() {
  return (
    <footer className="mt-20 pb-8 text-center text-clay-faint text-sm">
      <div className="flex flex-wrap justify-center gap-5 mb-4">
        <Link to="/user-agreement" className="hover:text-clay-pink-300 transition-colors">
          用户协议
        </Link>
        <Link to="/privacy-policy" className="hover:text-clay-pink-300 transition-colors">
          隐私政策
        </Link>
        <Link to="/about" className="hover:text-clay-pink-300 transition-colors">
          关于
        </Link>
      </div>
      <p>&copy; 2026 Youkies API · Clay Edition</p>
    </footer>
  )
}
