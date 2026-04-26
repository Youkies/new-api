import { useEffect, useMemo, useState } from 'react'
import { Search, Coins, Loader2, ChevronDown, ArrowDownToLine, ArrowUpFromLine, Database, Sparkles } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { getPricing } from '../services/pricing.js'
import { getLobeHubIcon } from '../utils/vendorIcon.jsx'

function PriceCell({ icon: Icon, label, value, tone = 'ink', muted }) {
  const toneCls = {
    ink: 'text-clay-ink',
    blue: 'text-[#3a6ea5]',
    pink: 'text-[#a04668]',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  }[tone] ?? 'text-clay-ink'
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-clay-faint mb-1">
        {Icon && <Icon className="w-3 h-3" strokeWidth={2.5} />}
        <span>{label}</span>
      </div>
      <div className={`font-mono font-black text-[15px] leading-none tracking-tight tabular-nums truncate ${
        muted ? 'text-clay-faint/40' : toneCls
      }`}>
        {value}
      </div>
    </div>
  )
}

function getCurrencyConfig(status) {
  const type = status?.quota_display_type || 'USD'
  if (type === 'TOKENS') return { type, symbol: '', rate: 1 }
  let symbol = '$'
  let rate = 1
  if (type === 'CNY') {
    symbol = '¥'
    rate = Number(status?.usd_exchange_rate) || 7
  } else if (type === 'CUSTOM') {
    symbol = status?.custom_currency_symbol || '¤'
    rate = Number(status?.custom_currency_exchange_rate) || 1
  }
  return { type, symbol, rate }
}

function formatPrice(usdValue, cc, precision = 4) {
  if (!Number.isFinite(usdValue)) return '—'
  const converted = usdValue * cc.rate
  if (Math.abs(converted) < 0.0001 && converted !== 0) {
    return `${cc.symbol}${converted.toExponential(2)}`
  }
  return `${cc.symbol}${converted.toFixed(precision)}`
}

function calcTokenPrices(model, groupRatio, cc) {
  const ratio = model.model_ratio ?? 1
  const compRatio = model.completion_ratio ?? 1
  const cacheRatio = model.cache_ratio

  if (cc.type === 'TOKENS') {
    const hasCache = cacheRatio != null && cacheRatio !== '' && Number.isFinite(Number(cacheRatio))
    return {
      input: `${Number(ratio).toFixed(3)}x`,
      output: `${(ratio * compRatio).toFixed(3)}x`,
      cache: hasCache ? `${(ratio * Number(cacheRatio)).toFixed(3)}x` : null,
    }
  }

  // model_ratio * 2 * groupRatio = USD per 1M tokens
  const baseUSD = ratio * 2 * groupRatio
  const hasCache = cacheRatio != null && cacheRatio !== '' && Number.isFinite(Number(cacheRatio))

  return {
    input: formatPrice(baseUSD, cc),
    output: formatPrice(baseUSD * compRatio, cc),
    cache: hasCache ? formatPrice(baseUSD * Number(cacheRatio), cc) : null,
  }
}

function calcFixedPrice(model, groupRatio, cc) {
  const price = parseFloat(model.model_price) || 0
  if (cc.type === 'TOKENS') {
    return `${(price * groupRatio).toFixed(3)}x`
  }
  const usd = price * groupRatio
  return formatPrice(usd, cc)
}

