import React, { useEffect, useState } from 'react'
import { BrainCircuit, Search, BookOpen, GitCompare } from 'lucide-react'
import { api, pct, resolveAccount } from '../api.js'
import { humanFeature, riskBand } from '../labels.js'
import ShapPanel from '../components/ShapPanel.jsx'
import RiskBadge from '../components/RiskBadge.jsx'

// ---------------------------------------------------------------------------
// XAI — DEEP EXPLANATION OF A PREDICTION
//
// Search any account and get the full, readable breakdown:
//   1. Risk Summary          — the written analysis
//   2. Comparison vs safe    — how far each behaviour sits from the typical
//                              low-risk account
//   3. What moved the score  — factor attribution (red = raises, silver = lowers)
//   4. What matters overall  — which factors the model relies on most across
//                              all accounts (lollipop chart)
//
// The search field starts EMPTY (placeholder example, like an email field),
// is always freely editable, and "Deep Explanation" from the Credit Risk view
// loads exactly the account that was analysed there.
// ---------------------------------------------------------------------------

function ZScoreComparison({ reasons }) {
  // account-detail reasons use z_vs_low_risk; predict reasons use z
  const zOf = (r) => (r.z_vs_low_risk != null ? r.z_vs_low_risk : r.z != null ? r.z : 0)
  const maxZ = Math.max(...reasons.map((r) => Math.abs(zOf(r))), 1e-9)
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {reasons.map((r) => {
          const z = zOf(r)
          const widthPct = (100 * Math.abs(z)) / maxZ
          const risky = z >= 0
          return (
            <div key={r.feature} className="bar-row-grid">
              <span className="bar-row-label">{humanFeature(r.feature)}</span>
              <div className="shap-track">
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {!risky && <div style={{ width: `${widthPct}%`, backgroundColor: '#8B98A5', borderRadius: 'var(--radius-full)' }} />}
                </div>
                <div style={{ width: 2, backgroundColor: 'var(--border-bright)' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  {risky && <div style={{ width: `${widthPct}%`, backgroundColor: '#E05A5A', borderRadius: 'var(--radius-full)' }} />}
                </div>
              </div>
              <span className="mono" style={{ textAlign: 'right', fontSize: 12, color: risky ? 'var(--risk-high)' : 'var(--text-silver)' }}>
                {z >= 0 ? '+' : ''}{z.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="muted small" style={{ marginTop: 12 }}>
        How far each behaviour sits from the average safe account — to the right means
        riskier than typical, to the left means safer than typical.
      </div>
    </div>
  )
}

function ImportanceLollipop({ features }) {
  const maxVal = Math.max(...features.map((f) => f.importance_drop), 0.0001)
  const W = 720
  const labelW = 240
  const valW = 70
  const trackW = W - labelW - valW
  const rowH = 38

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${features.length * rowH + 16}`} style={{ maxWidth: W }}>
      {features.map((f, i) => {
        const y = 20 + i * rowH
        const x = labelW + (Math.max(f.importance_drop, 0) / maxVal) * trackW
        return (
          <g key={f.feature}>
            <text x={labelW - 12} y={y + 4} fill="#929CA3" fontSize={11.5} textAnchor="end">
              {humanFeature(f.feature)}
            </text>
            <line x1={labelW} x2={labelW + trackW} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <line x1={labelW} x2={x} y1={y} y2={y} stroke="#929CA3" strokeWidth={2} />
            <circle cx={x} cy={y} r={5.5} fill={i === 0 ? '#F2F6F9' : '#C9D2D9'} stroke="#080A0C" strokeWidth={1.5} />
            <text x={W - 8} y={y + 4} fill="#E9EEF1" fontSize={11} textAnchor="end" className="mono">
              {f.importance_drop.toFixed(4)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ExplainabilityView({ focusAccountId, onSelectAccount }) {
  const [input, setInput] = useState(focusAccountId != null ? String(focusAccountId) : '')
  const [loadedId, setLoadedId] = useState(focusAccountId != null ? focusAccountId : null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [importance, setImportance] = useState(null)

  useEffect(() => {
    api.importance().then(setImportance).catch(() => {})
  }, [])

  const load = (id) => {
    setLoadedId(id)
    setDetail(null)
    setError(null)
    api.account(id)
      .then(setDetail)
      .catch((e) => setError(e.message))
  }

  // "Deep Explanation" handoff from the Credit Risk view
  useEffect(() => {
    if (focusAccountId != null) {
      setInput(String(focusAccountId))
      load(focusAccountId)
    }
  }, [focusAccountId])

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    try {
      const id = await resolveAccount(input)
      load(id)
    } catch (err) {
      setError(err.message)
    }
  }

  const band = detail ? riskBand(detail.high_risk_probability) : null
  const sortedReasons = detail
    ? [...detail.reasons].sort((a, b) => b.reason_score - a.reason_score)
    : []
  const top = sortedReasons[0]
  const protective = sortedReasons.find(
    (r) => (r.z_vs_low_risk != null ? r.z_vs_low_risk : r.z != null ? r.z : 0) <= -0.5
  )

  return (
    <div className="section-stack">
      {/* Search */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BrainCircuit className="card-header-icon" size={18} />
            <span>Explain a Prediction</span>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
          Enter any account to see the full breakdown of its risk score — the written
          analysis, how it compares to safe accounts, and exactly which factors moved the score.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            style={{ minWidth: 300 }}
            placeholder="Enter account ID or wallet — e.g., 789 or 0x1f2a…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
            <Search size={14} /> Explain This Account
          </button>
        </form>
        {error && <div className="error" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {detail && (
        <>
          {/* 1. Risk Summary */}
          <div className="titanium-card narrative-card">
            <div className="card-header">
              <div className="card-header-title">
                <BookOpen className="card-header-icon" size={18} />
                <span>Risk Summary — Account #{detail.account_id}</span>
              </div>
              <RiskBadge prediction={detail.prediction} probability={detail.high_risk_probability} />
            </div>
            {detail.narrative && (
              <>
                <div className="narrative-headline">{detail.narrative.headline}</div>
                {detail.narrative.paragraphs.map((p, i) => (
                  <p key={i} className="narrative-paragraph">{p}</p>
                ))}
              </>
            )}
            {top && (
              <p className="narrative-paragraph" style={{ borderLeft: '2px solid var(--border-bright)', paddingLeft: 14 }}>
                <strong>Bottom line:</strong> the model places this account in the{' '}
                <strong style={{ color: band.color === '#F2F6F9' ? 'var(--text-primary)' : band.color }}>
                  {band.label}
                </strong>{' '}
                band with a {pct(detail.high_risk_probability)} risk probability. The single biggest
                influence is {humanFeature(top.feature).toLowerCase()}
                {protective
                  ? `; the strongest factor working in its favour is ${humanFeature(protective.feature).toLowerCase()}.`
                  : '.'}
              </p>
            )}
          </div>

          {/* 2. Comparison vs typical safe accounts */}
          <div className="titanium-card">
            <div className="card-header">
              <div className="card-header-title">
                <GitCompare className="card-header-icon" size={18} />
                <span>How This Account Compares to Safe Accounts</span>
              </div>
            </div>
            <ZScoreComparison reasons={detail.reasons} />
          </div>

          {/* 3. Factor attribution */}
          <ShapPanel accountId={loadedId} autoLoad />
        </>
      )}

      {/* 4. Global importance */}
      {importance && (
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <BrainCircuit className="card-header-icon" size={18} />
              <span>Which Factors Matter Most Across All Accounts</span>
            </div>
          </div>
          <ImportanceLollipop features={importance.features} />
          <div className="muted small" style={{ marginTop: 12 }}>
            How much the overall model weakens when one factor is hidden from it —
            longer lines mean the model relies on it more.
          </div>
        </div>
      )}
    </div>
  )
}
