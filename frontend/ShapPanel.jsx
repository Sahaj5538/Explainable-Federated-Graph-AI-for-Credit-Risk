import React, { useEffect, useState } from 'react'
import { api, pct } from '../api.js'

// Diverging SHAP bar chart (red pushes towards HIGH RISK, blue
// towards LOW RISK) + the reference/base value and additivity gap.
// Used both from the account detail view and the predict tab.

export default function ShapPanel({ accountId, autoLoad = false }) {
  const [shap, setShap] = useState(null)
  const [error, setError] = useState(null)
  const [seconds, setSeconds] = useState(null)

  const load = () => {
    setShap(null)
    setError(null)
    setSeconds(null)
    const started = performance.now()
    api
      .shap(accountId)
      .then((s) => {
        setSeconds(((performance.now() - started) / 1000).toFixed(1))
        setShap(s)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    if (autoLoad) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, autoLoad])

  if (error) return <div className="error">SHAP failed: {error}</div>

  if (!shap) {
    return (
      <div className="card">
        <div className="card-title">SHAP explanation (Kernel SHAP on GraphSAGE)</div>
        <button className="primary" onClick={load} disabled={autoLoad}>
          {autoLoad ? 'Computing SHAP values…' : 'Compute SHAP values'}
        </button>
        {autoLoad && <div className="loading">
          running Kernel SHAP — first computation takes a few
          seconds, results are cached server-side…
        </div>}
      </div>
    )
  }

  const maxAbs = Math.max(
    ...shap.features.map((f) => Math.abs(f.shap_value)),
    1e-9,
  )

  return (
    <div className="card">
      <div className="card-title">SHAP explanation (Kernel SHAP on GraphSAGE)</div>
      <div className="shap-meta">
        <span>
          reference (LOW-RISK profile) P ={' '}
          <b className="mono">{shap.base_value.toFixed(4)}</b>
        </span>
        <span>
          prediction P ={' '}
          <b className="mono">{shap.high_risk_probability.toFixed(4)}</b>
        </span>
        <span>
          additivity gap ={' '}
          <b className="mono">{shap.additivity_gap.toFixed(6)}</b>
        </span>
        {seconds && <span className="muted">computed in {seconds}s</span>}
      </div>

      <div className="shap-chart">
        {shap.features.map((f) => {
          const width = (100 * Math.abs(f.shap_value)) / maxAbs
          return (
            <div className="shap-row" key={f.feature}>
              <span className="bar-label">{f.feature}</span>
              <div className="shap-track">
                <div className="shap-half left">
                  {f.shap_value < 0 && (
                    <div className="shap-fill neg" style={{ width: `${width}%` }} />
                  )}
                </div>
                <div className="shap-half right">
                  {f.shap_value >= 0 && (
                    <div className="shap-fill pos" style={{ width: `${width}%` }} />
                  )}
                </div>
              </div>
              <span className="bar-value mono">
                {f.shap_value >= 0 ? '+' : ''}
                {f.shap_value.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="legend">
        <span className="dot pos" /> pushes towards HIGH RISK
        <span className="dot neg" /> pushes towards LOW RISK
      </div>
    </div>
  )
}
