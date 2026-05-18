import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Bug, Gamepad2, Megaphone, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'

const ENTRIES = [
  {
    to: '/admin/announcements',
    icon: Megaphone,
    title: '公告管理',
    desc: '发布强制弹窗公告和历史公告，支持置顶、启用状态和版本确认。',
    tone: 'blue',
    cta: '管理公告',
  },
  {
    to: '/admin/notifications',
    icon: Bell,
    title: '通知管理',
    desc: '管理头像红点、通知时间轴和手动运营通知，自动接入公告、充值与申诉状态。',
    tone: 'blue',
    cta: '管理通知',
  },
  {
    to: '/admin/refund-appeals',
    icon: ShieldCheck,
    title: '申诉审核',
    desc: '审核用户提交的疑似空回补偿，人工确认后增加余额并写入管理日志。',
    tone: 'pink',
    cta: '审核申诉',
  },
  {
    to: '/admin/page-config',
    icon: Sparkles,
    title: '页面配置',
    desc: '管理 API 地址页等新 UI 高频运营配置，避免为小改动重新发版。',
    tone: 'green',
    cta: '配置页面',
  },
  {
    to: '/admin/playground-foods',
    icon: Gamepad2,
    title: '游乐场菜品',
    desc: '审核用户投稿菜品，编辑名称、图片和描述后加入公共随机菜品池。',
    tone: 'pink',
    cta: '审核菜品',
  },
  {
    to: '/admin/debug-traces',
    icon: Bug,
    title: '调试记录',
    desc: '查看调试 Key 捕获的完整请求、返回与错误，并下载脱敏日志文件。',
    tone: 'purple',
    cta: '查看调试',
  },
  {
    to: '/admin/kpay-topups',
    icon: Wallet,
    title: 'KPay 到账',
    desc: '查看全站 KPay 充值订单，对回调失败/未到账的订单触发一次查单并按真实状态入账。',
    tone: 'green',
    cta: '查看充值',
  },
]

const ICON_BG = {
  blue: 'bg-clay-blue-100 text-clay-blue-ink',
  pink: 'bg-clay-pink-100 text-clay-pink-ink',
  green: 'bg-clay-green-100 text-clay-green-ink',
  purple: 'bg-clay-purple-100 text-clay-purple-ink',
  yellow: 'bg-clay-yellow-100 text-clay-yellow-ink',
}

export default function AdminHome() {
  return (
    <ClayAdminShell
      title="运营后台"
      subtitle="用于新 UI 页面运营、公告和后续申诉处理，不影响经典管理端设置。"
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {ENTRIES.map((e) => {
          const Icon = e.icon
          return (
            <ClayCard
              key={e.to}
              interactive
              density="cozy"
              className="flex flex-col"
            >
              <div className={`w-12 h-12 rounded-full shadow-clay-sm flex items-center justify-center mb-5 ${ICON_BG[e.tone] || ICON_BG.blue}`}>
                <Icon className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black mb-2 tracking-tight">{e.title}</h2>
              <p className="text-sm text-clay-faint font-bold leading-relaxed mb-5 flex-1">
                {e.desc}
              </p>
              <ClayButton as={Link} to={e.to} variant="ghost" size="sm" className="self-start">
                {e.cta}
                <ArrowRight className="w-4 h-4" />
              </ClayButton>
            </ClayCard>
          )
        })}
      </div>
    </ClayAdminShell>
  )
}
