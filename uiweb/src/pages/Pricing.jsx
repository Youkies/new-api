import { useEffect, useMemo, useState } from 'react'
import { Search, Coins, Loader2, ChevronDown } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { getPricing } from '../services/pricing.js'
import { getLobeHubIcon } from '../utils/vendorIcon.jsx'

function PriceRow({ label, value, accent, muted }) {
  if (!label && !value) return <div className="h-5" />
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-clay-faint tracking-wide uppercase">{label}</span>
      <span className={`font-mono font-extrabold text-[15px] tracking-tight ${
        muted ? 'text-clay-faint/40' : accent ? 'text-clay-ink' : ''
      }`}>
        {value}
      </span>
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
        <p className="text-center text-clay-faint mb-8 max-w-2xl mx-auto">
          所有可用模型的实时定价。{cc.type !== 'TOKENS' ? '按量计费模型价格为每百万 tokens。' : ''}
        </p>

        {/* Group pills */}
        {groups.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {groups.map((g) => {
              const active = selectedGroup === g
              const ratio = g === 'all' ? null : groupRatio[g]
              return (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-sm font-extrabold transition-all ${
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
                <ClayCard key={`${name}-${i}`} className="!p-4 flex flex-col hover:-translate-y-0.5 transition-all">
                  {/* Header: icon + name + badge */}
                  <div className="flex items-start gap-3 mb-auto pb-3">
                    <span className="shrink-0 mt-0.5">
                      {getLobeHubIcon(m.vendor_icon, 24)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-[15px] text-clay-ink break-all leading-snug">{name}</p>
                    </div>
                    <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-clay-sm whitespace-nowrap shrink-0 shadow-clay-inset ${
                      isFixed
                        ? 'bg-clay-yellow-100/60 text-amber-800'
                        : 'bg-clay-blue-50/60 text-blue-800'
                    }`}>
                      {isFixed ? '按次' : '按量'}
                    </span>
                  </div>

                  {/* Price rows — always 3 slots for uniform height */}
                  <div className="rounded-clay-sm shadow-clay-inset bg-clay-bg/50 px-3.5 py-3 space-y-2">
                    {isFixed ? (
                      <>
                        <PriceRow label="单次价格" value={inputDisplay} accent />
                        <PriceRow label="" value="" />
                        <PriceRow label="" value="" />
                      </>
                    ) : (
                      <>
                        <PriceRow label="输入" value={inputDisplay} accent />
                        <PriceRow label="输出" value={outputDisplay} accent />
                        <PriceRow label="缓存" value={cacheDisplay ?? '—'} muted={!cacheDisplay} />
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
