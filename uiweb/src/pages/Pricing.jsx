import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  Coins,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Sparkles,
  Filter,
  Gem,
  X,
  CheckCircle2,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { useStatus } from '../context/StatusContext.jsx'
import { useUser } from '../context/UserContext.jsx'
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

function isModelEnabledForGroup(model, group) {
  if (group === 'all') return true
  const enableGroups = Array.isArray(model.enable_groups) ? model.enable_groups : []
  return enableGroups.includes(group) || enableGroups.includes('all')
}

function formatRatioValue(value) {
  const ratio = Number(value)
  if (!Number.isFinite(ratio)) return '1x'
  return `${Number.isInteger(ratio) ? ratio : ratio.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}x`
}

function normalizeGroupText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function getUserGroupTokens(userGroup) {
  const normalized = normalizeGroupText(userGroup)
  if (!normalized) return []

  const tokens = new Set([normalized])
  if (normalized.includes('pro')) {
    tokens.add('pro')
    tokens.add('pro优')
  }
  if (normalized.includes('ultra')) {
    tokens.add('ultra')
    tokens.add('ultra优')
  }
  if (normalized.includes('super') || normalized.includes('spuer')) {
    tokens.add('super')
    tokens.add('super优')
    tokens.add('spuer')
    tokens.add('spuer优')
  }
  if (normalized.includes('standard')) {
    tokens.add('standard')
    tokens.add('standard优')
  }
  if (normalized.includes('vip')) tokens.add('vip')

  return Array.from(tokens).filter(Boolean)
}

function getGroupHighlightTone(option) {
  const text = normalizeGroupText(`${option.key} ${option.name} ${option.description} ${option.detail}`)
  if (text.includes('ultra')) return 'amber'
  if (text.includes('pro') || text.includes('vip')) return 'blue'
  return 'blue'
}

