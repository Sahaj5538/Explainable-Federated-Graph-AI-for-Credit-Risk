import React, { useState } from 'react'
import { ShieldAlert, ArrowRight, RefreshCw, BrainCircuit, BookOpen } from 'lucide-react'
import { api, pct, shortenAddress } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'
import ShapPanel from '../components/ShapPanel.jsx'

// ---------------------------------------------------------------------------
// CREDIT RISK - run a prediction, then read it two ways:
//   1. a plain-English narrative (server-generated) for humans
//   2. the Kernel SHAP attribution chart for the technically minded
// ---------------------------------------------------------------------------

export default function CreditRiskView({ onNavigateTab, onSelectAccount }) {
  const [accountId, setAccountId] = useState('789')
  const [result, setResult] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handlePredictSubmit = async (e) => {
    if (e) e.preventDefault()
    const id = parseInt(accountId, 10)
    if (!Number.isInteger(id)) {
      setError('Please enter a valid numeric Account ID (e.g., 789 or 123)')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    setNarrative(null)
    try {
      const res = await api.predict(id)
      setResult(res)
      // full detail incl. the plain-English explanation
      api.account(id).then((d) => setNarrative(d.narrative)).catch(() => {})
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section-stack">
      {/* Scoring input */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ShieldAlert className="card-header-icon" size={18} />
            <span>Credit Risk Assessment</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Evaluate liquidation probability for any wallet account node.
          Runs real-time inference on the trained binary GraphSAGE model.
        </p>

        <form onSubmit={handlePredictSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="number"
            className="input-field"
            style={{ minWidth: 280 }}
            placeholder="Enter numeric account ID (e.g. 789)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <span>{busy ? 'Evaluating Graph Model...' : 'EXECUTE RISK ASSESSMENT'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {error && (
          <div className="error" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Risk engine unavailable: {error}</span>
            <button className="btn btn-sm" onClick={() => handlePredictSubmit(null)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Verdict */}
          <div className="titanium-card" style={{ borderColor: result.prediction === 'HIGH RISK' ? 'rgba(224, 90, 90, 0.4)' : 'var(--border-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 24, fontWeight: 700 }}>Account #{result.account_id}</h3>
                  <RiskBadge prediction={result.prediction} probability={result.high_risk_probability} />
                </div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Wallet: {shortenAddress(result.wallet)}
                </div>
              </div>

              <div className="prob-box">
                <div className="prob-box-label">Liquidation Probability</div>
                <div
                  className="prob-box-value"
                  style={{ color: result.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--text-primary)' }}
                >
                  {pct(result.high_risk_probability)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Risk triggers (z-score vs low-risk population)
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {result.reasons.map((r) => (
                  <div key={r.feature} className="trigger-chip">
                    <span style={{ color: r.z >= 0 ? 'var(--risk-high)' : 'var(--text-silver)', marginRight: 6 }}>
                      {r.z >= 0 ? '▲' : '▼'}
                    </span>
                    <strong>{r.feature}</strong>{' '}
                    <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                      (z {r.z >= 0 ? '+' : ''}{r.z.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('explainability')}>
                  <BrainCircuit size={14} /> Deep Explanation
                </button>
                {onSelectAccount && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onSelectAccount(result.account_id)}>
                    View Full Account Inspection →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Plain-English narrative */}
          {narrative && (
            <div className="titanium-card narrative-card">
              <div className="card-header">
                <div className="card-header-title">
                  <BookOpen className="card-header-icon" size={18} />
                  <span>What this means, in plain English</span>
                </div>
              </div>
              <div className="narrative-headline">{narrative.headline}</div>
              {narrative.paragraphs.map((p, i) => (
                <p key={i} className="narrative-paragraph">{p}</p>
              ))}
            </div>
          )}

          {/* SHAP attribution */}
          <ShapPanel accountId={result.account_id} autoLoad />
        </>
      )}
    </div>
  )
}
