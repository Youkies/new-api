import { Link } from 'react-router-dom'
import { ArrowRight, Megaphone, ShieldCheck, Sparkles } from 'lucide-react'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'

export default function AdminHome() {
  return (
    <ClayAdminShell
      title="运营后台"
      subtitle="用于新 UI 页面运营、公告和后续申诉处理，不影响经典管理端设置。"
    >
      <div className="grid md:grid-cols-3 gap-5">
        <ClayCard className="!p-6 bg-gradient-to-br from-clay-blue-50 to-clay-bg">
          <div className="clay-icon-box !w-12 !h-12 text-clay-blue-300 mb-5">
            <Megaphone className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">公告管理</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            发布强制弹窗公告和历史公告，支持置顶、启用状态和版本确认。
          </p>
          <Link
            to="/admin/announcements"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            管理公告
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 mb-5">
            <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">申诉审核</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed">
            预留给空回补偿、自助申诉和人工审核流程，后续按真实使用场景补齐。
          </p>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-green-300 mb-5">
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">页面配置</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed">
            预留给首页文案、提示语和运营位配置，避免频繁改动经典后台。
          </p>
        </ClayCard>
      </div>
    </ClayAdminShell>
  )
}
