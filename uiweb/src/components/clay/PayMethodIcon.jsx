import { CreditCard } from 'lucide-react'

// SimpleIcons paths (CC0). Inlined to avoid extra network requests in QR / scan modals.
const ALIPAY_PATH = 'M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809'
const WECHAT_PATH = 'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z'

/**
 * Clay 风格双层支付方式图标（外圈中性 clay 渐变 + 内圈品牌色 + 中心白色 logo）。
 *
 * 与「参考html/clay-pay-icons-mock.html」变体 4 对齐，是充值页与活动页统一使用的
 * 支付方式视觉。type 接受 'alipay' / 'wxpay' / 'wechat' / 'kpay_alipay' / 'kpay_wechat'。
 *
 * className 通过 Tailwind w/h utility 控制外径尺寸；内部 SVG 自适应。
 */
export default function PayMethodIcon({ type, className = 'w-7 h-7' }) {
  const isAlipay = type === 'alipay' || type === 'kpay_alipay'
  const isWechat = type === 'wxpay' || type === 'wechat' || type === 'kpay_wechat'
  if (!isAlipay && !isWechat) return <CreditCard className={className} />

  const brand = isAlipay ? '#1677FF' : '#07C160'
  const path = isAlipay ? ALIPAY_PATH : WECHAT_PATH
  const label = isAlipay ? '支付宝' : '微信支付'
  const gradId = `clay-grad-${isAlipay ? 'a' : 'w'}-${Math.random().toString(36).slice(2, 8)}`
  return (
    <span
      role="img"
      aria-label={label}
      className={`${className} inline-block rounded-full shadow-clay-sm overflow-hidden align-middle`}
    >
      <svg viewBox="0 0 24 24" className="block w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f3f6fb" />
            <stop offset="100%" stopColor="#d9e2ed" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="12" fill={`url(#${gradId})`} />
        <circle cx="12" cy="12" r="9.4" fill={brand} />
        <g transform={`translate(${12 - 12 * 0.55} ${12 - 12 * 0.55}) scale(0.55)`}>
          <path d={path} fill="#ffffff" />
        </g>
      </svg>
    </span>
  )
}
