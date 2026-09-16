import React, { useEffect, useState } from 'react'
import { api, pct, signed } from '../api.js'
import ShapPanel from './ShapPanel.jsx'

// Full per-account explanation from GET /api/accounts/{id}:
// prediction header, reason scores (z x importance), the full
// feature table and the on-demand SHAP panel.

function ReasonsBars({ reasons }) {
  const max = Math.max(...reasons.map((r) => r.reason_score), 1e-9)
  return (
    <div className="card">
      <div className="card-title">
        Why this prediction — reason scores (|z vs LOW-RISK| × importance)
      </div>
      <div className="bars">
        {reasons.map((r) => (
          <div className="bar-row" key={r.feature}>
            <span className="bar-label">{r.feature}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(100 * r.reason_score) / max}%` }}
              />
            </div>
            <span className="bar-value mono">
              {r.reason_score.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
      <div className="muted small">
        value z-scores vs the LOW-RISK population; gradient attribution
        (Integrated-Gradients-style) shown per feature below.
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
  if (!detail) return <div className="loading">Loading account…</div>

  const correct = detail.actual_label === detail.prediction

  return (
    <div className="stack">
      <div className="card detail-head">
        <div>
          <div className="detail-title">
            Account {detail.account_id}{' '}
            <span className="mono muted">{detail.wallet}</span>
          </div>
          <div className="muted">
            federated client: <b>{detail.client}</b>
          </div>
          <div className="muted">
            actual label:{' '}
            <span className={detail.actual_label === 'HIGH RISK' ? 'text-high' : 'text-low'}>
              {detail.actual_label}
            </span>{' '}
            · model:{' '}
            <span className={detail.prediction === 'HIGH RISK' ? 'text-high' : 'text-low'}>
              {detail.prediction}
            </span>{' '}
            ({correct ? 'correct' : 'misclassified'})
          </div>
        </div>
        <div className="prob-box">
          <div className="prob-number">
            {pct(detail.high_risk_probability)}
          </div>
          <div className="muted">P(HIGH RISK)</div>
        </div>
        {onClose && (
          <button className="ghost" onClick={onClose}>✕ close</button>
        )}
      </div>

      <ReasonsBars reasons={detail.reasons} />

      <ShapPanel accountId={accountId} />

      <div className="card">
        <div className="card-title">All features (observation window)</div>
        <table className="features">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Value</th>
              <th>z vs LOW-RISK</th>
              <th>Reason score</th>
              <th>Gradient attribution</th>
            </tr>
          </thead>
          <tbody>
            {detail.features.map((f) => (
              <tr key={f.feature}>
                <td>{f.feature}</td>
                <td className="mono">{f.value.toFixed(4)}</td>
                <td className="mono">{signed(f.z, 2)}</td>
                <td className="mono">
                  {(() => {
                    const r = detail.reasons.find(
                      (x) => x.feature === f.feature,
                    )
                    return r ? r.reason_score.toFixed(3) : '—'
                  })()}
                </td>
                <td className="mono">
                  {(() => {
                    const r = detail.reasons.find(
                      (x) => x.feature === f.feature,
                    )
                    return r && r.gradient_attribution !== null
                      ? signed(r.gradient_attribution, 4)
                      : '—'
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
