import React, { useEffect, useState } from 'react'
import { BrainCircuit, Cpu, Zap, Info } from 'lucide-react'
import { api, pct } from '../api.js'

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
    if (autoLoad && accountId) load()
  }, [accountId, autoLoad])

  if (error) return <div className="error">Kernel SHAP calculation failed: {error}</div>

  if (!shap) {
    return (
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BrainCircuit className="card-header-icon" size={18} />
            <span>Kernel SHAP Local Feature Attribution</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Run exact Shapley Value estimation on the trained binary GraphSAGE model against the reference low-risk training baseline profile.
        </p>

        <button className="btn btn-primary" onClick={load} disabled={loading}>
          <Zap size={14} /> {loading ? 'Evaluating Kernel SHAP (Server Cache)...' : 'Compute SHAP Attribution'}
        </button>

        {loading && (
          <div className="loading-state" style={{ padding: '24px 0' }}>
            <div className="spinner-ring" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Executing 300 background Monte-Carlo permutations — results cached server-side...
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
          <span>Kernel SHAP Local Feature Attribution (GraphSAGE)</span>
        </div>
        {seconds && <span className="meta-chip"><Zap size={12} /> Computed in {seconds}s</span>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="meta-chip">
          <span>Baseline Reference P(Low): <strong>{shap.base_value.toFixed(4)}</strong></span>
        </div>
        <div className="meta-chip highlight">
          <span>Predicted P(High Risk): <strong>{shap.high_risk_probability.toFixed(4)}</strong></span>
        </div>
        <div className="meta-chip">
          <span>Additivity Gap: <strong>{shap.additivity_gap.toFixed(6)}</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {shap.features.map((f) => {
          const widthPct = (100 * Math.abs(f.shap_value)) / maxAbs
          const isPositive = f.shap_value >= 0

          return (
            <div key={f.feature} className="bar-row-grid">
              <span className="bar-row-label">{f.feature}</span>
              <div style={{ display: 'flex', height: 14, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {!isPositive && (
                    <div style={{ width: `${widthPct}%`, backgroundColor: '#6FA8DC', borderRadius: 'var(--radius-full)' }} />
                  )}
                </div>
                <div style={{ width: 2, backgroundColor: 'var(--border-bright)' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  {isPositive && (
                    <div style={{ width: `${widthPct}%`, backgroundColor: '#E05A5A', borderRadius: 'var(--radius-full)' }} />
                  )}
                </div>
              </div>
              <span className="mono" style={{ textAlign: 'right', fontSize: 12, color: isPositive ? 'var(--risk-high)' : 'var(--privacy-cyan)' }}>
                {isPositive ? '+' : ''}{f.shap_value.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, backgroundColor: '#E05A5A', borderRadius: 2 }} />
          <span>Red: Pushes towards Liquidation Risk</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, backgroundColor: '#6FA8DC', borderRadius: 2 }} />
          <span>Cyan: Pushes towards Low Risk Stability</span>
        </div>
      </div>
    </div>
  )
}
