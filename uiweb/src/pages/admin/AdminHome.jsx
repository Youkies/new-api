import { Link } from 'react-router-dom'
import { ArrowRight, Bell, Bug, Gamepad2, Megaphone, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'

export default function AdminHome() {
  return (
    <ClayAdminShell
      title="运营后台"
      subtitle="用于新 UI 页面运营、公告和后续申诉处理，不影响经典管理端设置。"
    >
      <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-5">
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
          <div className="clay-icon-box !w-12 !h-12 text-clay-blue-300 mb-5">
            <Bell className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">通知管理</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            管理头像红点、通知时间轴和手动运营通知，自动接入公告、充值与申诉状态。
          </p>
          <Link
            to="/admin/notifications"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            管理通知
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 mb-5">
            <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">申诉审核</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            审核用户提交的疑似空回补偿，人工确认后增加余额并写入管理日志。
          </p>
          <Link
            to="/admin/refund-appeals"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            审核申诉
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-green-300 mb-5">
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">页面配置</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            管理 API 地址页等新 UI 高频运营配置，避免为小改动重新发版。
          </p>
          <Link
            to="/admin/page-config"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            配置页面
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 mb-5">
            <Gamepad2 className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">游乐场菜品</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            审核用户投稿菜品，编辑名称、图片和描述后加入公共随机菜品池。
          </p>
          <Link
            to="/admin/playground-foods"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            审核菜品
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 mb-5">
            <Bug className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">调试记录</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            查看调试 Key 捕获的完整请求、返回与错误，并下载脱敏日志文件。
          </p>
          <Link
            to="/admin/debug-traces"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            查看调试
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>

        <ClayCard className="!p-6">
          <div className="clay-icon-box !w-12 !h-12 text-clay-green-300 mb-5">
            <Wallet className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black mb-2">KPay 到账</h2>
          <p className="text-sm text-clay-faint font-semibold leading-relaxed mb-5">
            查看全站 KPay 充值订单，对回调失败/未到账的订单触发一次查单并按真实状态入账。
          </p>
          <Link
            to="/admin/kpay-topups"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-sm font-extrabold text-clay-ink"
          >
            查看充值
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ClayCard>
      </div>
    </ClayAdminShell>
  )
}