export default function Pricing() {
  const { status } = useStatus()
  const [models, setModels] = useState([])
  const [vendorsMap, setVendorsMap] = useState({})
  const [groupRatio, setGroupRatio] = useState({})
  const [usableGroup, setUsableGroup] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedVendor, setSelectedVendor] = useState('all')
  const [vendorOpen, setVendorOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getPricing()
        const d = res?.data ?? res
        const list = Array.isArray(d) ? d : []
        const vMap = {}
        if (Array.isArray(res?.vendors)) {
          res.vendors.forEach((v) => { vMap[v.id] = v })
        }
        list.forEach((m) => {
          if (m.vendor_id && vMap[m.vendor_id]) {
            m.vendor_name = vMap[m.vendor_id].name
            m.vendor_icon = vMap[m.vendor_id].icon
          }
        })
        list.sort((a, b) => (a.model_name ?? '').localeCompare(b.model_name ?? ''))
        setModels(list)
        setVendorsMap(vMap)
        setGroupRatio(res?.group_ratio ?? {})
        setUsableGroup(res?.usable_group ?? {})
      } catch (err) {
        setError(err?.response?.data?.message ?? err.message ?? '价格加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const groups = useMemo(() => {
    const keys = Object.keys(usableGroup).filter(Boolean)
    return ['all', ...keys]
  }, [usableGroup])

  const vendors = useMemo(() => {
    const set = new Map()
    for (const m of models) {
      if (m.vendor_name && !set.has(m.vendor_name)) {
        set.set(m.vendor_name, m.vendor_icon)
      }
    }
    return set
  }, [models])

  const filtered = useMemo(() => {
    let result = models
    if (selectedGroup !== 'all') {
      result = result.filter((m) =>
        m.enable_groups?.includes(selectedGroup) || m.enable_groups?.includes('all')
      )
    }
    if (selectedVendor !== 'all') {
      result = result.filter((m) => m.vendor_name === selectedVendor)
    }
    if (keyword) {
      const k = keyword.toLowerCase()
      result = result.filter((m) => (m.model_name ?? '').toLowerCase().includes(k))
    }
    return result
  }, [models, keyword, selectedGroup, selectedVendor])

  const cc = getCurrencyConfig(status)
  const unitLabel = cc.type === 'TOKENS' ? '倍率' : '/1M tokens'

  return (
    <ClayPageShell>
      <section>
        {/* Header */}
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-pink-200">
          <Coins className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-3 tracking-tight">
          模型与价格
        </h1>
        <p className="text-center text-clay-faint mb-3 max-w-2xl mx-auto">
          所有可用模型的实时定价。{cc.type !== 'TOKENS' ? '按量计费按每百万 tokens 计算。' : '当前以倍率显示。'}
        </p>
        {cc.type !== 'TOKENS' && (
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-clay-faint bg-clay-bg shadow-clay-inset px-3 py-1 rounded-clay-pill">
              <span className="w-1.5 h-1.5 rounded-full bg-clay-pink-300" />
              单位 {unitLabel} · 实际扣费按渠道倍率
            </span>
          </div>
        )}

        {/* Group pills */}
        {groups.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4 px-2">
            {groups.map((g) => {
              const active = selectedGroup === g
              const ratio = g === 'all' ? null : groupRatio[g]
              return (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`inline-flex items-center justify-center gap-1.5 min-w-[5.5rem] px-4 py-2 rounded-clay-pill text-sm font-extrabold transition-all ${
                    active
                      ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                      : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink'
                  }`}
                >
                  {g === 'all' ? '全部分组' : g}
                  {ratio != null && (
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/40' : 'bg-black/5'
                    }`}>
                      {ratio}x
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Vendor filter + search row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-3xl mx-auto mb-10">
          {/* Vendor dropdown */}
          {vendors.size > 1 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setVendorOpen(!vendorOpen)}
                onBlur={() => setTimeout(() => setVendorOpen(false), 150)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-clay text-sm font-extrabold transition-all w-full sm:w-auto ${
                  selectedVendor !== 'all'
                    ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                    : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink'
                }`}
              >
                {selectedVendor !== 'all' && (
                  <span className="shrink-0">{getLobeHubIcon(vendors.get(selectedVendor), 16)}</span>
                )}
                <span className="truncate">{selectedVendor === 'all' ? '全部供应商' : selectedVendor}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${vendorOpen ? 'rotate-180' : ''}`} />
              </button>
              {vendorOpen && (
                <div className="absolute z-50 mt-2 left-0 min-w-[200px] max-h-72 overflow-y-auto rounded-clay bg-white shadow-clay-hover p-2 space-y-0.5">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSelectedVendor('all'); setVendorOpen(false) }}
                    className={`w-full text-left px-3 py-2 rounded-clay-sm text-sm font-bold transition-colors ${
                      selectedVendor === 'all' ? 'bg-clay-pink-50 text-[#8a4860]' : 'text-clay-ink hover:bg-clay-bg'
                    }`}
                  >
                    全部供应商
                  </button>
                  {[...vendors.entries()].map(([name, icon]) => (
                    <button
                      key={name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSelectedVendor(name); setVendorOpen(false) }}
                      className={`w-full text-left px-3 py-2 rounded-clay-sm text-sm font-bold transition-colors flex items-center gap-2 ${
                        selectedVendor === name ? 'bg-clay-pink-50 text-[#8a4860]' : 'text-clay-ink hover:bg-clay-bg'
                      }`}
                    >
                      <span className="shrink-0">{getLobeHubIcon(icon, 16)}</span>
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索模型名称…"
              className="!pl-12"
            />
            <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint pointer-events-none" />
          </div>
        </div>

        {error && (
          <ClayAlert tone="error" className="max-w-2xl mx-auto mb-8">
            {error}
          </ClayAlert>
        )}

        {/* Cards */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">加载价格中…</p>
          </div>
        ) : filtered.length === 0 ? (
          <ClayCard className="max-w-xl mx-auto text-center py-12">
            <Coins className="w-8 h-8 mx-auto mb-3 text-clay-faint" />
            <p className="text-clay-faint font-semibold">没有匹配的模型</p>
          </ClayCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m, i) => {
              const name = m.model_name ?? '—'
              const quotaType = m.quota_type ?? 0

              let effectiveGroupRatio = groupRatio[selectedGroup] ?? 1
              if (selectedGroup === 'all' && m.enable_groups?.length > 0) {
                const best = m.enable_groups.reduce((min, g) => {
                  const gr = groupRatio[g] ?? 1
                  return gr < min ? gr : min
                }, Infinity)
                if (Number.isFinite(best)) effectiveGroupRatio = best
              }

              const isFixed = quotaType === 1

              let inputDisplay, outputDisplay, cacheDisplay
              if (isFixed) {
                inputDisplay = calcFixedPrice(m, effectiveGroupRatio, cc)
                outputDisplay = null
                cacheDisplay = null
              } else {
                const p = calcTokenPrices(m, effectiveGroupRatio, cc)
                inputDisplay = p.input
                outputDisplay = p.output
                cacheDisplay = p.cache
              }

              return (
                <ClayCard
                  key={`${name}-${i}`}
                  className="!p-0 flex flex-col overflow-hidden hover:-translate-y-0.5 hover:shadow-clay-hover transition-all"
                >
                  {/* Header with vendor tint */}
                  <div
                    className={`px-4 pt-4 pb-3 flex items-start gap-3 border-b border-black/[0.04] ${
                      isFixed
                        ? 'bg-gradient-to-br from-clay-yellow-50/70 to-clay-yellow-100/40'
                        : 'bg-gradient-to-br from-clay-blue-50/50 to-clay-pink-50/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-clay-sm bg-white/70 shadow-clay-sm flex items-center justify-center shrink-0">
                      {getLobeHubIcon(m.vendor_icon, 22)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[14px] text-clay-ink break-all leading-tight" title={name}>
                        {name}
                      </p>
                      {m.vendor_name && (
                        <p className="text-[10px] font-bold text-clay-faint mt-1 truncate">
                          {m.vendor_name}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-clay-pill whitespace-nowrap shrink-0 ${
                        isFixed
                          ? 'bg-clay-yellow-200/80 text-amber-900'
                          : 'bg-clay-blue-200/80 text-[#2c5582]'
                      }`}
                    >
                      {isFixed ? '按次' : '按量'}
                    </span>
                  </div>

                  {/* Pricing block */}
                  <div className="px-4 py-3.5 flex-1">
                    {isFixed ? (
                      <div className="bg-clay-bg/60 shadow-clay-inset rounded-clay-sm px-4 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-clay-faint">
                          <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
                          单次价格
                        </div>
                        <span className="font-mono font-black text-[16px] text-amber-700 tabular-nums">
                          {inputDisplay}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="bg-clay-bg/60 shadow-clay-inset rounded-clay-sm px-3.5 py-3 flex items-stretch gap-3">
                          <PriceCell icon={ArrowDownToLine} label="输入" value={inputDisplay} tone="blue" />
                          <div className="w-px bg-black/5 my-0.5" />
                          <PriceCell icon={ArrowUpFromLine} label="输出" value={outputDisplay} tone="pink" />
                        </div>
                        <div
                          className={`mt-2 px-3.5 py-2 rounded-clay-sm flex items-center justify-between gap-2 ${
                            cacheDisplay
                              ? 'bg-emerald-50/60 shadow-clay-inset'
                              : 'bg-transparent border border-dashed border-black/[0.06]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-clay-faint">
                            <Database className="w-3 h-3" strokeWidth={2.5} />
                            缓存读取
                          </div>
                          <span
                            className={`font-mono font-black text-[13px] tabular-nums ${
                              cacheDisplay ? 'text-emerald-700' : 'text-clay-faint/40'
                            }`}
                          >
                            {cacheDisplay ?? '不支持'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </ClayCard>
              )
            })}
          </div>
        )}

        {/* Footer summary */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 text-center text-sm text-clay-faint">
            共 {filtered.length} 个模型
            {selectedGroup !== 'all' && (
              <span>，分组 <strong className="text-clay-ink">{selectedGroup}</strong>（{groupRatio[selectedGroup] ?? 1}x）</span>
            )}
            {selectedVendor !== 'all' && (
              <span>，供应商 <strong className="text-clay-ink">{selectedVendor}</strong></span>
            )}
          </div>
        )}
      </section>
    </ClayPageShell>
  )
}
