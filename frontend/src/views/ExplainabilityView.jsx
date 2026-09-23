import React, { useEffect, useState } from 'react'
import { BrainCircuit, Search, BookOpen, GitCompare, Lightbulb } from 'lucide-react'
import { api, resolveAccount } from '../api.js'
import { humanFeature, riskBand, creditScore } from '../labels.js'
import ShapPanel from '../components/ShapPanel.jsx'
import WhatIfPanel from '../components/WhatIfPanel.jsx'
import RiskBadge from '../components/RiskBadge.jsx'

function SimpleComparison({ reasons }) {
  const getLabel = (r) => {
    const z = r.z_vs_low_risk != null ? r.z_vs_low_risk : r.z != null ? r.z : 0
    if (z >= 2.5) return { text: 'Much higher than safe accounts', color: '#F2F6F9', level: 5 }
    if (z >= 1.2) return { text: 'Higher than safe accounts', color: '#C9D2D9', level: 4 }
    if (z >= 0.5) return { text: 'A bit higher than safe', color: '#8B98A5', level: 3 }
    if (z <= -1.5) return { text: 'Much lower than safe (good)', color: '#5A6672', level: 1 }
    if (z <= -0.5) return { text: 'Lower than safe (good)', color: '#6B7782', level: 2 }
    return { text: 'Similar to safe accounts', color: '#8B98A5', level: 2.5 }
  }

  const getValueText = (feature, value) => {
    if (feature === 'historical_liquidation_count') {
      if (value <= 0.1) return 'almost 0'
      return `${value.toFixed(0)} times`
    }
    if (feature === 'liquidation_rate') return `${(value*100).toFixed(0)}%`
    if (feature === 'failed_tx_ratio') return `${(value*100).toFixed(0)}% failed`
    if (feature === 'repayment_ratio') return `${(value*100).toFixed(0)}% repay`
    if (feature === 'repay_count') return `${value.toFixed(0)} repays`
    if (['borrow_volume','deposit_volume','total_volume'].includes(feature)) {
      if (value>1000) return `$${(value/1000).toFixed(1)}k`
      return `$${value.toFixed(0)}`
    }
    return value.toFixed(2)
  }

  const sorted = [...reasons].sort((a,b)=> (b.z_vs_low_risk ?? b.z ?? 0) - (a.z_vs_low_risk ?? a.z ?? 0))

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map((r)=>{
          const info = getLabel(r)
          const width = Math.min(100, 20 + info.level*16)
          const isRisky = (r.z_vs_low_risk ?? r.z ?? 0) >= 0.5
          return (
            <div key={r.feature} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'rgba(13,16,19,0.45)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EEF1' }}>{humanFeature(r.feature)}</div>
                <div style={{ fontSize: 11, color: '#8B98A5' }} className="mono">{getValueText(r.feature, r.value)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${width}%`, height: '100%', background: info.color, borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: info.color, fontWeight: 600 }}>
                {isRisky ? '↑ ' : '↓ '}{info.text}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(201,210,217,0.06)', borderRadius: 8, fontSize: 11.5, color: '#8B98A5', lineHeight: 1.6 }}>
        <strong style={{ color: '#C9D2D9' }}>How to read (titanium only):</strong> Bright bar = much higher than safe (risky). Dark bar = lower than safe (good). Example: safe accounts have 0 liquidations, this has 3 → bright bar + "Much higher than safe".
      </div>
    </div>
  )
}

function ImportanceLollipop({ features }) {
  const maxVal = Math.max(...features.map((f) => f.importance_drop), 0.0001)
  const W = 720, labelW = 240, valW = 70, trackW = W - labelW - valW, rowH = 38
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${features.length * rowH + 16}`} style={{ maxWidth: W }}>
      {features.map((f,i)=>{
        const y=20+i*rowH
        const x=labelW+(Math.max(f.importance_drop,0)/maxVal)*trackW
        return (
          <g key={f.feature}>
            <text x={labelW-12} y={y+4} fill="#929CA3" fontSize={11.5} textAnchor="end">{humanFeature(f.feature)}</text>
            <line x1={labelW} x2={labelW+trackW} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            <line x1={labelW} x2={x} y1={y} y2={y} stroke="#C9D2D9" strokeWidth={2} />
            <circle cx={x} cy={y} r={5.5} fill={i===0?'#F2F6F9':'#8B98A5'} stroke="#080A0C" strokeWidth={1.5} />
            <text x={W-8} y={y+4} fill="#E9EEF1" fontSize={11} textAnchor="end" className="mono">{f.importance_drop.toFixed(4)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ExplainabilityView({ focusAccountId }) {
  const [input, setInput] = useState(focusAccountId!=null?String(focusAccountId):'')
  const [loadedId, setLoadedId] = useState(focusAccountId!=null?focusAccountId:null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [importance, setImportance] = useState(null)

  useEffect(()=>{ api.importance().then(setImportance).catch(()=>{}) }, [])

  const load = (id)=>{
    setLoadedId(id); setDetail(null); setError(null)
    api.account(id).then(setDetail).catch((e)=>setError(e.message))
  }

  useEffect(()=>{
    if (focusAccountId!=null){ setInput(String(focusAccountId)); load(focusAccountId) }
  }, [focusAccountId])

  const handleSubmit = async (e)=>{
    if(e) e.preventDefault()
    try{ const id=await resolveAccount(input); load(id) }catch(err){ setError(err.message) }
  }

  const band = detail ? riskBand(detail.high_risk_probability) : null
  const score = detail ? creditScore(detail.high_risk_probability) : null

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header"><div className="card-header-title"><BrainCircuit className="card-header-icon" size={18} /><span>XAI Explanation - Simple English, Like Answering a Question</span></div></div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.7 }}>
          Enter any account. You will get answer like if someone asks <strong style={{ color: '#C9D2D9' }}>"Why is this account risky?"</strong> — we answer in simple words, no technical jargon. Example: "It has been liquidated 3 times, safe accounts have 0, so risk is high."
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="input-field" style={{ minWidth: 300 }} placeholder="e.g., 789 or 0x1f2a…" value={input} onChange={(e)=>setInput(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={!input.trim()}><Search size={14} /> Explain This Account</button>
        </form>
        {error&&<div className="error" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {detail && (
        <>
          <div className="titanium-card narrative-card" style={{ borderColor: 'rgba(201,210,217,0.15)' }}>
            <div className="card-header">
              <div className="card-header-title"><BookOpen className="card-header-icon" size={18} /><span>Plain English Explanation - Account #{detail.account_id}</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 12, color: '#8B98A5' }}>Score {score} / 900</span>
                <RiskBadge prediction={detail.prediction} probability={detail.high_risk_probability} />
              </div>
            </div>

            {detail.narrative && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F2F6F9', marginBottom: 14, padding: '12px 16px', background: 'rgba(201,210,217,0.06)', borderRadius: 10, borderLeft: '4px solid #C9D2D9', lineHeight: 1.5 }}>
                  {detail.narrative.headline}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {detail.narrative.paragraphs.map((p,i)=>{
                    const isBottom = i===detail.narrative.paragraphs.length-1
                    return (
                      <div key={i} style={{ padding: '14px 16px', background: isBottom?'rgba(13,16,19,0.7)':'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', fontSize: 13.5, lineHeight: 1.8, color: isBottom?'#E9EEF1':'#C9D2D9' }}>
                        {isBottom ? <><Lightbulb size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom', color: '#C9D2D9' }} />{p}</> : p}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="titanium-card">
            <div className="card-header"><div className="card-header-title"><GitCompare className="card-header-icon" size={18} /><span>How This Account Compares to Safe Accounts (titanium only)</span></div><span style={{ fontSize: 11, color: '#616B74' }}>Bright = higher than safe, Dark = lower</span></div>
            <SimpleComparison reasons={detail.reasons} />
          </div>

          <ShapPanel accountId={loadedId} autoLoad />
          <WhatIfPanel accountId={loadedId} />
        </>
      )}

      {importance && (
        <div className="titanium-card">
          <div className="card-header"><div className="card-header-title"><BrainCircuit className="card-header-icon" size={18} /><span>What Matters Most Overall</span></div></div>
          <ImportanceLollipop features={importance.features} />
          <div className="muted small" style={{ marginTop: 12, lineHeight: 1.6 }}>
            If we hide one factor, how much worse does model get? Longer = more important. Usually past liquidations is most important.
          </div>
        </div>
      )}
    </div>
  )
}
