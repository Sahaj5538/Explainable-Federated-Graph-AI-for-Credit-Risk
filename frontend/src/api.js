// API Client for VERTEX — Graph Credit Intelligence
// Same-origin calls served directly by FastAPI or proxied by Vite in dev mode.

async function getJson(path) {
  const response = await fetch(path)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error((body && body.detail) || `Request failed (${response.status})`)
  }
  return response.json()
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error((body && body.detail) || `Request failed (${response.status})`)
  }
  return response.json()
}

export const api = {
  health: () => getJson('/api/health'),
  stats: () => getJson('/api/stats'),
  importance: () => getJson('/api/importance'),
  accounts: (params = {}) =>
    getJson(`/api/accounts?${new URLSearchParams(params).toString()}`),
  account: (accountId) => getJson(`/api/accounts/${accountId}`),
  shap: (accountId) => getJson(`/api/shap/${accountId}`),
  predict: (accountId) => postJson('/api/predict', { account_id: accountId }),
  modelPerformance: () => getJson('/api/model-performance'),
}

export const pct = (value, digits = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '0.0%'
  return `${(100 * value).toFixed(digits)}%`
}

export const signed = (value, digits = 3) => {
  if (value === null || value === undefined || isNaN(value)) return '0.000'
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

export const shortenAddress = (addr) => {
  if (!addr || typeof addr !== 'string') return '-'
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0'
  return new Intl.NumberFormat().format(val)
}
