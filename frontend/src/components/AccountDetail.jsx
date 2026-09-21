import React, { useEffect, useState } from 'react'
import { BookOpen, Table2 } from 'lucide-react'
import { api, pct, signed } from '../api.js'
import RiskBadge from './RiskBadge.jsx'
import ShapPanel from './ShapPanel.jsx'

// ---------------------------------------------------------------------------
// ACCOUNT DETAIL - full inspection shown inside the modal.
// VERTEX-styled: verdict header, plain-English narrative, reason bars and
// the complete feature table, plus the SHAP panel.
// ---------------------------------------------------------------------------

function ReasonsBars({ reasons }) {
  const max = Math.max(...reasons.map((r) => r.reason_score), 1e-9)
  return (
    <div>
      <div className="card-header-title" style={{ marginBottom: 12 }}>
        <span>Why this prediction — reason scores (|z| × importance)</span>
      </div>
      <div className="bar-chart-stack">
        {reasons.map((r) => (
          <div key={r.feature} className="bar-row-grid">
            <span className="bar-row-label">{r.feature}</span>
            <div className="bar-track-bg">
              <div className="bar-fill-silver" style={{ width: `${(100 * r.reason_score) / max}%` }} />
            </div>
            <span className="bar-row-val mono">{r.reason_score.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AccountDetail({ accountId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    api
      .account(accountId)
      .then(setDetail)
      .catch((e) => setError(e.message))
  }, [accountId])

  if (error) return <div className="error">Could not load account: {error}</div>
  if (!detail) return <div className="loading-state"><div className="spinner-ring" /><span>Loading account…</span></div>

  return (
    <div className="account-detail-stack">
      {/* Verdict header */}
      <div className="detail-head">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700 }}>Account #{detail.account_id}</h3>
            <RiskBadge prediction={detail.prediction} probability={detail.high_risk_probability} />
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            {detail.wallet}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
            client: <strong>{detail.client}</strong> · actual outcome:{' '}
            <strong style={{ color: detail.actual_label === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--text-primary)' }}>
              {detail.actual_label}
            </strong>
          </div>
        </div>

        <div className="prob-box">
          <div className="prob-box-label">P(Liquidation)</div>
          <div
            className="prob-box-value"
            style={{ color: detail.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--text-primary)' }}
          >
            {pct(detail.high_risk_probability)}
          </div>
        </div>
      </div>

      {/* Plain-English explanation */}
      {detail.narrative && (
        <div className="narrative-inline">
          <div className="card-header-title" style={{ marginBottom: 10 }}>
            <BookOpen size={15} className="card-header-icon" style={{ marginRight: 8 }} />
            <span>Plain-English explanation</span>
          </div>
          <div className="narrative-headline">{detail.narrative.headline}</div>
          {detail.narrative.paragraphs.map((p, i) => (
            <p key={i} className="narrative-paragraph">{p}</p>
          ))}
        </div>
      )}

      {/* Reason bars */}
      <ReasonsBars reasons={detail.reasons} />

      {/* SHAP */}
      <ShapPanel accountId={accountId} autoLoad />

      {/* Full feature table */}
      <div>
        <div className="card-header-title" style={{ marginBottom: 10 }}>
          <Table2 size={15} className="card-header-icon" style={{ marginRight: 8 }} />
          <span>All features (observation window)</span>
        </div>
        <div className="table-container">
          <table className="vertex-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Value</th>
                <th>z vs low-risk</th>
                <th>Reason score</th>
                <th>Gradient attribution</th>
              </tr>
            </thead>
            <tbody>
              {detail.features.map((f) => {
                const r = detail.reasons.find((x) => x.feature === f.feature)
                return (
                  <tr key={f.feature}>
                    <td>{f.feature}</td>
                    <td className="mono">{f.value.toFixed(4)}</td>
                    <td className="mono">{signed(f.z, 2)}</td>
                    <td className="mono">{r ? r.reason_score.toFixed(3) : '—'}</td>
                    <td className="mono">
                      {r && r.gradient_attribution !== null ? signed(r.gradient_attribution, 4) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
