import { Sparkles, CheckCircle2, Clock } from 'lucide-react'
import ClayCard from '../clay/ClayCard.jsx'

/**
 * 端午节专属活动布局 (layout_variant === 'dragon_boat')
 *
 * 对外暴露：
 *  - DragonBoatHero        — Hero 头图区（漂浮粽子/龙舟 emoji + 金绿渐变标题 + 倒计时）
 *  - DragonBoatSkuCard     — 单张 SKU 卡，配色按 colorIndex 在艾草绿/金黄之间循环
 *  - DRAGON_BOAT_COLORS    — SKU 颜色循环顺序
 *
 * 设计语言：艾草绿主色 + 金黄点缀；漂浮装饰是粽子/龙舟/艾叶/卷轴。
 * 与 Kids61 结构对齐，便于后续节日活动按同一套模板拓展。
 */

// 6 档颜色循环顺序：艾草绿为基调，黄色穿插制造节奏
export const DRAGON_BOAT_COLORS = ['green', 'yellow', 'green', 'yellow', 'green', 'yellow']

// 静态字符串 map — 完整类名必须出现在此文件中供 Tailwind JIT 扫描
const C = {
  green: {
    cardBg:   'from-clay-green-300/20 to-clay-green-300/10',
    ring:     'ring-clay-green-300',
    selChip:  'bg-clay-green-100 text-clay-green-ink',
    inkText:  'text-clay-green-ink',
    bar:      'bg-clay-green-300',
    cdBg:     'bg-clay-green-100 text-clay-green-ink',
  },
  yellow: {
    cardBg:   'from-clay-yellow-300/20 to-clay-yellow-300/10',
    ring:     'ring-clay-yellow-300',
    selChip:  'bg-clay-yellow-100 text-clay-yellow-ink',
    inkText:  'text-clay-yellow-ink',
    bar:      'bg-clay-yellow-300',
    cdBg:     'bg-clay-yellow-100 text-clay-yellow-ink',
  },
}

// 漂浮装饰 emoji — 端午意象：粽子、龙舟、艾草、卷轴、稻穗、蛋
const FLOAT_DECO = [
  { emoji: '🎋', anim: 'animate-float-a', pos: 'top-3 left-[8%]',     size: 'text-3xl sm:text-4xl' },
  { emoji: '🐉', anim: 'animate-float-b', pos: 'top-2 right-[12%]',   size: 'text-2xl sm:text-3xl' },
  { emoji: '🍃', anim: 'animate-float-c', pos: 'bottom-4 left-[18%]', size: 'text-2xl sm:text-3xl' },
  { emoji: '📜', anim: 'animate-float-d', pos: 'bottom-3 right-[8%]', size: 'text-3xl sm:text-4xl' },
  { emoji: '🥚', anim: 'animate-float-e', pos: 'top-4 left-[42%]',    size: 'text-xl sm:text-2xl'  },
  { emoji: '🌾', anim: 'animate-float-f', pos: 'bottom-6 right-[30%]',size: 'text-xl sm:text-2xl'  },
]

/**
 * 金绿渐变标题：艾草绿到金黄的横向渐变 + 字间距加重，制造书法/牌匾感。
 * 用 bg-clip-text 实现，亮/暗模式都能保持对比度。
 */
