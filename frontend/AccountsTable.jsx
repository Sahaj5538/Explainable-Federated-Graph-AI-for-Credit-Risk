import React, { useEffect, useState } from 'react'
import { api, pct } from '../api.js'

// Accounts tab: searchable / filterable / paginated table of all
// accounts with their prediction and top reason chips. Clicking a
// row opens the full explanation below (handled by the parent).

export default function AccountsTable({ onSelect }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setData(null)
    api
      .accounts({ search: query, risk, page, page_size: 20 })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [query, risk, page])

  const badge = (prediction) =>
    prediction === 'HIGH RISK' ? 'badge high' : 'badge low'

  return (
    <div className="stack">
      <div className="toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setQuery(search)
          }}
        >
          <input
            placeholder="Search wallet, account id or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <select
          value={risk}
          onChange={(e) => {
            setRisk(e.target.value)
            setPage(1)
          }}
        >
          <option value="all">All accounts</option>
          <option value="high">Predicted HIGH RISK</option>
          <option value="low">Predicted LOW RISK</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="loading">Loading…</div>}

      {data && (
        <>
          <table className="accounts">
            <thead>
              <tr>
                <th>ID</th>
                <th>Wallet</th>
                <th>Client</th>
                <th>Prediction</th>
                <th>P(HIGH)</th>
                <th>Top reasons (z vs LOW-RISK)</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr
                  key={a.account_id}
                  onClick={() => onSelect(a.account_id)}
                  title="Click for the full explanation"
                >
                  <td>{a.account_id}</td>
                  <td className="mono">{a.wallet}</td>
                  <td>{a.client}</td>
                  <td>
                    <span className={badge(a.prediction)}>
                      {a.prediction}
                    </span>
                  </td>
                  <td className="mono">{a.high_risk_probability.toFixed(4)}</td>
                  <td>
                    {a.reasons.map((r) => (
                      <span className="chip" key={r.feature}>
                        {r.feature}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ← Prev
            </button>
            <span>
              page {data.page} / {data.pages} · {data.total} accounts
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
