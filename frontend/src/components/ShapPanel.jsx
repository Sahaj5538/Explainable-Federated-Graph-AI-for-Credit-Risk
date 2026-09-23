import React, { useEffect, useState } from 'react'
import { BrainCircuit, Zap, ArrowUp, ArrowDown } from 'lucide-react'
import { api, pct } from '../api.js'
import { humanFeature } from '../labels.js'

export default function ShapPanel({ accountId, autoLoad = false }) {
  const [shap, setShap] = useState(null)
  const [error, setError] = useState(null)
  const [seconds, setSeconds] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setShap(null); setError(null); setSeconds(null); setLoading(true)
    const started = performance.now()
    api.shap(accountId)
      .then((s)=>{ setSeconds(((performance.now()-started)/1000).toFixed(1)); setShap(s) })
      .catch((e)=>setError(e.message))
      .finally(()=>setLoading(false))
  }

  useEffect(()=>{ if (autoLoad && accountId!=null) load() }, [accountId, autoLoad])

  const getImpactLabel = (val, maxAbs) => {
    const abs = Math.abs(val)
    const ratio = abs / maxAbs
    if (ratio > 0.7) return val>0 ? 'Raised risk a lot' : 'Lowered risk a lot'
    if (ratio > 0.4) return val>0 ? 'Raised risk' : 'Lowered risk'
    if (ratio > 0.15) return val>0 ? 'Raised risk a little' : 'Lowered risk a little'
    return val>0 ? 'Raised risk slightly' : 'Lowered risk slightly'
  }

  if (error) return <div className="error">Attribution failed: {error}</div>

  if (!shap) {
    return (
      <div className="titanium-card">
        <div className="card-header"><div className="card-header-title"><BrainCircuit className="card-header-icon" size={18} /><span>What Moved This Score - Detailed Breakdown</span></div></div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          See exactly which factors pushed the risk up or down, in plain English. Example: "past liquidations raised risk a lot" means that factor was the main reason.
        </p>
        <button className="btn btn-primary" onClick={load} disabled={loading}><Zap size={14} /> {loading?'Computing…':'Compute Detailed Breakdown'}</button>
        {loading&&<div className="loading-state" style={{ padding: '24px 0' }}><div className="spinner-ring" /><span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Measuring each factor…</span></div>}
      </div>
    )
  }

  const maxAbs = Math.max(...shap.features.map((f)=>Math.abs(f.shap_value)), 1e-9)

  return (
    <div className="titanium-card">
      <div className="card-header">
        <div className="card-header-title"><BrainCircuit className="card-header-icon" size={18} /><span>What Moved This Score</span></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="meta-chip highlight">Risk <strong>{pct(shap.high_risk_probability)}</strong></span>
          {seconds&&<span className="meta-chip"><Zap size={12} /> {seconds}s</span>}
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: '#8B98A5', marginBottom: 14, lineHeight: 1.6 }}>
        Each row shows one factor. Right side = made risk higher. Left side = made risk lower. Longer bar = bigger effect. Only titanium colors - bright = higher risk, dark = lower risk.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {shap.features.slice(0,8).map((f)=>{
          const widthPct = (100*Math.abs(f.shap_value))/maxAbs
          const isPositive = f.shap_value>=0
          return (
            <div key={f.feature} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'rgba(13,16,19,0.4)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E9EEF1' }}>{humanFeature(f.feature)}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: '4px 0 0 4px', overflow: 'hidden' }}>
                  {!isPositive && <div style={{ width: `${widthPct}%`, backgroundColor: '#5A6672', height: '100%', border: '1px solid #8B98A5' }} />}
                </div>
                <div style={{ width: 2, height: 16, backgroundColor: '#C9D2D9' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: '0 4px 4px 0', overflow: 'hidden' }}>
                  {isPositive && <div style={{ width: `${widthPct}%`, backgroundColor: '#F2F6F9', height: '100%' }} />}
                </div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: isPositive?'#F2F6F9':'#8B98A5', display: 'flex', alignItems: 'center', gap: 4 }}>
                {isPositive?<ArrowUp size={12} />:<ArrowDown size={12} />} {getImpactLabel(f.shap_value, maxAbs)}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 11.5, color: '#8B98A5', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 4, backgroundColor: '#F2F6F9', borderRadius: 2 }} /> Raises risk (bright, right)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 4, backgroundColor: '#5A6672', borderRadius: 2, border: '1px solid #8B98A5' }} /> Lowers risk (dark, left)</div>
        <div style={{ color: '#616B74' }}>• Titanium only - black and silver theme</div>
      </div>
    </div>
  )
}