export default function Pricing() {
  const { status } = useStatus()
  const { user } = useUser()
  const [models, setModels] = useState([])
  const [vendorsMap, setVendorsMap] = useState({})
  const [groupRatio, setGroupRatio] = useState({})
  const [groupDetails, setGroupDetails] = useState({})
  const [usableGroup, setUsableGroup] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)

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
        setGroupDetails(res?.group_details ?? res?.group_detail_descriptions ?? {})
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

  useEffect(() => {
    if (!groups.includes(selectedGroup)) {
      setSelectedGroup('all')
    }
  }, [groups, selectedGroup])

  useEffect(() => {
    if (!groupDialogOpen) return undefined
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('pricing-group-dialog-open')
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setGroupDialogOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.classList.remove('pricing-group-dialog-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [groupDialogOpen])

  const groupOptions = useMemo(() => {
    return groups.map((group) => {
      const isAll = group === 'all'
      const count = isAll
        ? models.length
        : models.filter((model) => isModelEnabledForGroup(model, group)).length
      return {
        key: group,
        name: isAll ? '全部分组' : group,
        description: isAll ? '显示当前账号可用的所有模型' : (usableGroup[group] || group),
        detail: isAll
          ? '默认展示当前账号可用的全部模型，并按模型可用分组使用对应倍率计算展示价格。'
          : String(groupDetails[group] || '').trim(),
        ratio: isAll ? null : groupRatio[group],
        count,
      }
    })
  }, [groups, groupRatio, groupDetails, models, usableGroup])

  const selectedGroupOption = useMemo(() => (
    groupOptions.find((item) => item.key === selectedGroup) || groupOptions[0] || {
      key: 'all',
      name: '全部分组',
      count: models.length,
      detail: '',
      ratio: null,
    }
  ), [groupOptions, models.length, selectedGroup])

  const userGroup = user?.group || ''
  const groupHighlights = useMemo(() => {
    const normalizedUserGroup = normalizeGroupText(userGroup)
    const tokens = getUserGroupTokens(userGroup)
    if (!normalizedUserGroup || tokens.length === 0) return []

    return groupOptions
      .filter((option) => option.key !== 'all')
      .map((option, index) => {
        const normalizedKey = normalizeGroupText(option.key)
        const text = normalizeGroupText(`${option.key} ${option.name} ${option.description} ${option.detail}`)
        const exact = normalizedKey === normalizedUserGroup
        const related = exact || tokens.some((token) => text.includes(token))
        if (!related) return null
        return {
          option,
          exact,
          index,
          tone: getGroupHighlightTone(option),
          score: exact ? 2 : 1,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
  }, [groupOptions, userGroup])

  const filtered = useMemo(() => {
    let result = models
    if (selectedGroup !== 'all') {
      result = result.filter((m) => isModelEnabledForGroup(m, selectedGroup))
    }
    if (keyword) {
      const k = keyword.toLowerCase()
      result = result.filter((m) => (m.model_name ?? '').toLowerCase().includes(k))
    }
    return result
  }, [models, keyword, selectedGroup])

  const cc = getCurrencyConfig(status)
  const unitLabel = cc.type === 'TOKENS' ? '倍率' : '/1M tokens'

  return (
    <ClayPageShell>
      <section>
        {/* Header */}
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-pink-200 hidden sm:flex">
          <Coins className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-[34px] sm:text-4xl md:text-5xl font-black text-center mb-3 tracking-tight">
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

        {/* Desktop group pills */}
        {groups.length > 1 && (
          <div className="hidden md:flex flex-wrap items-center justify-center gap-2 mb-5 px-2">
            {groupOptions.map((option) => {
              const active = selectedGroup === option.key
              return (
                <div key={option.key} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(option.key)}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-clay-pill text-sm font-extrabold transition-all ${
                      active
                        ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                        : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink hover:shadow-clay'
                    }`}
                  >
                    <span className="whitespace-nowrap">{option.name}</span>
                    {option.ratio != null && (
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                        active ? 'bg-white/40' : 'bg-black/[0.04]'
                      }`}>
                        {formatRatioValue(option.ratio)}
                      </span>
                    )}
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-[80] w-80 -translate-x-1/2 rounded-clay bg-clay-surface px-4 py-3 text-left text-clay-ink shadow-clay-hover border border-white/30 opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black leading-tight break-words">{option.name}</div>
                        <div className="mt-1 text-xs font-bold text-clay-faint leading-relaxed">
                          {option.description || '暂无简介'}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="rounded-clay-pill bg-clay-blue-100/70 px-2.5 py-1 text-[11px] font-black text-[#43658b]">
                          {option.count} 个模型
                        </span>
                        {option.ratio != null && (
                          <span className="rounded-clay-pill bg-white/45 px-2.5 py-1 text-[11px] font-black text-clay-faint shadow-clay-sm">
                            {formatRatioValue(option.ratio)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-black/[0.04] pt-3">
                      <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-clay-faint/70">
                        详细介绍
                      </div>
                      <p className="text-sm font-semibold leading-relaxed text-clay-faint">
                        {option.detail || '暂无详细介绍'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Mobile group selector */}
        {groups.length > 1 && (
          <div className="md:hidden max-w-3xl mx-auto mb-4 px-0 sm:px-2">
            <div className="rounded-clay bg-clay-bg shadow-clay-inset px-5 py-4 text-clay-faint">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-clay-faint/75">
                    当前分组
                  </div>
                  <div className="mt-1 text-lg font-black leading-tight text-clay-ink break-words">
                    {selectedGroupOption.name}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="rounded-clay-pill bg-clay-blue-100/70 px-2.5 py-1 text-[11px] font-black text-[#43658b]">
                    {selectedGroupOption.count} 个模型
                  </span>
                  {selectedGroupOption.ratio != null && (
                    <span className="rounded-clay-pill bg-white/45 px-2.5 py-1 text-[11px] font-black text-clay-faint shadow-clay-sm">
                      {formatRatioValue(selectedGroupOption.ratio)}
                    </span>
                  )}
                </div>
              </div>
              {selectedGroupOption.detail && (
                <div className="mt-3 border-t border-black/[0.04] pt-3 text-sm font-semibold leading-relaxed">
                  <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-clay-faint/70">
                    详细介绍
                  </div>
                  <p>{selectedGroupOption.detail}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-1 items-center gap-2">
            <div className="relative min-w-0">
              <ClayInput
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索模型名称…"
                className="!h-[52px] !pl-12"
              />
              <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint pointer-events-none" />
            </div>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => setGroupDialogOpen(true)}
                className="md:hidden inline-flex h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-clay-pill bg-clay-pink-100 px-4 text-sm font-extrabold text-[#8a4860] shadow-clay transition-all active:scale-95 active:shadow-clay-active"
              >
                <Filter className="w-3.5 h-3.5" strokeWidth={2.5} />
                查看分组
              </button>
            )}
          </div>
        </div>

        {groupDialogOpen && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center px-3 py-4 sm:items-center sm:px-6">
            <button
              type="button"
              aria-label="关闭分组选择"
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
              onClick={() => setGroupDialogOpen(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-[32px] bg-clay-surface shadow-clay-hover border border-white/30">
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-black/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="clay-icon-box !w-12 !h-12 text-[#43658b] shrink-0">
                      <Filter className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black text-clay-ink truncate">
                        选择分组
                      </h2>
                      <p className="text-xs sm:text-sm font-semibold text-clay-faint">
                        查看倍率、简介和每个分组的模型数量
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGroupDialogOpen(false)}
                    className="clay-icon-box !w-11 !h-11 text-clay-faint hover:text-clay-ink shrink-0"
                    aria-label="关闭"
                  >
                    <X className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                </div>

                {groupHighlights.length > 0 && (
                  <div className={`mt-4 grid grid-cols-1 gap-2 ${groupHighlights.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                    {groupHighlights.map(({ option, exact, tone }) => {
                      const HighlightIcon = tone === 'amber' ? Gem : Sparkles
                      const toneClass = tone === 'amber'
                        ? 'bg-clay-yellow-100/70 text-[#8a6a32]'
                        : 'bg-clay-blue-100/65 text-[#43658b]'
                      return (
                        <div
                          key={option.key}
                          className={`rounded-clay shadow-clay-inset px-4 py-3 flex items-center gap-3 ${toneClass}`}
                        >
                          <HighlightIcon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
                          <div className="min-w-0">
                            <div className="font-black leading-tight break-words">
                              {option.description || option.name}
                            </div>
                            <div className="text-[11px] font-bold opacity-75 leading-relaxed">
                              {exact ? '当前用户分组' : option.name}
                              {option.count != null ? ` · ${option.count} 个模型` : ''}
                              {option.ratio != null ? ` · ${formatRatioValue(option.ratio)}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="max-h-[58vh] overflow-y-auto clay-scrollbar-none px-4 sm:px-6 pt-4 pb-12 space-y-2">
                {groupOptions.map((option) => {
                  const active = option.key === selectedGroup
                  return (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => {
                        setSelectedGroup(option.key)
                        setGroupDialogOpen(false)
                      }}
                      className={`w-full rounded-clay px-4 py-3 text-left transition-all ${
                        active
                          ? 'bg-clay-pink-100/85 text-[#8a4860] shadow-clay'
                          : 'bg-clay-bg text-clay-ink shadow-clay-inset hover:shadow-clay'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-black text-base truncate">{option.name}</span>
                            {active && <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                          </div>
                          <p className={`mt-1 text-xs sm:text-sm font-semibold leading-relaxed ${
                            active ? 'text-[#8a4860]/75' : 'text-clay-faint'
                          }`}>
                            {option.description}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className={`rounded-clay-pill px-2.5 py-1 text-xs font-black shadow-clay-sm ${
                            active ? 'bg-white/40 text-[#8a4860]' : 'bg-white/45 text-[#43658b]'
                          }`}>
                            {option.count} 个模型
                          </span>
                          {option.ratio != null && (
                            <span className={`rounded-clay-pill px-2.5 py-1 text-xs font-black ${
                              active ? 'bg-white/30 text-[#8a4860]/85' : 'bg-black/[0.04] text-clay-faint'
                            }`}>
                              {formatRatioValue(option.ratio)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

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
              <span>，分组 <strong className="text-clay-ink">{selectedGroup}</strong>（{formatRatioValue(groupRatio[selectedGroup] ?? 1)}）</span>
            )}
          </div>
        )}
      </section>
    </ClayPageShell>
  )
}
