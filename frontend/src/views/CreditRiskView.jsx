import React, { useState } from 'react'
import { ShieldAlert, ArrowRight, RefreshCw, BrainCircuit, BookOpen, Share2, Info, AlertTriangle, CheckCircle } from 'lucide-react'
import { api, getNetwork, pct, shortenAddress, resolveAccount } from '../api.js'
import { humanFeature, riskBand, creditScore, RISK_BANDS } from '../labels.js'
import RiskBadge from '../components/RiskBadge.jsx'
import ShapPanel from '../components/ShapPanel.jsx'
import WhatIfPanel from '../components/WhatIfPanel.jsx'

function ScoreGauge({ probability }) {
  const score = creditScore(probability)
  const band = riskBand(probability)
  const W = 380
  const H = 240
  const cx = W / 2
  const cy = 175
  const r = 135
  const strokeW = 16
  const degOfP = (p) => 180 * p
  const degOfScore = (s) => 180 * (1 - (s - 300) / 600)
  const point = (deg, rad) => {
    const radAngle = (deg * Math.PI) / 180
    return [cx + rad * Math.cos(radAngle), cy - rad * Math.sin(radAngle)]
  }
  const arcPath = (startDeg, endDeg, rad = r) => {
    const [x0, y0] = point(startDeg, rad)
    const [x1, y1] = point(endDeg, rad)
    const largeArc = Math.abs(startDeg - endDeg) > 180 ? 1 : 0
    const sweep = startDeg > endDeg ? 1 : 0
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${largeArc} ${sweep} ${x1} ${y1}`
  }
  const segments = [
    { p0: 1.0, p1: 0.85, color: RISK_BANDS[0].color, label: 'High', scoreRange: '300-390' },
    { p0: 0.85, p1: 0.65, color: RISK_BANDS[1].color, label: 'Elevated', scoreRange: '390-510' },
    { p0: 0.65, p1: 0.35, color: RISK_BANDS[2].color, label: 'Moderate', scoreRange: '510-690' },
    { p0: 0.35, p1: 0.0, color: RISK_BANDS[3].color, label: 'Low', scoreRange: '690-900' },
  ]
  const needleDeg = degOfP(probability)
  const [nx, ny] = point(needleDeg, r - 18)
  const ticks = [300, 400, 500, 600, 700, 800, 900]
  return (
    <div className="gauge-wrap-v2" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <path d={arcPath(180, 0, r)} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        {segments.map((seg, i) => (
          <path key={i} d={arcPath(degOfP(seg.p0), degOfP(seg.p1), r)} stroke={seg.color} strokeWidth={strokeW} fill="none" strokeLinecap="butt" opacity={0.95} />
        ))}
        {ticks.map((s) => {
          const deg = degOfScore(s)
          const [x0, y0] = point(deg, r - strokeW / 2 - 2)
          const [x1, y1] = point(deg, r + 10)
          const [lx, ly] = point(deg, r + 28)
          return (
            <g key={s}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#5A6672" strokeWidth={1} />
              <text x={lx} y={ly} fill="#8B98A5" fontSize={10} textAnchor="middle" className="mono">{s}</text>
            </g>
          )
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#F2F6F9" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={9} fill="#0D1013" stroke="#F2F6F9" strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={3} fill="#F2F6F9" />
        <text x={cx} y={cy - 28} textAnchor="middle" fill="#F2F6F9" fontSize={42} fontWeight={800} className="mono">{score}</text>
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#616B74" fontSize={10} letterSpacing="0.14em" fontWeight={600}>CREDIT SCORE</text>
      </svg>
      <div style={{ textAlign: 'center', marginTop: -12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 999, background: 'rgba(13,16,19,0.8)', border: `1px solid ${band.color}40` }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.color, display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: band.color === '#F2F6F9' ? '#C9D2D9' : band.color }}>{band.label.toUpperCase()}</span>
          <span style={{ fontSize: 12, color: '#8B98A5' }} className="mono">{pct(probability, 1)} risk</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#616B74' }}>300 = high risk (left) • 900 = low risk (right) • needle shows this account</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18, padding: '12px', background: 'rgba(13,16,19,0.6)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <span style={{ width: 12, height: 4, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            <span style={{ color: '#C9D2D9', fontWeight: 600 }}>{s.label}</span>
            <span className="mono" style={{ color: '#616B74' }}>{s.scoreRange}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccountNetworkGraph({ net, accountId, probability, onSelectAccount }) {
  const idx = net.accounts.findIndex((a) => a.id === accountId)
  if (idx < 0) return null
  const accLinks = net.account_links.filter(([s, t]) => s === idx || t === idx)
  const neighborIdx = [...new Set(accLinks.flatMap(([s, t]) => (s === idx ? [t] : [s])))]
  const sorted = [...neighborIdx].sort((a, b) => {
    const A = net.accounts[a]
    const B = net.accounts[b]
    if (A.risk !== B.risk) return A.risk === 'HIGH' ? -1 : 1
    return A.id - B.id
  })
  const shown = sorted.slice(0, 20)
  const hidden = neighborIdx.length - shown.length
  const protoLinks = net.protocol_links.filter(([s]) => s === idx)
  const protos = [...new Set(protoLinks.map(([, t]) => t))]
  const W = 560
  const H = 460
  const cx = W / 2
  const cy = H / 2 - 10
  const R = 165
  const pos = new Map()
  shown.forEach((nIdx, i) => {
    const angle = (i / Math.max(shown.length, 1)) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(angle) * R
    const y = cy + Math.sin(angle) * R * 0.88
    pos.set(nIdx, [x, y, angle])
  })
  const protoPos = protos.map((t, i) => {
    const angle = Math.PI * (0.15 + (0.7 * i) / Math.max(protos.length - 1 || 1, 1))
    const rr = R + 70
    return [cx + Math.cos(angle) * rr * 0.9, cy + Math.sin(angle) * rr * 0.7 + 60, net.protocols[t]]
  })
  const highNeighbors = neighborIdx.filter((n) => net.accounts[n].risk === 'HIGH').length
  const band = riskBand(probability)
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: 'rgba(13,16,19,0.6)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E05A5A', border: '1px solid #F2F6F9', display: 'inline-block' }} /> High-risk account</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#39424D', border: '1px solid #5A6672', display: 'inline-block' }} /> Safe account</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, background: '#C9D2D9', transform: 'rotate(45deg)', display: 'inline-block' }} /> Lending protocol</span>
        <span style={{ color: '#616B74' }}>• Click any account to inspect</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, margin: '0 auto', display: 'block', background: 'radial-gradient(circle at 50% 50%, rgba(201,210,217,0.04), transparent 70%)', borderRadius: 12 }}>
        {shown.map((nIdx) => {
          const [x, y] = pos.get(nIdx)
          const high = net.accounts[nIdx].risk === 'HIGH'
          return <line key={`e${nIdx}`} x1={cx} y1={cy} x2={x} y2={y} stroke={high ? 'rgba(224, 90, 90, 0.45)' : 'rgba(146, 156, 163, 0.18)'} strokeWidth={high ? 1.6 : 1} />
        })}
        {protoPos.map(([x, y], i) => (
          <line key={`pe${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(146, 156, 163, 0.16)" strokeDasharray="4 5" strokeWidth={1} />
        ))}
        {protoPos.map(([x, y, name], i) => (
          <g key={`p${i}`}>
            <path d={`M ${x} ${y - 12} L ${x + 12} ${y} L ${x} ${y + 12} L ${x - 12} ${y} Z`} fill="#C9D2D9" stroke="#F2F6F9" strokeWidth={1.2} />
            <rect x={x - (name.length * 3.5)} y={y + 18} width={name.length * 7} height={16} rx={8} fill="rgba(13,16,19,0.85)" stroke="rgba(255,255,255,0.08)" />
            <text x={x} y={y + 28} fill="#C9D2D9" fontSize={10.5} fontWeight={600} textAnchor="middle">{name}</text>
          </g>
        ))}
        {shown.map((nIdx) => {
          const [x, y, angle] = pos.get(nIdx)
          const a = net.accounts[nIdx]
          const high = a.risk === 'HIGH'
          const labelOffset = 18
          const lx = x + Math.cos(angle) * labelOffset
          const ly = y + Math.sin(angle) * labelOffset
          return (
            <g key={`n${nIdx}`} style={{ cursor: onSelectAccount ? 'pointer' : 'default' }} onClick={() => onSelectAccount && onSelectAccount(a.id)}>
              {high && <circle cx={x} cy={y} r={14} fill="none" stroke="rgba(224,90,90,0.35)" strokeWidth={1.5} strokeDasharray="3 3" />}
              <circle cx={x} cy={y} r={7} fill={high ? '#E05A5A' : '#39424D'} stroke={high ? '#F2F6F9' : '#8B98A5'} strokeWidth={1.2} />
              <g>
                <rect x={lx - 18} y={ly - 9} width={36} height={14} rx={7} fill={high ? 'rgba(224,90,90,0.15)' : 'rgba(13,16,19,0.85)'} stroke={high ? 'rgba(224,90,90,0.4)' : 'rgba(255,255,255,0.08)'} />
                <text x={lx} y={ly + 1} fill={high ? '#FF8A8A' : '#C9D2D9'} fontSize={9} fontWeight={700} textAnchor="middle" className="mono">#{a.id}</text>
              </g>
              <title>Account #{a.id} — {riskBand(a.probability).label} ({(a.probability*100).toFixed(1)}%) • Click to inspect</title>
            </g>
          )
        })}
        <circle cx={cx} cy={cy} r={24} fill="none" stroke={band.key === 'high' ? 'rgba(224,90,90,0.35)' : band.key === 'elevated' ? 'rgba(146,156,163,0.35)' : 'rgba(201,210,217,0.2)'} strokeWidth={2} strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r={18} fill={band.color} stroke="#F2F6F9" strokeWidth={2.5} />
        <text x={cx} y={cy + 1} fill={band.key === 'low' || band.key === 'moderate' ? '#0D1013' : '#FFFFFF'} fontSize={9} fontWeight={800} textAnchor="middle">YOU</text>
        <g>
          <rect x={cx - 42} y={cy + 26} width={84} height={18} rx={9} fill="#0D1013" stroke="#3D4852" />
          <text x={cx} y={cy + 37} fill="#F2F6F9" fontSize={10.5} fontWeight={700} textAnchor="middle" className="mono">#{accountId}</text>
        </g>
      </svg>
      <div className="ego-caption" style={{ marginTop: 12, lineHeight: 1.6 }}>
        <strong style={{ color: '#F2F6F9' }}>Account #{accountId}</strong> is connected to <strong>{neighborIdx.length}</strong> accounts
        {highNeighbors > 0 ? <> — <strong style={{ color: '#E05A5A' }}>{highNeighbors} flagged high-risk</strong> (red nodes with dashed halo). Red lines = transactions with risky accounts.</> : <> — <span style={{ color: '#8B98A5' }}>no high-risk connections found ✓</span></>}
        {protos.length > 0 && <> • Uses <strong>{protos.length}</strong> lending protocol{protos.length > 1 ? 's' : ''}: {protos.map(i => net.protocols[i]).join(', ')}</>}
        {hidden > 0 && <> • Showing {shown.length} of {neighborIdx.length} connections (top risky first)</>}
      </div>
    </div>
  )
}

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
    try { id = await resolveAccount(accountId) } catch (err) { setError(err.message); setBusy(false); return }
    setError(null); setResult(null); setNarrative(null)
    try {
      const res = await api.predict(id)
      setResult(res)
      api.account(id).then((d) => setNarrative(d.narrative)).catch(() => {})
      getNetwork().then(setNet).catch(() => {})
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const getBorderColor = (prob) => {
    const b = riskBand(prob)
    if (b.key === 'high') return 'rgba(224, 90, 90, 0.4)'
    if (b.key === 'elevated') return 'rgba(146,156,163,0.35)'
    if (b.key === 'moderate') return 'rgba(201,210,217,0.25)'
    return 'var(--border-main)'
  }

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header"><div className="card-header-title"><ShieldAlert className="card-header-icon" size={18} /><span>Credit Risk Analysis</span></div></div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>Score any account on the network. Enter an <strong style={{ color: '#C9D2D9' }}>account ID</strong> (e.g., 789) or a <strong style={{ color: '#C9D2D9' }}>wallet address</strong> starting with 0x.</p>
        <form onSubmit={handlePredictSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="input-field" style={{ minWidth: 300 }} placeholder="Enter account ID or wallet — e.g., 789 or 0x1f2a…" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={busy}><span>{busy ? 'Analyzing Account…' : 'RUN CREDIT ANALYSIS'}</span><ArrowRight size={14} /></button>
        </form>
        {error && <div className="error" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Risk engine unavailable: {error}</span><button className="btn btn-sm" onClick={() => handlePredictSubmit(null)}><RefreshCw size={14} /> Retry</button></div>}
      </div>

      {result && (
        <>
          <div className="titanium-card" style={{ borderColor: getBorderColor(result.high_risk_probability) }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }} className="gauge-responsive-grid">
              <div style={{ minWidth: 260 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 24, fontWeight: 700 }}>Account #{result.account_id}</h3>
                  <RiskBadge prediction={result.prediction} probability={result.high_risk_probability} />
                </div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Wallet: {shortenAddress(result.wallet)}</div>
                <div style={{ background: 'rgba(13,16,19,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8B98A5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Info size={12} /> What this score means</div>
                  <div style={{ fontSize: 13, color: '#C9D2D9', lineHeight: 1.6 }}>
                    Score <strong>{creditScore(result.high_risk_probability)}</strong> out of 900. Higher = safer.
                    {result.high_risk_probability >= 0.85 && ' This account shows strong high-risk signals and should be reviewed carefully.'}
                    {result.high_risk_probability >= 0.65 && result.high_risk_probability < 0.85 && ' Some elevated risk factors present - monitor transactions.'}
                    {result.high_risk_probability >= 0.35 && result.high_risk_probability < 0.65 && ' Moderate risk - typical for active traders, but worth checking key factors.'}
                    {result.high_risk_probability < 0.35 && ' Low risk profile - behaviour matches safe accounts.'}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 10 }}>Key risk factors</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {result.reasons.map((r) => (
                    <div key={r.feature} className="trigger-chip" style={{ borderColor: r.z >= 0 ? 'rgba(224,90,90,0.3)' : 'rgba(201,210,217,0.2)', background: r.z >= 0 ? 'rgba(224,90,90,0.08)' : 'rgba(13,16,19,0.8)' }}>
                      <span style={{ color: r.z >= 0 ? 'var(--risk-high)' : '#8B98A5', marginRight: 6, fontWeight: 700 }}>{r.z >= 0 ? '▲' : '▼'}</span>
                      <strong>{humanFeature(r.feature)}</strong>{' '}<span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>(z {r.z >= 0 ? '+' : ''}{r.z.toFixed(2)})</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('explainability', { accountId: result.account_id })}><BrainCircuit size={14} /> Deep Explanation</button>
                  {onSelectAccount && <button className="btn btn-ghost btn-sm" onClick={() => onSelectAccount(result.account_id)}>View Full Account Inspection →</button>}
                </div>
              </div>
              <ScoreGauge probability={result.high_risk_probability} />
            </div>
          </div>

          {narrative && (
            <div className="titanium-card narrative-card">
              <div className="card-header"><div className="card-header-title"><BookOpen className="card-header-icon" size={18} /><span>Credit Analysis Summary</span></div></div>
              <div className="narrative-headline">{narrative.headline}</div>
              {narrative.paragraphs.map((p, i) => <p key={i} className="narrative-paragraph">{p}</p>)}
            </div>
          )}

          {net && (
            <div className="titanium-card">
              <div className="card-header"><div className="card-header-title"><Share2 className="card-header-icon" size={18} /><span>Transaction Network - Who this account interacts with</span></div><span style={{ fontSize: 11, color: '#616B74' }}>Labels show account numbers • Diamonds are protocols</span></div>
              <AccountNetworkGraph net={net} accountId={result.account_id} probability={result.high_risk_probability} onSelectAccount={onSelectAccount} />
            </div>
          )}

          <WhatIfPanel accountId={result.account_id} />
          <ShapPanel accountId={result.account_id} autoLoad />
        </>
      )}
    </div>
  )
}
