import React, { useEffect, useState, useCallback } from 'react'
import { SlidersHorizontal, RefreshCw, Sparkles, ArrowRight } from 'lucide-react'
import { api, pct } from '../api.js'
import { humanFeature, riskBand, creditScore } from '../labels.js'

function simpleText(feature, value) {
  if (feature === 'historical_liquidation_count') {
    if (value <= 0.1) return '0 liquidations'
    return `${value.toFixed(0)} liquidations`
  }
  if (feature === 'liquidation_rate') return `${(value*100).toFixed(0)}% bad`
  if (feature === 'failed_tx_ratio') return `${(value*100).toFixed(0)}% failed`
  if (feature === 'repayment_ratio') return `${(value*100).toFixed(0)}% repay`
  if (feature === 'repay_count') return `${value.toFixed(0)} repays`
  if (['borrow_volume','deposit_volume','total_volume'].includes(feature)) {
    if (value>=1000) return `$${(value/1000).toFixed(1)}k`
    return `$${value.toFixed(0)}`
  }
  return value.toFixed(2)
}

export default function WhatIfPanel({ accountId }) {
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [result, setResult] = useState(null)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    if (!accountId) return
    setLoading(true); setError(null); setCtx(null); setOverrides({}); setResult(null)
    api.whatifContext(accountId).then((c)=>{ setCtx(c); setLoading(false) }).catch((e)=>{ setError(e.message); setLoading(false) })
  }, [accountId])

  const handleSlider = (feature, value) => {
    const num = parseFloat(value)
    setOverrides((prev)=>{
      const next={...prev}
      const original = ctx?.factors.find((f)=>f.feature===feature)?.current
      if (original!==undefined && Math.abs(num-original)<1e-9) delete next[feature]
      else next[feature]=num
      return next
    })
    setResult(null)
  }

  const simulate = useCallback(async ()=>{
    if (!ctx) return
    setSimulating(true)
    try{ const res=await api.whatif(ctx.account_id, overrides); setResult(res) }catch(e){ setError(e.message) }finally{ setSimulating(false) }
  }, [ctx, overrides])

  const resetAll = ()=>{ setOverrides({}); setResult(null) }
  const applySafe = ()=>{
    if (!ctx) return
    const safeOverrides={}
    ctx.factors.forEach((f)=>{ if (f.key) safeOverrides[f.feature]=f.safe })
    setOverrides(safeOverrides); setResult(null)
  }

  const baselineProb = result?.baseline_probability ?? ctx?.probability ?? 0
  const newProb = result?.probability ?? baselineProb
  const baselineBand = riskBand(baselineProb)
  const newBand = riskBand(newProb)
  const delta = newProb - baselineProb
  const improved = delta < 0

  if (loading) return <div className="titanium-card"><div className="card-header"><div className="card-header-title"><SlidersHorizontal size={18} className="card-header-icon" /><span>What-If Simulator</span></div></div><div className="loading-state"><div className="spinner-ring" /><span>Loading…</span></div></div>
  if (error) return <div className="titanium-card"><div className="card-header"><div className="card-header-title"><SlidersHorizontal size={18} className="card-header-icon" /><span>What-If Simulator</span></div></div><div className="error">{error}</div></div>
  if (!ctx) return null

  const hasOverrides = Object.keys(overrides).length>0

  return (
    <div className="titanium-card">
      <div className="card-header">
        <div className="card-header-title"><SlidersHorizontal size={18} className="card-header-icon" /><span>What-If Simulator — try fixing this account</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={applySafe}><Sparkles size={14} /> Apply safe profile</button>
          <button className="btn btn-ghost btn-sm" onClick={resetAll} disabled={!hasOverrides && !result}><RefreshCw size={14} /> Reset</button>
          <button className="btn btn-primary btn-sm" onClick={simulate} disabled={simulating}>{simulating?'Simulating…':'Simulate'} <ArrowRight size={14} /></button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
        Move sliders to see how changing behaviour changes risk. <strong style={{ color: '#C9D2D9' }}>Key factors</strong> are highlighted — they drive current prediction most. Safe value is average of low-risk accounts.
      </p>

      <div className="wif-sliders">
        {ctx.factors.slice(0,8).map((f)=>{
          const val = overrides[f.feature]!==undefined ? overrides[f.feature] : f.current
          const isOverridden = overrides[f.feature]!==undefined
          const range = f.max - f.min
          const pctToSafe = range!==0 ? ((f.safe-f.min)/range)*100 : 50
          return (
            <div key={f.feature} className={`wif-slider-row ${f.key?'wif-key':''}`} style={{ background: 'rgba(13,16,19,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EEF1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {humanFeature(f.feature)}
                  {f.key && <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(201,210,217,0.12)', border: '1px solid rgba(201,210,217,0.2)', color: '#C9D2D9', fontSize: 10, letterSpacing: '0.05em' }}>KEY</span>}
                </span>
                <span className="mono" style={{ fontSize: 11.5, color: isOverridden?'#F2F6F9':'#8B98A5' }}>
                  {simpleText(f.feature, val)} {isOverridden && <span style={{ fontSize: 10, color: '#8B98A5' }}>• edited</span>}
                </span>
              </div>
              <div style={{ position: 'relative', padding: '6px 0' }}>
                <input type="range" className="wif-range" min={f.min} max={f.max} step={f.step || range/100} value={val} onChange={(e)=>handleSlider(f.feature, e.target.value)} />
                <div title={`Safe avg: ${simpleText(f.feature, f.safe)}`} style={{ position: 'absolute', left: `${pctToSafe}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 14, background: '#C9D2D9', opacity: 0.9, pointerEvents: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#616B74', marginTop: 4 }} className="mono">
                <span>{simpleText(f.feature, f.min)}</span>
                <span style={{ color: '#C9D2D9' }}>safe {simpleText(f.feature, f.safe)}</span>
                <span>{simpleText(f.feature, f.max)}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px', background: 'rgba(13,16,19,0.6)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', marginTop: 12, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: 10, color: '#8B98A5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Baseline</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#F2F6F9' }}>{creditScore(baselineProb)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: baselineBand.color }}>{baselineBand.label.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 11, color: '#8B98A5' }}>{pct(baselineProb,1)} risk</div>
        </div>
        <div style={{ fontSize: 20, color: '#5A6672' }}>→</div>
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: 10, color: '#8B98A5', textTransform: 'uppercase' }}>{result?'Simulated':'No changes'}</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: '#F2F6F9' }}>{creditScore(newProb)}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: newBand.color }}>{newBand.label.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 11, color: '#8B98A5' }}>{pct(newProb,1)} risk</div>
        </div>
        {result&&(
          <div style={{ marginLeft: 'auto', padding: '10px 14px', borderRadius: 8, background: 'rgba(201,210,217,0.08)', border: '1px solid rgba(201,210,217,0.15)', fontSize: 12, color: '#E9EEF1' }}>
            <span style={{ color: improved?'#C9D2D9':'#E05A5A', fontWeight: 700 }}>{improved?'↓ Lower risk':'↑ Higher risk'}</span> {pct(Math.abs(delta),1)} • {creditScore(newProb)-creditScore(baselineProb)>=0?'+':''}{creditScore(newProb)-creditScore(baselineProb)} score
          </div>
        )}
        {!result&&hasOverrides&&<div style={{ marginLeft: 'auto', fontSize: 12, color: '#8B98A5' }}>{Object.keys(overrides).length} factor(s) changed — click Simulate</div>}
      </div>
    </div>
  )
}
