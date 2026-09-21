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
  network: () => getJson('/api/network'),
  whatifContext: (accountId) => getJson(`/api/whatif/${accountId}/context`),
  whatif: (accountId, overrides) =>
    postJson('/api/whatif', { account_id: accountId, overrides }),
  resolve: (q) => getJson(`/api/resolve?q=${encodeURIComponent(q)}`),
}

// Accepts a numeric account ID or a 0x wallet address; returns the numeric ID.
export async function resolveAccount(raw) {
  const q = String(raw || '').trim()
  if (!q) throw new Error('Please enter an account ID or a wallet address')
  if (/^-?\d+$/.test(q)) return parseInt(q, 10)
  if (q.toLowerCase().startsWith('0x')) {
    const r = await api.resolve(q)
    return r.account_id
  }
  throw new Error('Enter a numeric account ID or a wallet address starting with 0x')
}

// The network payload (~1000 accounts + edges) is fetched once per session and
// shared by every consumer (the 3D graph, the dashboard chips, the per-account
// transaction graph).
let networkPromise = null
export function getNetwork() {
  if (!networkPromise) networkPromise = api.network()
  return networkPromise
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
