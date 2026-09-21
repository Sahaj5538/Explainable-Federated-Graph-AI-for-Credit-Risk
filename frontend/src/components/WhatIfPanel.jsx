import React, { useEffect, useState, useCallback } from 'react'
import { SlidersHorizontal, RefreshCw, Sparkles, ArrowRight } from 'lucide-react'
import { api, pct } from '../api.js'
import { humanFeature, riskBand, creditScore } from '../labels.js'

// ---------------------------------------------------------------------------
// WHAT-IF SIMULATOR
// Lets the analyst move the behavioural factors and see how the risk
// probability would change. Uses GET /api/whatif/{id}/context for ranges
// and POST /api/whatif for simulation.
// ---------------------------------------------------------------------------

export default function WhatIfPanel({ accountId }) {
  const [ctx, setCtx] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [result, setResult] = useState(null)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    setError(null)
    setCtx(null)
    setOverrides({})
    setResult(null)
    api
      .whatifContext(accountId)
      .then((c) => {
        setCtx(c)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [accountId])

  const handleSlider = (feature, value) => {
    const num = parseFloat(value)
    setOverrides((prev) => {
      const next = { ...prev }
      const original = ctx?.factors.find((f) => f.feature === feature)?.current
      // if back to original (within epsilon) remove override
      if (original !== undefined && Math.abs(num - original) < 1e-9) {
        delete next[feature]
      } else {
        next[feature] = num
      }
      return next
    })
    // clear previous result until re-simulated
    setResult(null)
  }

  const simulate = useCallback(async () => {
    if (!ctx) return
    setSimulating(true)
    try {
      const res = await api.whatif(ctx.account_id, overrides)
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setSimulating(false)
    }
  }, [ctx, overrides])

  const resetAll = () => {
    setOverrides({})
    setResult(null)
  }

  const applySafe = () => {
    if (!ctx) return
    const safeOverrides = {}
    ctx.factors.forEach((f) => {
      if (f.key) safeOverrides[f.feature] = f.safe
    })
    setOverrides(safeOverrides)
    setResult(null)
  }

  const baselineProb = result?.baseline_probability ?? ctx?.probability ?? 0
  const newProb = result?.probability ?? baselineProb
  const baselineBand = riskBand(baselineProb)
  const newBand = riskBand(newProb)
  const delta = newProb - baselineProb
  const improved = delta < 0

  if (loading) {
    return (
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <SlidersHorizontal size={18} className="card-header-icon" />
            <span>What-If Simulator</span>
          </div>
        </div>
        <div className="loading-state">
          <div className="spinner-ring" />
          <span>Loading behavioural ranges…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <SlidersHorizontal size={18} className="card-header-icon" />
            <span>What-If Simulator</span>
          </div>
        </div>
        <div className="error">{error}</div>
      </div>
    )
  }

  if (!ctx) return null

  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div className="titanium-card">
      <div className="card-header">
        <div className="card-header-title">
          <SlidersHorizontal size={18} className="card-header-icon" />
          <span>What-If Simulator — test behavioural changes</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={applySafe}>
            <Sparkles size={14} /> Apply safe profile
          </button>
          <button className="btn btn-ghost btn-sm" onClick={resetAll} disabled={!hasOverrides && !result}>
            <RefreshCw size={14} /> Reset
          </button>
          <button className="btn btn-primary btn-sm" onClick={simulate} disabled={simulating}>
            {simulating ? 'Simulating…' : 'Simulate'} <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
        Move the sliders to see how changing this account's behaviour would affect its risk score.
        <strong style={{ color: 'var(--text-primary)' }}> Key factors</strong> are highlighted — they drive the current prediction most.
        Safe values are the average of low-risk accounts.
      </p>

      <div className="wif-sliders">
        {ctx.factors.map((f) => {
          const val = overrides[f.feature] !== undefined ? overrides[f.feature] : f.current
          const isOverridden = overrides[f.feature] !== undefined
          const range = f.max - f.min
          const pctToSafe = range !== 0 ? ((f.safe - f.min) / range) * 100 : 50
          return (
            <div key={f.feature} className={`wif-slider-row ${f.key ? 'wif-key' : ''}`}>
              <div className="wif-slider-head">
                <span className="wif-slider-label">
                  {humanFeature(f.feature)}
                  {f.key && <span className="wif-key-chip">key</span>}
                </span>
                <span className="wif-slider-value mono" style={{ color: isOverridden ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {val.toFixed(4)} {isOverridden && <span style={{ fontSize: 10, color: 'var(--text-silver)' }}>• edited</span>}
                </span>
              </div>

              <div style={{ position: 'relative', padding: '4px 0' }}>
                <input
                  type="range"
                  className="wif-range"
                  min={f.min}
                  max={f.max}
                  step={f.step || range / 100}
                  value={val}
                  onChange={(e) => handleSlider(f.feature, e.target.value)}
                />
                {/* safe marker */}
                <div
                  title={`Safe avg: ${f.safe.toFixed(4)}`}
                  style={{
                    position: 'absolute',
                    left: `${pctToSafe}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 2,
                    height: 12,
                    background: 'var(--accent-silver)',
                    opacity: 0.7,
                    pointerEvents: 'none',
                  }}
                />
              </div>

              <div className="wif-slider-bounds mono">
                <span>{f.min.toFixed(2)}</span>
                <span style={{ color: 'var(--accent-silver)' }}>safe {f.safe.toFixed(2)}</span>
                <span>{f.max.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Result comparison */}
      <div className={`wif-result ${result ? 'wif-result-changed' : ''}`}>
        <div className="wif-cell">
          <div className="wif-cell-label">Baseline</div>
          <div className="wif-cell-score mono">{creditScore(baselineProb)}</div>
          <div className="wif-cell-band" style={{ color: baselineBand.color }}>{baselineBand.label.toUpperCase()}</div>
          <div className="wif-cell-prob mono">{pct(baselineProb, 1)} risk</div>
        </div>

        <div className="wif-arrow">→</div>

        <div className="wif-cell">
          <div className="wif-cell-label">{result ? 'Simulated' : 'Current (no changes)'}</div>
          <div className="wif-cell-score mono">{creditScore(newProb)}</div>
          <div className="wif-cell-band" style={{ color: newBand.color }}>{newBand.label.toUpperCase()}</div>
          <div className="wif-cell-prob mono">{pct(newProb, 1)} risk</div>
        </div>

        {result && (
          <div className={`wif-delta ${improved ? 'wif-delta-good' : 'wif-delta-bad'}`}>
            {improved ? '↓' : '↑'} {pct(Math.abs(delta), 2)} {improved ? 'lower risk' : 'higher risk'}
            {' · '}
            {creditScore(newProb) - creditScore(baselineProb) >= 0 ? '+' : ''}
            {creditScore(newProb) - creditScore(baselineProb)} score
          </div>
        )}

        {!result && hasOverrides && (
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {Object.keys(overrides).length} factor{Object.keys(overrides).length > 1 ? 's' : ''} changed — click Simulate
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
