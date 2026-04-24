import { useEffect, useMemo, useState } from 'react'
import { Search, Tag, Coins, Loader2, Layers } from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { getPricing } from '../services/pricing.js'

const PALETTE = [
  'bg-clay-pink-100',
  'bg-clay-blue-100',
  'bg-clay-purple-100',
  'bg-clay-green-100',
  'bg-clay-yellow-100',
]

function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1024
  return PALETTE[h % PALETTE.length]
}

function getCurrencyConfig(status) {
  const type = status?.quota_display_type || 'USD'
  if (type === 'TOKENS') return { type, symbol: '', rate: 1, perUnit: 1 }
  const perUnit = Number(status?.quota_per_unit) || 500000
  let symbol = '$'
  let rate = 1
  if (type === 'CNY') {
    symbol = '¥'
    rate = Number(status?.usd_exchange_rate) || 7
  } else if (type === 'CUSTOM') {
    symbol = status?.custom_currency_symbol || '¤'
    rate = Number(status?.custom_currency_exchange_rate) || 1
  }
  return { type, symbol, rate, perUnit }
}

function calcPrice(modelRatio, completionRatio, groupRatio, cc, tokenUnit) {
  if (cc.type === 'TOKENS') {
    return { input: `${modelRatio.toFixed(3)}x`, output: `${(modelRatio * completionRatio).toFixed(3)}x` }
  }
  const basePerUnit = 0.002
  const unitDiv = tokenUnit === 'K' ? 1000 : 1_000_000
  const inputUsd = modelRatio * basePerUnit * groupRatio / unitDiv
  const outputUsd = modelRatio * completionRatio * basePerUnit * groupRatio / unitDiv
  const inputPrice = inputUsd * cc.rate
  const outputPrice = outputUsd * cc.rate
  const fmt = (v) => {
    if (v < 0.0001) return `${cc.symbol}${v.toExponential(2)}`
    return `${cc.symbol}${v.toFixed(4)}`
  }
  return { input: fmt(inputPrice), output: fmt(outputPrice) }
}

