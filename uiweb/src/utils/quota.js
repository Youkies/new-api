function getQuotaPerUnit() {
  try {
    const raw = parseFloat(localStorage.getItem('quota_per_unit') || '1')
    return Number.isFinite(raw) && raw > 0 ? raw : 1
  } catch (_) {
    return 1
  }
}

function getStatusCache() {
  try {
    return JSON.parse(localStorage.getItem('status') || '{}')
  } catch (_) {
    return {}
  }
}

// Mirror of web/src/helpers/render.jsx getCurrencyConfig().
// quota_display_type: 'USD' | 'CNY' | 'CUSTOM' | 'TOKENS'
function getCurrencyConfig() {
  const type = localStorage.getItem('quota_display_type') || 'USD'
  const s = getStatusCache()
  if (type === 'TOKENS') return { type, symbol: '', rate: 1 }
  let symbol = '$'
  let rate = 1
  if (type === 'CNY') {
    symbol = '¥'
    rate = Number(s?.usd_exchange_rate) || 7
  } else if (type === 'CUSTOM') {
    symbol = s?.custom_currency_symbol || '¤'
    rate = Number(s?.custom_currency_exchange_rate) || 1
  }
  return { type, symbol, rate }
}

export function quotaToDisplay(quota, digits = 2) {
  const q = Number(quota || 0)
  const { type, symbol, rate } = getCurrencyConfig()
  if (type === 'TOKENS') {
    const n = Math.round(q)
    return { value: n, text: `${n.toLocaleString()} tokens` }
  }
  if (!Number.isFinite(q)) return { value: 0, text: `${symbol}0.00` }
  const sign = Math.sign(q) || 1
  const abs = Math.abs(q)
  const usd = abs / getQuotaPerUnit()
  const converted = type === 'USD' ? usd : usd * (rate || 1)
  const value = sign * converted
  const text = `${sign < 0 ? '-' : ''}${symbol}${Math.abs(value).toFixed(digits)}`
  return { value, text }
}

export function formatCount(n) {
  const x = Number(n || 0)
  if (!Number.isFinite(x)) return '0'
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(1) + 'M'
  if (x >= 10_000) return (x / 1_000).toFixed(1) + 'K'
  return x.toLocaleString()
}

// Persist relevant fields from /api/status so renderers reading localStorage
// (like getCurrencyConfig) have the right context.
export function persistStatusFields(status) {
  if (!status || typeof status !== 'object') return
  try {
    localStorage.setItem('status', JSON.stringify(status))
    if (status.quota_per_unit != null) {
      localStorage.setItem('quota_per_unit', String(status.quota_per_unit))
    }
    if (status.quota_display_type != null) {
      localStorage.setItem('quota_display_type', String(status.quota_display_type))
    }
    if (status.display_in_currency != null) {
      localStorage.setItem('display_in_currency', String(status.display_in_currency))
    }
  } catch (_) {}
}
