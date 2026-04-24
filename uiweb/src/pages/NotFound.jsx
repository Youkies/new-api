import { Link } from 'react-router-dom'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-clay-bg px-8">
      <ClayCard className="max-w-md text-center">
        <div className="text-7xl font-black mb-4 text-clay-pink-300">404</div>
        <p className="text-clay-faint mb-6">这个页面还没被捏出来。</p>
        <Link to="/">
          <ClayButton variant="primary">回首页</ClayButton>
        </Link>
      </ClayCard>
    </div>
  )
}
