import React, { useEffect, useState } from 'react'
import { Search, Filter, Wallet, ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { api, shortenAddress, pct } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'

export default function WalletIntelligenceView({ onSelectAccount }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.accounts({ search: query, risk, page, page_size: 20 })
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [query, risk, page])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    setQuery(search)
  }

  return (
    <div className="section-stack">
      {/* Search & Filter Toolbar */}
      <div className="titanium-card">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} className="text-secondary" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                className="input-field"
                style={{ width: '100%', paddingLeft: 38 }}
                placeholder="Search by wallet address (0x...), account ID, or institution client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={16} className="text-secondary" />
            <select
              className="select-field"
              value={risk}
              onChange={(e) => {
                setRisk(e.target.value)
                setPage(1)
              }}
            >
              <option value="all">All Risk Categories</option>
              <option value="high">Predicted HIGH Risk Only</option>
              <option value="low">Predicted LOW Risk Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account Data Table */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Wallet className="card-header-icon" size={18} />
            <span>Network Wallet Registry ({data?.total || 0} Accounts)</span>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {loading ? (
          <div className="loading-state"><div className="spinner-ring" /><span>Loading Wallets…</span></div>
        ) : (
          <div className="table-container">
            <table className="vertex-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Wallet Address</th>
                  <th>Institution Client</th>
                  <th>Risk Classification</th>
                  <th>P(High Risk)</th>
                  <th>Primary Risk Triggers</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.accounts.map((acc) => (
                  <tr key={acc.account_id} className="clickable" onClick={() => onSelectAccount(acc.account_id)}>
                    <td className="mono" style={{ fontWeight: 600 }}>#{acc.account_id}</td>
                    <td className="mono" style={{ color: 'var(--text-secondary)' }}>{shortenAddress(acc.wallet)}</td>
                    <td style={{ fontWeight: 500 }}>{acc.client}</td>
                    <td><RiskBadge prediction={acc.prediction} probability={acc.high_risk_probability} /></td>
                    <td className="mono" style={{ fontWeight: 600, color: acc.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--text-primary)' }}>
                      {pct(acc.high_risk_probability)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {acc.reasons.slice(0, 2).map((r) => (
                          <span
                            key={r.feature}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--obsidian-deep)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {r.feature}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onSelectAccount(acc.account_id) }}>
                        <Eye size={14} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {data && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Showing Page <strong>{data.page}</strong> of <strong>{data.pages}</strong> ({data.total} total accounts)
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ArrowLeft size={14} /> Previous
              </button>
              <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
