// Thin API client - all calls are same-origin (production: served by
// FastAPI; development: proxied to http://127.0.0.1:8000 by Vite).

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
  stats: () => getJson('/api/stats'),
  accounts: (params) =>
    getJson(`/api/accounts?${new URLSearchParams(params).toString()}`),
  account: (accountId) => getJson(`/api/accounts/${accountId}`),
  shap: (accountId) => getJson(`/api/shap/${accountId}`),
  predict: (accountId) => postJson('/api/predict', { account_id: accountId }),
}

export const pct = (value, digits = 1) =>
  `${(100 * (value || 0)).toFixed(digits)}%`

export const signed = (value, digits = 3) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
