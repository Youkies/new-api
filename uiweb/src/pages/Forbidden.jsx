import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-clay-bg px-8">
      <ClayCard className="max-w-md text-center items-center">
        <div className="clay-icon-box mb-5 !w-20 !h-20 text-clay-pink-300">
          <ShieldAlert className="w-9 h-9" strokeWidth={2.5} />
        </div>
        <div className="text-6xl font-black mb-3 text-clay-pink-300">403</div>
        <h1 className="text-2xl font-extrabold mb-3">无权访问</h1>
        <p className="text-clay-faint mb-6">
          你当前的账号没有访问此页面的权限。如认为这是误判,请联系管理员。
        </p>
        <Link to="/">
          <ClayButton variant="primary">回首页</ClayButton>
        </Link>
      </ClayCard>
    </div>
  )
}
