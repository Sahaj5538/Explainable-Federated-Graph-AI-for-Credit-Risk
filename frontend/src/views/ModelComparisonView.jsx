import React, { useEffect, useState } from 'react'
import { BarChart3, Award, ScatterChart } from 'lucide-react'
import { api } from '../api.js'

// ---------------------------------------------------------------------------
// MODEL PERFORMANCE - every chart on an ABSOLUTE 0-100 scale.
// 100 is the perfect baseline drawn as a dashed reference line - models are
// never compared against the best model in the set.
//
// Three visualizations:
//   1. Accuracy leaderboard (horizontal bars, 0-100 + baseline line)
//   2. Multi-metric grouped bars (accuracy / macro F1 / high-risk recall)
//   3. Accuracy vs Macro-F1 scatter (point size = high-risk recall)
// ---------------------------------------------------------------------------

const SILVER = '#C9D2D9'
const DIM = '#5A6672'
const BRIGHT = '#F2F6F9'

export default function ModelComparisonView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.modelPerformance().then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error">Could not load model metrics: {error}</div>
  if (!data) return <div className="loading-state"><div className="spinner-ring" /><span>Loading evaluation metrics…</span></div>

  const models = [...data.models].sort((a, b) => b.accuracy - a.accuracy)
  const best = data.best_model

  const W = 760
  const rowH = 42
  const H = models.length * rowH + 40
  const labelW = 190
  const chartW = W - labelW - 70

  // ---- grouped bars geometry ----
  const gW = 760
  const gH = 300
  const plotW = gW - 60
  const plotH = gH - 50
  const groupW = plotW / models.length
  const barW = Math.min(22, (groupW - 14) / 3)

  // ---- scatter geometry ----
  const sW = 760
  const sH = 340
  const scPlotW = sW - 70
  const scPlotH = sH - 60

  const sc = (v) => 40 + (v / 100) * scPlotW
  const sy = (v) => 20 + (1 - v / 100) * scPlotH

  return (
    <div className="section-stack">
      {/* note */}
      <div className="titanium-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BarChart3 size={18} className="text-silver" />
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          All metrics are plotted on an absolute <strong style={{ color: 'var(--text-primary)' }}>0–100 scale</strong> —
          the dashed line marks <strong style={{ color: 'var(--text-primary)' }}>100 (perfect baseline)</strong>, not the
          best model in the set. Best model: <strong style={{ color: 'var(--text-primary)' }}>{best}</strong>
        </div>
      </div>

      {/* 1. Accuracy leaderboard */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Award className="card-header-icon" size={18} />
            <span>Test Accuracy Leaderboard (0–100)</span>
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
          {/* baseline gridlines at 0/25/50/75/100 */}
          {[0, 25, 50, 75, 100].map((v) => {
            const x = labelW + (v / 100) * chartW
            return (
              <g key={v}>
                <line
                  x1={x} x2={x} y1={14} y2={H - 24}
                  stroke={v === 100 ? '#C9D2D9' : 'rgba(255,255,255,0.07)'}
                  strokeDasharray={v === 100 ? '5 4' : undefined}
                  strokeWidth={v === 100 ? 1.2 : 1}
                />
                <text x={x} y={H - 8} fill="#616B74" fontSize={10} textAnchor="middle" className="mono">
                  {v}
                </text>
              </g>
            )
          })}
          {models.map((m, i) => {
            const y = 20 + i * rowH
            const w = (m.accuracy * 100 / 100) * chartW
            const isBest = m.name === best
            return (
              <g key={m.name}>
                <text x={labelW - 10} y={y + 13} fill={isBest ? BRIGHT : '#929CA3'} fontSize={11.5} textAnchor="end">
                  {m.name}{isBest ? ' ★' : ''}
                </text>
                <rect x={labelW} y={y} width={Math.max(w, 1)} height={18} rx={3}
                  fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.95 : 0.55} />
                <text x={labelW + Math.max(w, 1) + 8} y={y + 13} fill="#E9EEF1" fontSize={11} className="mono">
                  {(m.accuracy * 100).toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 2. Multi-metric grouped bars */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BarChart3 className="card-header-icon" size={18} />
            <span>Multi-Metric Comparison (0–100)</span>
          </div>
          <div className="chart-legend">
            <span className="legend-swatch" style={{ background: BRIGHT }} /> accuracy
            <span className="legend-swatch" style={{ background: SILVER }} /> macro F1
            <span className="legend-swatch" style={{ background: DIM }} /> high-risk recall
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`} style={{ maxWidth: gW }}>
          {[0, 25, 50, 75, 100].map((v) => {
            const y = 20 + (1 - v / 100) * plotH
            return (
              <g key={v}>
                <line x1={40} x2={40 + plotW} y1={y} y2={y}
                  stroke={v === 100 ? '#C9D2D9' : 'rgba(255,255,255,0.07)'}
                  strokeDasharray={v === 100 ? '5 4' : undefined} strokeWidth={v === 100 ? 1.2 : 1} />
                <text x={32} y={y + 3} fill="#616B74" fontSize={10} textAnchor="end" className="mono">{v}</text>
              </g>
            )
          })}
          {models.map((m, i) => {
            const gx = 40 + i * groupW + groupW / 2
            const metrics = [
              [m.accuracy, BRIGHT],
              [m.macro_f1, SILVER],
              [m.positive_recall != null ? m.positive_recall : 0, DIM],
            ]
            return (
              <g key={m.name}>
                {metrics.map(([val, color], k) => {
                  const h = (val / 100) * plotH
                  const x = gx - (barW * 3 + 8) / 2 + k * (barW + 4)
                  return (
                    <g key={k}>
                      <rect x={x} y={20 + plotH - h} width={barW} height={Math.max(h, 1)} rx={2} fill={color} opacity={0.85} />
                      {k === 0 && (
                        <text x={x + barW / 2} y={20 + plotH - h - 5} fill="#929CA3" fontSize={9} textAnchor="middle" className="mono">
                          {(val * 100).toFixed(0)}
                        </text>
                      )}
                    </g>
                  )
                })}
                <text x={gx} y={gH - 12} fill="#929CA3" fontSize={10} textAnchor="middle">
                  {m.name.length > 16 ? m.name.slice(0, 15) + '…' : m.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 3. Scatter: accuracy vs macro F1 */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ScatterChart className="card-header-icon" size={18} />
            <span>Accuracy vs Macro F1 (point size = high-risk recall)</span>
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${sW} ${sH}`} style={{ maxWidth: sW }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={sc(v)} x2={sc(v)} y1={20} y2={20 + scPlotH} stroke="rgba(255,255,255,0.05)" />
              <line x1={40} x2={40 + scPlotW} y1={sy(v)} y2={sy(v)} stroke="rgba(255,255,255,0.05)" />
              <text x={sc(v)} y={sH - 18} fill="#616B74" fontSize={10} textAnchor="middle" className="mono">{v}</text>
              <text x={32} y={sy(v) + 3} fill="#616B74" fontSize={10} textAnchor="end" className="mono">{v}</text>
            </g>
          ))}
          <text x={sW / 2} y={sH - 2} fill="#616B74" fontSize={10} textAnchor="middle">accuracy (%)</text>
          <text x={10} y={sH / 2} fill="#616B74" fontSize={10} textAnchor="middle"
            transform={`rotate(-90 10 ${sH / 2})`}>macro F1 (%)</text>
          {models.map((m) => {
            const r = 5 + (m.positive_recall != null ? m.positive_recall : 0) * 9
            const isBest = m.name === best
            return (
              <g key={m.name}>
                <circle cx={sc(m.accuracy * 100)} cy={sy(m.macro_f1 * 100)} r={r}
                  fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.9 : 0.55} stroke="#080A0C" strokeWidth={1.5} />
                <text x={sc(m.accuracy * 100) + r + 5} y={sy(m.macro_f1 * 100) + 3}
                  fill={isBest ? BRIGHT : '#929CA3'} fontSize={10}>
                  {m.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
