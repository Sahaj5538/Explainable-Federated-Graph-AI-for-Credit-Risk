import React, { useEffect, useState } from 'react'
import { BrainCircuit, Zap } from 'lucide-react'
import { api, pct } from '../api.js'
import { humanFeature } from '../labels.js'

// ---------------------------------------------------------------------------
// WHAT MOVED THIS SCORE
//
// Per-factor attribution for one account. Each bar shows how much that single
// factor pushed the risk estimate up (red, to the right) or down (silver, to
// the left). Labels are human-readable; the underlying method is exact
// Shapley-value attribution, so every contribution adds up to the final score.
// ---------------------------------------------------------------------------

export default function ShapPanel({ accountId, autoLoad = false }) {
  const [shap, setShap] = useState(null)
  const [error, setError] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setShap(null)
    setError(null)
    setSeconds(null)
    setLoading(true)
    const started = performance.now()
    api.shap(accountId)
      .then((s) => {
        setSeconds(((performance.now() - started) / 1000).toFixed(1))
        setShap(s)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (autoLoad && accountId != null) load()
  }, [accountId, autoLoad])

  if (error) return <div className="error">Attribution calculation failed: {error}</div>

  if (!shap) {
    return (
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BrainCircuit className="card-header-icon" size={18} />
            <span>What Moved This Score</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Measures the exact contribution of every factor to this account's risk score.
        </p>

        <button className="btn btn-primary" onClick={load} disabled={loading}>
          <Zap size={14} /> {loading ? 'Computing attribution…' : 'Compute Attribution'}
        </button>

        {loading && (
          <div className="loading-state" style={{ padding: '24px 0' }}>
            <div className="spinner-ring" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Measuring each factor's effect on the score…
            </span>
          </div>
        )}
      </div>
    )
  }

  const maxAbs = Math.max(...shap.features.map((f) => Math.abs(f.shap_value)), 1e-9)

  return (
    <div className="titanium-card">
      <div className="card-header">
        <div className="card-header-title">
          <BrainCircuit className="card-header-icon" size={18} />
          <span>What Moved This Score</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="meta-chip highlight">Risk probability <strong>{pct(shap.high_risk_probability)}</strong></span>
          {seconds && <span className="meta-chip"><Zap size={12} /> {seconds}s</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {shap.features.map((f) => {
          const widthPct = (100 * Math.abs(f.shap_value)) / maxAbs
          const isPositive = f.shap_value >= 0
          return (
            <div key={f.feature} className="bar-row-grid">
              <span className="bar-row-label">{humanFeature(f.feature)}</span>
              <div className="shap-track">
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {!isPositive && (
                    <div style={{ width: `${widthPct}%`, backgroundColor: '#8B98A5', borderRadius: 'var(--radius-full)' }} />
                  )}
                </div>
                <div style={{ width: 2, backgroundColor: 'var(--border-bright)' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  {isPositive && (
                    <div style={{ width: `${widthPct}%`, backgroundColor: '#E05A5A', borderRadius: 'var(--radius-full)' }} />
                  )}
                </div>
              </div>
              <span className="mono" style={{ textAlign: 'right', fontSize: 12, color: isPositive ? 'var(--risk-high)' : 'var(--text-silver)' }}>
                {isPositive ? '+' : ''}{f.shap_value.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, backgroundColor: '#E05A5A', borderRadius: 2 }} />
          <span>Raises the risk score</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, backgroundColor: '#8B98A5', borderRadius: 2 }} />
          <span>Lowers the risk score</span>
        </div>
      </div>
    </div>
  )
}