function FestivalTitle({ text }) {
  return (
    <span
      className="font-black tracking-tight bg-clip-text text-transparent"
      style={{
        backgroundImage: 'linear-gradient(135deg, #15803d 0%, #65a30d 35%, #ca8a04 70%, #b45309 100%)',
      }}
    >
      {text}
    </span>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

export function DragonBoatHero({ campaign, countdown }) {
  const ended   = countdown?.ended
  const inactive = !campaign.active

  return (
    <ClayCard className="relative overflow-hidden mb-6 bg-clay-bg bg-gradient-to-br from-clay-green-300/20 via-transparent to-clay-yellow-300/20">
      {/* 漂浮装饰层 */}
      <div className="pointer-events-none select-none" aria-hidden>
        {FLOAT_DECO.map((d, i) => (
          <span
            key={i}
            className={`absolute ${d.pos} ${d.size} ${d.anim} opacity-80`}
            style={{ willChange: 'transform' }}
          >
            {d.emoji}
          </span>
        ))}
      </div>

      {/* 内容区 */}
      <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 py-6 px-4 sm:py-8 sm:px-6 text-center sm:text-left">

        {/* 标题 + 副标题 + Claude 署名 */}
        <div className="flex-1 min-w-0 w-full">
          <h1 className="text-3xl sm:text-4xl leading-tight tracking-tight">
            <FestivalTitle text={campaign.title || '端午安康'} />
          </h1>
          {campaign.subtitle && (
            <p className="mt-2 text-sm sm:text-sm text-clay-faint italic leading-relaxed line-clamp-2 tracking-wide">
              {campaign.subtitle}
            </p>
          )}
          {/* Claude 吉祥物署名行 */}
          <div className="inline-flex items-center gap-2 mt-3">
            <img
              src="/claude-sprite.gif"
              alt="Claude"
              className="w-9 h-9 object-contain flex-shrink-0"
              loading="lazy"
            />
            <span className="text-[11px] text-clay-faint font-bold">— 来自 Claude，江上吹来的折扣</span>
          </div>
        </div>

        {/* 倒计时 / 状态 */}
        <div className="flex-shrink-0">
          {ended ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-sm font-black text-clay-faint">
              活动已结束
            </span>
          ) : inactive ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill bg-clay-yellow-100 shadow-clay-sm text-sm font-black text-clay-yellow-ink">
              即将开始
            </span>
          ) : (
            <DragonBoatCountdown countdown={countdown} />
          )}
        </div>
      </div>

      {/* 底部金绿装饰线（艾草到金箔的过渡） */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #15803d, #65a30d, #ca8a04, #b45309)' }}
        aria-hidden
      />
    </ClayCard>
  )
}

// 倒计时：绿/金/绿/金 交替的方块，呼应主色调
const CD_COLORS = [C.green.cdBg, C.yellow.cdBg, C.green.cdBg, C.yellow.cdBg]

function DragonBoatCountdown({ countdown }) {
  const blocks = [
    countdown.d > 0 ? { val: String(countdown.d), label: '天' } : null,
    { val: String(countdown.h).padStart(2, '0'), label: '时' },
    { val: String(countdown.m).padStart(2, '0'), label: '分' },
    { val: String(countdown.s).padStart(2, '0'), label: '秒' },
  ].filter(Boolean)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-end gap-1.5">
        <Clock className="w-3.5 h-3.5 text-clay-faint mb-1.5" strokeWidth={2.5} />
        <div className="flex items-end gap-1">
          {blocks.map((b, i) => (
            <div key={b.label} className="flex flex-col items-center gap-0.5">
              <span className={`inline-block min-w-[2rem] text-center px-1.5 py-1 rounded-clay-sm shadow-clay-sm text-base sm:text-lg font-black tabular-nums ${CD_COLORS[i % CD_COLORS.length]}`}>
                {b.val}
              </span>
              <span className="text-[9px] font-bold text-clay-faint">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="text-[10px] text-clay-faint font-bold">后结束</span>
    </div>
  )
}

// ─── SKU 卡 ──────────────────────────────────────────────────────────────────

export function DragonBoatSkuCard({ sku, colorIndex, currencySymbol, selected, disabled, onSelect }) {
  const c = C[DRAGON_BOAT_COLORS[colorIndex % DRAGON_BOAT_COLORS.length]]

  const isPurchasable = sku.state === 'purchasable'
  const isSoldOut    = sku.state === 'sold_out'
  const isUserLimit  = sku.state === 'user_limit'
  const isInactive   = sku.state === 'activity_closed'
  const interactive  = isPurchasable && !disabled

  const stateLabel = isSoldOut ? '已抢完' : isUserLimit ? `已购满 ${sku.user_bought_n} 次` : isInactive ? '活动未开放' : null

  const savings = sku.delivered_yuan - sku.price_yuan
  const zhe = sku.delivered_yuan > 0
    ? (10 * sku.price_yuan / sku.delivered_yuan).toFixed(1) : null

  const progressPct = sku.total_limit > 0
    ? Math.min(100, Math.round((sku.sold_count / sku.total_limit) * 100)) : 0

  // 限量特惠：有总量限制 + 每人只能买1次 → 芦苇香闪购档
  const isSpecial = sku.total_limit > 0 && sku.per_user_limit === 1

  const ringClass = selected
    ? `ring-2 ${c.ring}`
    : isSpecial
      ? 'ring-2 ring-clay-green-300'
      : sku.highlight
        ? 'ring-2 ring-clay-yellow-300'
        : ''

  return (
    <button
      type="button"
      onClick={interactive ? onSelect : undefined}
      disabled={!interactive}
      className={`
        relative text-left p-4 sm:p-5 rounded-clay-lg
        bg-clay-bg bg-gradient-to-br ${c.cardBg} via-transparent
        ${selected ? 'shadow-clay-inset' : 'shadow-clay-sm hover:shadow-clay'}
        ${ringClass}
        ${!interactive ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}
        transition-shadow
      `}
    >
      {/* 移动端：左右横排（emoji+标题 左，金额 右）；桌面：竖排 */}
      <div className="flex sm:block items-center gap-3 mb-3 sm:mb-0">

        {/* 左：emoji + 标题 + 副标题 */}
        <div className="flex items-start gap-2.5 flex-1 min-w-0 sm:mb-3">
          <span className="text-3xl sm:text-4xl select-none flex-shrink-0 leading-none">{sku.emoji || '🍱'}</span>
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-black text-clay-ink leading-tight">{sku.label}</div>
            {sku.subtitle && (
              <div className="text-[11px] text-clay-faint font-bold mt-0.5">{sku.subtitle}</div>
            )}
            {/* 移动端：badge 跟在副标题下 */}
            <div className="mt-1.5 sm:hidden">
              {selected ? (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill shadow-clay-sm text-[10px] font-black ${c.selChip}`}>
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2.6} />已选
                </span>
              ) : isSpecial ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-green-100 text-clay-green-ink shadow-clay-sm text-[10px] font-black">
                  🎋 限量闪购
                </span>
              ) : sku.highlight ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm text-[10px] font-black">
                  <Sparkles className="w-3 h-3" strokeWidth={2.6} />主推
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 右：移动端金额横排；桌面端隐藏（下方独立渲染） */}
        <div className="flex-shrink-0 text-right sm:hidden">
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mb-0.5">到 账</div>
          <div className={`text-3xl font-black tabular-nums leading-none ${c.inkText}`}>
            {currencySymbol}{skuDelivered(sku)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mt-1.5 mb-0.5">付 款</div>
          <div className="text-sm font-black tabular-nums text-clay-ink leading-none">
            {currencySymbol}{skuPrice(sku)}
          </div>
        </div>

        {/* 桌面端 badge（右上角） */}
        <div className="hidden sm:block sm:mb-3">
          <div className="flex items-start gap-2.5">
            <div className="flex-1" />
            {selected ? (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill shadow-clay-sm text-[10px] font-black flex-shrink-0 ${c.selChip}`}>
                <CheckCircle2 className="w-3 h-3" strokeWidth={2.6} />已选
              </span>
            ) : isSpecial ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-green-100 text-clay-green-ink shadow-clay-sm text-[10px] font-black flex-shrink-0">
                🎋 限量闪购
              </span>
            ) : sku.highlight ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill bg-clay-yellow-100 text-clay-yellow-ink shadow-clay-sm text-[10px] font-black flex-shrink-0">
                <Sparkles className="w-3 h-3" strokeWidth={2.6} />主推
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 桌面端金额 hero（移动端已在右侧显示，这里隐藏） */}
      <div className="hidden sm:flex items-end justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mb-0.5">到 账</div>
          <div className={`text-4xl font-black tabular-nums leading-none ${c.inkText}`}>
            {currencySymbol}{skuDelivered(sku)}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-clay-faint font-black mb-0.5">付 款</div>
          <div className="text-base font-black tabular-nums text-clay-ink leading-none">
            {currencySymbol}{skuPrice(sku)}
          </div>
        </div>
      </div>

      {/* 省钱 chip */}
      {savings > 0.005 && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-[11px] font-black text-clay-green-ink mb-3">
          <Sparkles className="w-3 h-3" strokeWidth={2.6} />
          省 {currencySymbol}{fmtAmount(savings)}{zhe && ` · ${zhe} 折`}
        </div>
      )}

      {/* 销量进度（特惠档） */}
      {sku.total_limit > 0 && (
        <div className="mb-2">
          <div className="h-1.5 rounded-full bg-clay-bg shadow-clay-inset-sm overflow-hidden">
            <div className={`h-full transition-all ${c.bar}`} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-clay-faint mt-1 tabular-nums">
            <span>已抢 {sku.sold_count}</span>
            <span>共 {sku.total_limit} 份</span>
          </div>
        </div>
      )}

      {/* 限购提示 */}
      {sku.per_user_limit > 0 && !isSoldOut && (
        <div className="text-[11px] text-clay-faint font-bold">
          {isUserLimit
            ? `您已购买 ${sku.user_bought_n} 次（已达上限）`
            : sku.per_user_limit === 1
              ? `每人限购 1 次`
              : `您还可购买 ${sku.user_can_buy_n} 次`}
        </div>
      )}

      {/* 售罄等状态角标 */}
      {stateLabel && (
        <div className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm text-[11px] font-black text-clay-faint">
          {stateLabel}
        </div>
      )}
    </button>
  )
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function fmtAmount(n) {
  const s = Number(n || 0).toFixed(2)
  return s.replace(/0+$/, '').replace(/\.$/, '') || '0'
}
function skuPrice(sku)     { return sku?.price_display     || fmtAmount(sku?.price_yuan) }
function skuDelivered(sku) { return sku?.delivered_display || fmtAmount(sku?.delivered_yuan) }