function formatFixedPrice(price, groupRatio, cc) {
  if (cc.type === 'TOKENS') {
    return `${(price * groupRatio).toFixed(3)}x`
  }
  const perUnit = cc.perUnit || 500000
  const usd = (price / perUnit) * groupRatio
  const converted = usd * cc.rate
  return `${cc.symbol}${converted.toFixed(4)}`
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
  const [tokenUnit] = useState('M')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await getPricing()
        const d = res?.data ?? res
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        const vendorMap = {}
        if (Array.isArray(d?.vendors)) {
          d.vendors.forEach((v) => { vendorMap[v.id] = v })
        }
        list.forEach((m) => {
          if (m.vendor_id && vendorMap[m.vendor_id]) {
            m.vendor_name = vendorMap[m.vendor_id].name
            m.vendor_icon = vendorMap[m.vendor_id].icon
          }
        })
        list.sort((a, b) => {
          if (a.model_name?.startsWith('gpt') && !b.model_name?.startsWith('gpt')) return -1
          if (!a.model_name?.startsWith('gpt') && b.model_name?.startsWith('gpt')) return 1
          return (a.model_name ?? '').localeCompare(b.model_name ?? '')
        })
        setModels(list)
        setVendorsMap(vendorMap)
        setGroupRatio(d?.group_ratio ?? {})
        setUsableGroup(d?.usable_group ?? {})
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

  const currentGroupRatio = selectedGroup === 'all' ? 1 : (groupRatio[selectedGroup] ?? 1)

  const filtered = useMemo(() => {
    let result = models
    if (selectedGroup !== 'all') {
      result = result.filter((m) =>
        m.enable_groups?.includes(selectedGroup) || m.enable_groups?.includes('all')
      )
    }
    if (keyword) {
      const k = keyword.toLowerCase()
      result = result.filter((m) => {
        const name = (m.model_name ?? '').toLowerCase()
        const vendor = (m.vendor_name ?? '').toLowerCase()
        return name.includes(k) || vendor.includes(k)
      })
    }
    return result
  }, [models, keyword, selectedGroup])

  const vendorGrouped = useMemo(() => {
    const map = new Map()
    for (const m of filtered) {
      const vName = m.vendor_name || '其他'
      if (!map.has(vName)) map.set(vName, [])
      map.get(vName).push(m)
    }
    return map
  }, [filtered])

  const cc = getCurrencyConfig(status)
  const unitLabel = tokenUnit === 'K' ? '/1K tokens' : '/1M tokens'

  return (
    <ClayPageShell>
      <section>
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-pink-200">
          <Coins className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-3 tracking-tight">
          模型与价格
        </h1>
        <p className="text-center text-clay-faint mb-8 max-w-2xl mx-auto">
          所有可用模型的实时定价。选择分组查看对应倍率下的价格，按量计费模型价格为每百万 tokens。
        </p>

        {/* Group selector */}
        {groups.length > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {groups.map((g) => {
              const active = selectedGroup === g
              const ratio = g === 'all' ? null : groupRatio[g]
              const count = g === 'all'
                ? models.length
                : models.filter((m) => m.enable_groups?.includes(g) || m.enable_groups?.includes('all')).length
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

        {/* Search */}
        <div className="max-w-xl mx-auto mb-10 relative">
          <ClayInput
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模型名称或供应商…"
            className="!pl-12"
          />
          <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint pointer-events-none" />
        </div>

        {error && (
          <ClayAlert tone="error" className="max-w-2xl mx-auto mb-8">
            {error}
          </ClayAlert>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">加载价格中…</p>
          </div>
        ) : filtered.length === 0 ? (
          <ClayCard className="max-w-xl mx-auto text-center">
            <Tag className="w-8 h-8 mx-auto mb-3 text-clay-faint" />
            <p className="text-clay-faint">没有匹配的模型</p>
          </ClayCard>
        ) : (
          <div className="space-y-10">
            {[...vendorGrouped.entries()].map(([vendor, vendorModels]) => (
              <div key={vendor}>
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-clay-blue-200" />
                  <h2 className="text-xl font-black">{vendor}</h2>
                  <span className="text-xs text-clay-faint font-bold bg-clay-bg shadow-clay-inset px-2.5 py-1 rounded-full">
                    {vendorModels.length} 模型
                  </span>
                </div>

                {/* Table view */}
                <ClayCard className="!p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 text-left text-clay-faint">
                        <th className="px-5 py-3 font-bold">模型</th>
                        <th className="px-5 py-3 font-bold">计费</th>
                        <th className="px-5 py-3 font-bold text-right">
                          {cc.type === 'TOKENS' ? '输入倍率' : `输入 ${unitLabel}`}
                        </th>
                        <th className="px-5 py-3 font-bold text-right">
                          {cc.type === 'TOKENS' ? '输出倍率' : `输出 ${unitLabel}`}
                        </th>
                        <th className="px-5 py-3 font-bold">分组</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorModels.map((m, i) => {
                        const name = m.model_name ?? '未命名'
                        const ratio = m.model_ratio ?? 1
                        const compRatio = m.completion_ratio ?? 1
                        const quotaType = m.quota_type ?? 0
                        const groups = m.enable_groups ?? []

                        let effectiveGroupRatio = currentGroupRatio
                        if (selectedGroup === 'all' && groups.length > 0) {
                          const best = groups.reduce((min, g) => {
                            const gr = groupRatio[g] ?? 1
                            return gr < min ? gr : min
                          }, Infinity)
                          if (Number.isFinite(best)) effectiveGroupRatio = best
                        }

                        let inputDisplay, outputDisplay
                        if (quotaType === 1) {
                          inputDisplay = formatFixedPrice(m.model_price ?? 0, effectiveGroupRatio, cc)
                          outputDisplay = '—'
                        } else {
                          const p = calcPrice(ratio, compRatio, effectiveGroupRatio, cc, tokenUnit)
                          inputDisplay = p.input
                          outputDisplay = p.output
                        }

                        return (
                          <tr key={`${name}-${i}`} className="border-b border-black/5 last:border-0 hover:bg-white/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-full shadow-clay shrink-0 ${colorFor(name)}`} />
                                <span className="font-bold text-sm break-all">{name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                quotaType === 1
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {quotaType === 1 ? '按次' : '按量'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-mono font-bold text-sm">
                              {inputDisplay}
                            </td>
                            <td className="px-5 py-3 text-right font-mono font-bold text-sm">
                              {outputDisplay}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-1">
                                {groups.slice(0, 3).map((g) => (
                                  <span
                                    key={g}
                                    onClick={() => { if (g !== 'all') setSelectedGroup(g) }}
                                    className={`px-2 py-0.5 rounded-clay-sm text-[11px] font-bold cursor-pointer transition-colors ${
                                      selectedGroup === g
                                        ? 'bg-clay-pink-100 text-[#8a4860]'
                                        : 'bg-clay-bg shadow-clay-inset text-clay-faint hover:text-clay-ink'
                                    }`}
                                  >
                                    {g}
                                  </span>
                                ))}
                                {groups.length > 3 && (
                                  <span className="text-[11px] font-bold text-clay-faint">
                                    +{groups.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ClayCard>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && filtered.length > 0 && (
          <div className="mt-8 text-center text-sm text-clay-faint">
            共 {filtered.length} 个模型
            {selectedGroup !== 'all' && (
              <span>，当前分组 <strong className="text-clay-ink">{selectedGroup}</strong>（{currentGroupRatio}x 倍率）</span>
            )}
          </div>
        )}
      </section>
    </ClayPageShell>
  )
}
