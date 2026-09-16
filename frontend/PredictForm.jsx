import React, { useState } from 'react'
import { api, pct } from '../api.js'
import ShapPanel from './ShapPanel.jsx'

// Predict tab: POST /api/predict for external API clients, then an
// automatic SHAP explanation of the returned decision.

export default function PredictForm() {
  const [accountId, setAccountId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const id = parseInt(accountId, 10)
    if (!Number.isInteger(id)) {
      setError('enter a numeric account id (e.g. 789)')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await api.predict(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Predict (POST /api/predict)</div>
        <p className="muted">
          Scoring endpoint for external API clients: send an account id,
          receive the binary liquidation-risk decision, its probability
          and the top reasons — then the SHAP attribution is fetched
          automatically.
        </p>
        <form onSubmit={submit}>
          <input
            type="number"
            placeholder="account id (e.g. 789)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Predicting…' : 'Predict'}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      {result && (
        <>
          <div className="card detail-head">
            <div>
              <div className="detail-title">
                Account {result.account_id}{' '}
                <span className="mono muted">{result.wallet}</span>
              </div>
              <div className="chips">
                {result.reasons.map((r) => (
                  <span className="chip" key={r.feature}>
                    {r.feature} (z {r.z >= 0 ? '+' : ''}
                    {r.z.toFixed(1)})
                  </span>
                ))}
              </div>
            </div>
            <div className="prob-box">
              <div className="prob-number">{pct(result.high_risk_probability)}</div>
              <div className="muted">P(HIGH RISK)</div>
            </div>
          </div>
          <ShapPanel accountId={result.account_id} autoLoad />
        </>
      )}
    </div>
  )
}
