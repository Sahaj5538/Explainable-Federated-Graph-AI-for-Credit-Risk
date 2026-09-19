import React, { useState } from 'react'
import { ShieldAlert, Cpu, ArrowRight, CheckCircle, AlertTriangle, BrainCircuit, RefreshCw } from 'lucide-react'
import { api, pct, shortenAddress } from '../api.js'
import RiskBadge from '../components/RiskBadge.jsx'
import ShapPanel from '../components/ShapPanel.jsx'

export default function CreditRiskView({ onNavigateTab, onSelectAccount }) {
  const [accountId, setAccountId] = useState('789')
  const [result, setResult] = useState(null)
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
    try {
      const res = await api.predict(id)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="section-stack">
      {/* Search / Scoring Input Form */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ShieldAlert className="card-header-icon" size={18} />
            <span>Vertex Credit Risk Engine (`POST /api/predict`)</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Evaluate credit solvency and liquidation probability for registered wallet account nodes. Runs real-time inference on the trained binary GraphSAGE model.
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
            <span>Vertex Risk Engine unavailable: {error}</span>
            <button className="btn btn-sm" onClick={() => handlePredictSubmit(null)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Assessment Output Display */}
      {result && (
        <>
          <div className="titanium-card" style={{ borderColor: result.prediction === 'HIGH RISK' ? 'rgba(224, 90, 90, 0.4)' : 'rgba(32, 201, 151, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 24, fontWeight: 700 }}>Account #{result.account_id}</h3>
                  <RiskBadge prediction={result.prediction} probability={result.high_risk_probability} />
                </div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Wallet Address: {shortenAddress(result.wallet)}
                </div>
              </div>

              {/* Liquidation Meter */}
              <div style={{ padding: '16px 28px', backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Liquidation Probability
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 700, color: result.prediction === 'HIGH RISK' ? 'var(--risk-high)' : 'var(--risk-low)' }}>
                  {pct(result.high_risk_probability)}
                </div>
              </div>
            </div>

            {/* Positive & Risk Factors Breakdown */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, uppercase: true, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Evaluated Risk Triggers (z-score vs LOW-RISK mean):
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {result.reasons.map((r) => (
                  <div
                    key={r.feature}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: 'var(--obsidian-deep)',
                      border: '1px solid var(--border-bright)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12.5,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span style={{ color: r.z >= 0 ? 'var(--risk-high)' : 'var(--accent-emerald)', marginRight: 6 }}>
                      {r.z >= 0 ? '⚠' : '✓'}
                    </span>
                    <strong>{r.feature}</strong> <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                      (z {r.z >= 0 ? '+' : ''}{r.z.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('explainability')}>
                  <BrainCircuit size={14} /> View Explanation
                </button>
                {onSelectAccount && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onSelectAccount(result.account_id)}>
                    View Full Account Inspection →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Local SHAP Feature Attribution Panel */}
          <ShapPanel accountId={result.account_id} autoLoad />
        </>
      )}
    </div>
  )
}
