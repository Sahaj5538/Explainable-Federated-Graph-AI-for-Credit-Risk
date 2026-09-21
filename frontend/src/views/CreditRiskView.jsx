import React, { useState } from 'react'
import { ShieldAlert, ArrowRight, RefreshCw, BrainCircuit, BookOpen, Share2 } from 'lucide-react'
import { api, getNetwork, pct, shortenAddress, resolveAccount } from '../api.js'
import { humanFeature, riskBand, creditScore, RISK_BANDS } from '../labels.js'
import RiskBadge from '../components/RiskBadge.jsx'
import ShapPanel from '../components/ShapPanel.jsx'
import WhatIfPanel from '../components/WhatIfPanel.jsx'

// ---------------------------------------------------------------------------
// CREDIT RISK ANALYSIS
//
// Score any account the way traditional credit risk does:
//   * a 300-900 credit score on a gauge with risk bands
//   * the risk probability
//   * the key factors in plain language
//   * a written analysis (server narrative)
//   * this account's own transaction network - who it transacts with and
//     which of those accounts are flagged high risk
//   * the factor attribution chart (what moved the score)
// ---------------------------------------------------------------------------

// ---- traditional credit-score gauge --------------------------------------

function ScoreGauge({ probability }) {
  const score = creditScore(probability)
  const band = riskBand(probability)
  const cx = 170
  const cy = 162
  const r = 126

  const point = (deg, rad) => [
    cx + rad * Math.cos((deg * Math.PI) / 180),
    cy - rad * Math.sin((deg * Math.PI) / 180),
  ]
  const arc = (deg0, deg1) => {
    const [x0, y0] = point(deg0, r)
    const [x1, y1] = point(deg1, r)
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
  }
  // probability -> angle on the arc (p=0 far left, p=1 far right)
  const degOf = (p) => 180 * (1 - p)

  // band segments, worst (left) to best (right)
  const segments = [
    [1.0, 0.85, RISK_BANDS[0].color], // high
    [0.85, 0.65, RISK_BANDS[1].color], // elevated
    [0.65, 0.35, RISK_BANDS[2].color], // moderate
    [0.35, 0.0, RISK_BANDS[3].color], // low
  ]

  const needleDeg = degOf(probability)
  const [nx, ny] = point(needleDeg, r - 20)
  const [tx, ty] = point(needleDeg, r + 18)

  return (
    <div className="gauge-wrap">
      <svg width="100%" viewBox="0 0 340 210" style={{ maxWidth: 340 }}>
        {segments.map(([p0, p1, color], i) => (
          <path
            key={i}
            d={arc(degOf(p0), degOf(p1))}
            stroke={color}
            strokeWidth={13}
            fill="none"
            strokeLinecap="butt"
            opacity={0.9}
          />
        ))}
        {[0, 0.5, 1].map((p) => {
          const [lx, ly] = point(degOf(p), r + 16)
          return (
            <text key={p} x={lx} y={ly + 4} fill="#616B74" fontSize={10} textAnchor="middle" className="mono">
              {creditScore(p)}
            </text>
          )
        })}
        {/* needle */}
        <line x1={nx} y1={ny} x2={tx} y2={ty} stroke="#F2F6F9" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#F2F6F9" />
        {/* score */}
        <text x={cx} y={cy - 38} textAnchor="middle" fill="#F2F6F9" fontSize={44} fontWeight={700} className="mono">
          {score}
        </text>
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#616B74" fontSize={10} letterSpacing="0.12em">
          CREDIT SCORE
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" fill={band.color === '#F2F6F9' ? '#C9D2D9' : band.color} fontSize={13} fontWeight={700} letterSpacing="0.08em">
          {band.label.toUpperCase()}
        </text>
        <text x={cx} y={cy + 50} textAnchor="middle" fill="#8B98A5" fontSize={11.5}>
          risk probability {pct(probability)}
        </text>
      </svg>
    </div>
  )
}

// ---- this account's transaction network (ego graph) -----------------------

