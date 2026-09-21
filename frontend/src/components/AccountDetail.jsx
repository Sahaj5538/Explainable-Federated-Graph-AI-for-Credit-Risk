import React, { useEffect, useState } from 'react'
import { BookOpen, Table2 } from 'lucide-react'
import { api, pct, signed } from '../api.js'
import { humanFeature } from '../labels.js'
import RiskBadge from './RiskBadge.jsx'
import ShapPanel from './ShapPanel.jsx'

// ---------------------------------------------------------------------------
// ACCOUNT DETAIL - full inspection shown inside the modal.
// Verdict header, written analysis, main risk factors, factor attribution
// and the complete behaviour table (human-readable labels).
// ---------------------------------------------------------------------------

function ReasonsBars({ reasons }) {
  const max = Math.max(...reasons.map((r) => r.reason_score), 1e-9)
  return (
    <div>
      <div className="card-header-title" style={{ marginBottom: 12 }}>
        <span>Main Risk Factors</span>
      </div>
      <div className="bar-chart-stack">
        {reasons.map((r) => (
          <div key={r.feature} className="bar-row-grid">
            <span className="bar-row-label">{humanFeature(r.feature)}</span>
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
          <div className="prob-box-label">Risk Probability</div>
          <div
            className="prob-box-value"
            style={{ color: detail.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--text-primary)' }}
          >
            {pct(detail.high_risk_probability)}
          </div>
        </div>
      </div>

      {/* Written analysis */}
      {detail.narrative && (
        <div className="narrative-inline">
          <div className="card-header-title" style={{ marginBottom: 10 }}>
            <BookOpen size={15} className="card-header-icon" style={{ marginRight: 8 }} />
            <span>Analysis Summary</span>
          </div>
          <div className="narrative-headline">{detail.narrative.headline}</div>
          {detail.narrative.paragraphs.map((p, i) => (
            <p key={i} className="narrative-paragraph">{p}</p>
          ))}
        </div>
      )}

      {/* Reason bars */}
      <ReasonsBars reasons={detail.reasons} />

      {/* Factor attribution */}
      <ShapPanel accountId={accountId} autoLoad />

      {/* Full behaviour table */}
      <div>
        <div className="card-header-title" style={{ marginBottom: 10 }}>
          <Table2 size={15} className="card-header-icon" style={{ marginRight: 8 }} />
          <span>All Behaviours Measured (observation window)</span>
        </div>
        <div className="table-container">
          <table className="vertex-table">
            <thead>
              <tr>
                <th>Behaviour</th>
                <th>Value</th>
                <th>vs safe accounts</th>
                <th>Factor weight</th>
                <th>Model sensitivity</th>
              </tr>
            </thead>
            <tbody>
              {detail.features.map((f) => {
                const r = detail.reasons.find((x) => x.feature === f.feature)
                return (
                  <tr key={f.feature}>
                    <td>{humanFeature(f.feature)}</td>
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