function AccountNetworkGraph({ net, accountId, probability, onSelectAccount }) {
  const idx = net.accounts.findIndex((a) => a.id === accountId)
  if (idx < 0) return null

  const accLinks = net.account_links.filter(([s, t]) => s === idx || t === idx)
  const neighborIdx = [...new Set(accLinks.flatMap(([s, t]) => (s === idx ? [t] : [s])))]

  // show at most 22 neighbours - high risk first, then by id
  const sorted = [...neighborIdx].sort((a, b) => {
    const A = net.accounts[a]
    const B = net.accounts[b]
    if (A.risk !== B.risk) return A.risk === 'HIGH' ? -1 : 1
    return A.id - B.id
  })
  const shown = sorted.slice(0, 22)
  const hidden = neighborIdx.length - shown.length

  const protoLinks = net.protocol_links.filter(([s]) => s === idx)
  const protos = [...new Set(protoLinks.map(([, t]) => t))]

  const W = 460
  const H = 400
  const cx = W / 2
  const cy = H / 2 - 8
  const R = 148

  const pos = new Map()
  shown.forEach((nIdx, i) => {
    const a = (i / Math.max(shown.length, 1)) * Math.PI * 2 - Math.PI / 2
    pos.set(nIdx, [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.86])
  })
  const protoPos = protos.map((t, i) => {
    const a = Math.PI * (0.18 + (0.64 * i) / Math.max(protos.length, 1))
    return [cx + Math.cos(a) * (R + 52), cy + Math.sin(a) * (R + 52) * 0.9 + 30]
  })

  const highNeighbors = neighborIdx.filter((n) => net.accounts[n].risk === 'HIGH').length

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, margin: '0 auto', display: 'block' }}>
        {/* edges */}
        {shown.map((nIdx) => {
          const [x, y] = pos.get(nIdx)
          const high = net.accounts[nIdx].risk === 'HIGH'
          return (
            <line
              key={`e${nIdx}`}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke={high ? 'rgba(224, 90, 90, 0.55)' : 'rgba(146, 156, 163, 0.22)'}
              strokeWidth={high ? 1.4 : 1}
            />
          )
        })}
        {protoPos.map(([x, y], i) => (
          <line key={`pe${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(146, 156, 163, 0.18)" strokeDasharray="3 4" />
        ))}

        {/* protocol diamonds */}
        {protoPos.map(([x, y], i) => (
          <g key={`p${i}`}>
            <path
              d={`M ${x} ${y - 11} L ${x + 11} ${y} L ${x} ${y + 11} L ${x - 11} ${y} Z`}
              fill="#C9D2D9" stroke="#F2F6F9" strokeWidth={1}
            />
            <text x={x} y={y + 26} fill="#929CA3" fontSize={10.5} textAnchor="middle">
              {net.protocols[protos[i]]}
            </text>
          </g>
        ))}

        {/* neighbour accounts */}
        {shown.map((nIdx) => {
          const [x, y] = pos.get(nIdx)
          const a = net.accounts[nIdx]
          const high = a.risk === 'HIGH'
          return (
            <g key={`n${nIdx}`} style={{ cursor: onSelectAccount ? 'pointer' : 'default' }} onClick={() => onSelectAccount && onSelectAccount(a.id)}>
              {high && <circle cx={x} cy={y} r={11} fill="none" stroke="rgba(224,90,90,0.5)" strokeWidth={1} />}
              <circle cx={x} cy={y} r={6} fill={high ? '#E05A5A' : '#39424D'} stroke={high ? '#F2F6F9' : '#5A6672'} strokeWidth={1} />
              <title>Account #{a.id} — {riskBand(a.probability).label}</title>
            </g>
          )
        })}

        {/* the account itself */}
        <circle cx={cx} cy={cy} r={17} fill={probability >= 0.85 ? '#E05A5A' : '#C9D2D9'} stroke="#F2F6F9" strokeWidth={2} />
        <text x={cx} y={cy + 34} fill="#C9D2D9" fontSize={12} fontWeight={600} textAnchor="middle">
          Account #{accountId}
        </text>
      </svg>

      <div className="ego-caption">
        Connected to <strong>{neighborIdx.length}</strong> accounts
        {highNeighbors > 0 ? (
          <> — <strong style={{ color: 'var(--risk-high)' }}>{highNeighbors}</strong> of them are flagged high risk (red)</>
        ) : (
          <> — none flagged high risk</>
        )}
        {protos.length > 0 && (
          <> · <strong>{protos.length}</strong> lending protocol{protos.length > 1 ? 's' : ''}</>
        )}
        {hidden > 0 && <> · showing {shown.length} of {neighborIdx.length}</>}
      </div>
    </div>
  )
}

// ---- the view -------------------------------------------------------------

export default function CreditRiskView({ onNavigateTab, onSelectAccount }) {
  const [accountId, setAccountId] = useState('')
  const [result, setResult] = useState(null)
  const [narrative, setNarrative] = useState(null)
  const [net, setNet] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handlePredictSubmit = async (e) => {
    if (e) e.preventDefault()
    setBusy(true)
    setError(null)
    let id
    try {
      id = await resolveAccount(accountId)
    } catch (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    setError(null)
    setResult(null)
    setNarrative(null)
    try {
      const res = await api.predict(id)
      setResult(res)
      api.account(id).then((d) => setNarrative(d.narrative)).catch(() => {})
      getNetwork().then(setNet).catch(() => {})
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
            <span>Credit Risk Analysis</span>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Score any account on the network. The model reads the account's transaction
          behaviour and returns a credit score, the risk level and a full written analysis.
        </p>

        <form onSubmit={handlePredictSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="input-field"
            style={{ minWidth: 300 }}
            placeholder="Enter account ID or wallet — e.g., 789 or 0x1f2a…"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <span>{busy ? 'Analyzing Account…' : 'RUN CREDIT ANALYSIS'}</span>
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
          {/* Verdict + credit score gauge */}
          <div className="titanium-card" style={{ borderColor: result.prediction === 'HIGH RISK' ? 'rgba(224, 90, 90, 0.4)' : 'var(--border-main)' }}>
            <div className="gauge-row">
              <div style={{ minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 24, fontWeight: 700 }}>Account #{result.account_id}</h3>
                  <RiskBadge prediction={result.prediction} probability={result.high_risk_probability} />
                </div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                  Wallet: {shortenAddress(result.wallet)}
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Key factors
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {result.reasons.map((r) => (
                    <div key={r.feature} className="trigger-chip">
                      <span style={{ color: r.z >= 0 ? 'var(--risk-high)' : 'var(--text-silver)', marginRight: 6 }}>
                        {r.z >= 0 ? '▲' : '▼'}
                      </span>
                      <strong>{humanFeature(r.feature)}</strong>{' '}
                      <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                        (z {r.z >= 0 ? '+' : ''}{r.z.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('explainability', { accountId: result.account_id })}>
                    <BrainCircuit size={14} /> Deep Explanation
                  </button>
                  {onSelectAccount && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onSelectAccount(result.account_id)}>
                      View Full Account Inspection →
                    </button>
                  )}
                </div>
              </div>

              <ScoreGauge probability={result.high_risk_probability} />
            </div>
          </div>

          {/* Written analysis */}
          {narrative && (
            <div className="titanium-card narrative-card">
              <div className="card-header">
                <div className="card-header-title">
                  <BookOpen className="card-header-icon" size={18} />
                  <span>Credit Analysis Summary</span>
                </div>
              </div>
              <div className="narrative-headline">{narrative.headline}</div>
              {narrative.paragraphs.map((p, i) => (
                <p key={i} className="narrative-paragraph">{p}</p>
              ))}
            </div>
          )}

          {/* This account's transaction network */}
          {net && (
            <div className="titanium-card">
              <div className="card-header">
                <div className="card-header-title">
                  <Share2 className="card-header-icon" size={18} />
                  <span>This Account's Transaction Network</span>
                </div>
              </div>
              <AccountNetworkGraph
                net={net}
                accountId={result.account_id}
                probability={result.high_risk_probability}
                onSelectAccount={onSelectAccount}
              />
            </div>
          )}

          {/* What-if simulator */}
          <WhatIfPanel accountId={result.account_id} />

          {/* Factor attribution */}
          <ShapPanel accountId={result.account_id} autoLoad />
        </>
      )}
    </div>
  )
}
