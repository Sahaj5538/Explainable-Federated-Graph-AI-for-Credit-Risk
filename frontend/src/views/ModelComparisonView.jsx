import React, { useEffect, useState } from 'react'
import { Award, Target, Scale, ScatterChart, Layers } from 'lucide-react'
import { api } from '../api.js'

// ---------------------------------------------------------------------------
// MODEL PERFORMANCE — one clear chart per metric, each in its own card.
//
//   1. How Often Each Model Is Right      (accuracy — bar leaderboard)
//   2. High-Risk Accounts Caught          (recall — lollipop)
//   3. Balanced Score & High-Risk F1      (macro F1 + high-risk F1 — columns)
//   4. Accuracy vs Balanced Score         (scatter, size = recall)
//   5. Fine-Graded Risk Study             (binary vs 3-level — ablation)
//
// Every chart uses the full 0-100 scale; the dashed line at 100 marks a
// perfect score. No jargon paragraphs — titles say what the chart shows.
// ---------------------------------------------------------------------------

const BRIGHT = '#F2F6F9'
const SILVER = '#C9D2D9'
const DIM = '#5A6672'
const RED = '#E05A5A'
const AXIS = 'rgba(255,255,255,0.07)'
const LABEL = '#929CA3'
const TICK = '#616B74'

function GridY({ scale, W, H, top = 18, bottom = 34 }) {
  const plotH = H - top - bottom
  return [0, 25, 50, 75, 100].map((v) => {
    const y = top + (1 - v / 100) * plotH
    return (
      <g key={v}>
        <line x1={46} x2={W - 14} y1={y} y2={y} stroke={v === 100 ? SILVER : AXIS} strokeDasharray={v === 100 ? '5 4' : undefined} strokeWidth={v === 100 ? 1.2 : 1} />
        <text x={38} y={y + 3} fill={TICK} fontSize={10} textAnchor="end" className="mono">{v}</text>
      </g>
    )
  })
}

function ChartTitle({ icon, title, sub }) {
  return (
    <div className="card-header">
      <div className="card-header-title">
        {icon}
        <span>{title}</span>
      </div>
      {sub && <span className="chart-sub">{sub}</span>}
    </div>
  )
}

// ---- 1. accuracy leaderboard (horizontal bars) ----------------------------

function AccuracyLeaderboard({ models, best }) {
  const W = 720
  const labelW = 200
  const valW = 60
  const chartW = W - labelW - valW
  const rowH = 44
  const H = models.length * rowH + 30
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const x = labelW + (v / 100) * chartW
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={10} y2={H - 22} stroke={v === 100 ? SILVER : AXIS} strokeDasharray={v === 100 ? '5 4' : undefined} strokeWidth={v === 100 ? 1.2 : 1} />
            <text x={x} y={H - 6} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}</text>
          </g>
        )
      })}
      {models.map((m, i) => {
        const y = 16 + i * rowH
        const w = m.accuracy * 100 * chartW / 100
        const isBest = m.name === best
        return (
          <g key={m.name}>
            <text x={labelW - 10} y={y + 14} fill={isBest ? BRIGHT : LABEL} fontSize={11.5} textAnchor="end">
              {m.name}{isBest ? ' ★' : ''}
            </text>
            <rect x={labelW} y={y} width={Math.max(w, 1)} height={19} rx={3}
              fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.95 : 0.55} />
            <text x={labelW + Math.max(w, 1) + 8} y={y + 14} fill="#E9EEF1" fontSize={11} className="mono">
              {(m.accuracy * 100).toFixed(1)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- 2. recall lollipop ----------------------------------------------------

function RecallLollipop({ models }) {
  const W = 720
  const labelW = 200
  const valW = 60
  const chartW = W - labelW - valW
  const rowH = 44
  const H = models.length * rowH + 30
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const x = labelW + (v / 100) * chartW
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={10} y2={H - 22} stroke={v === 100 ? SILVER : AXIS} strokeDasharray={v === 100 ? '5 4' : undefined} strokeWidth={v === 100 ? 1.2 : 1} />
            <text x={x} y={H - 6} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}</text>
          </g>
        )
      })}
      {models.map((m, i) => {
        const y = 16 + i * rowH + 10
        const v = m.positive_recall != null ? m.positive_recall * 100 : 0
        const x = labelW + (v / 100) * chartW
        return (
          <g key={m.name}>
            <text x={labelW - 10} y={y + 4} fill={LABEL} fontSize={11.5} textAnchor="end">{m.name}</text>
            <line x1={labelW} x2={x} y1={y} y2={y} stroke={DIM} strokeWidth={2} />
            <circle cx={x} cy={y} r={6.5} fill={v >= 60 ? BRIGHT : SILVER} stroke="#080A0C" strokeWidth={1.5} />
            <text x={W - 8} y={y + 4} fill="#E9EEF1" fontSize={11} textAnchor="end" className="mono">{v.toFixed(1)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- 3. grouped columns: macro F1 + high-risk F1 ---------------------------

function GroupedColumns({ models }) {
  const W = 720
  const H = 320
  const top = 18
  const bottom = 46
  const plotH = H - top - bottom
  const plotW = W - 60
  const groupW = plotW / models.length
  const barW = Math.min(26, (groupW - 16) / 2)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      <GridY scale={null} W={W} H={H} top={top} bottom={bottom} />
      {models.map((m, i) => {
        const gx = 46 + i * groupW + groupW / 2
        const f1 = m.macro_f1 * 100
        const hf1 = (m.positive_f1 != null ? m.positive_f1 : 0) * 100
        return (
          <g key={m.name}>
            {[
              [f1, BRIGHT],
              [hf1, SILVER],
            ].map(([v, color], k) => {
              const h = (v / 100) * plotH
              const x = gx - barW - 3 + k * (barW * 2 + 6) - barW / 2
              return (
                <rect key={k} x={gx - barW - 3 + k * (barW + 6)} y={top + plotH - h}
                  width={barW} height={Math.max(h, 1)} rx={2} fill={color} opacity={0.9} />
              )
            })}
            <text x={gx} y={H - 26} fill={LABEL} fontSize={10} textAnchor="middle">
              {m.name.length > 15 ? m.name.slice(0, 14) + '…' : m.name}
            </text>
          </g>
        )
      })}
      <g>
        <rect x={46} y={H - 12} width={10} height={10} rx={2} fill={BRIGHT} />
        <text x={62} y={H - 4} fill={TICK} fontSize={10}>balanced score (macro F1)</text>
        <rect x={230} y={H - 12} width={10} height={10} rx={2} fill={SILVER} />
        <text x={246} y={H - 4} fill={TICK} fontSize={10}>high-risk F1</text>
      </g>
    </svg>
  )
}

// ---- 4. scatter ------------------------------------------------------------

function AccuracyScatter({ models, best }) {
  const W = 720
  const H = 360
  const top = 20
  const bottom = 52
  const l = 46
  const plotW = W - l - 24
  const plotH = H - top - bottom
  const sc = (v) => l + ((v * 100) / 100) * plotW
  const sy = (v) => top + (1 - (v * 100) / 100) * plotH
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={sc(v / 100)} x2={sc(v / 100)} y1={top} y2={top + plotH} stroke={AXIS} />
          <line x1={l} x2={l + plotW} y1={sy(v / 100)} y2={sy(v / 100)} stroke={AXIS} />
          <text x={sc(v / 100)} y={top + plotH + 18} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}</text>
          <text x={l - 8} y={sy(v / 100) + 3} fill={TICK} fontSize={10} textAnchor="end" className="mono">{v}</text>
        </g>
      ))}
      <text x={l + plotW / 2} y={H - 16} fill={TICK} fontSize={10} textAnchor="middle">accuracy (%)</text>
      <text x={14} y={top + plotH / 2} fill={TICK} fontSize={10} textAnchor="middle" transform={`rotate(-90 14 ${top + plotH / 2})`}>balanced score (%)</text>
      {models.map((m) => {
        const r = 5 + (m.positive_recall != null ? m.positive_recall : 0) * 9
        const isBest = m.name === best
        return (
          <g key={m.name}>
            <circle cx={sc(m.accuracy)} cy={sy(m.macro_f1)} r={r}
              fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.9 : 0.55} stroke="#080A0C" strokeWidth={1.5} />
            <text x={sc(m.accuracy) + r + 5} y={sy(m.macro_f1) + 3} fill={isBest ? BRIGHT : LABEL} fontSize={10}>
              {m.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ---- 5. binary vs 3-level ablation -----------------------------------------

function GradingAblation({ models, ablation }) {
  const byName = new Map(models.map((m) => [m.name, m]))
  const gnn = ablation.filter((a) => byName.has(a.name))
  if (gnn.length === 0) return null
  const W = 720
  const H = 320
  const top = 18
  const bottom = 46
  const plotH = H - top - bottom
  const plotW = W - 60
  const groupW = plotW / gnn.length
  const barW = Math.min(26, (groupW - 16) / 2)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      <GridY scale={null} W={W} H={H} top={top} bottom={bottom} />
      {gnn.map((a, i) => {
        const gx = 46 + i * groupW + groupW / 2
        const b = byName.get(a.name)
        const pairs = [
          [b.accuracy * 100, BRIGHT],
          [a.accuracy * 100, DIM],
        ]
        return (
          <g key={a.name}>
            {pairs.map(([v, color], k) => {
              const h = (v / 100) * plotH
              return (
                <rect key={k} x={gx - barW - 3 + k * (barW + 6)} y={top + plotH - h}
                  width={barW} height={Math.max(h, 1)} rx={2} fill={color} opacity={0.9} />
              )
            })}
            <text x={gx} y={H - 26} fill={LABEL} fontSize={10} textAnchor="middle">{a.name}</text>
          </g>
        )
      })}
      <g>
        <rect x={46} y={H - 12} width={10} height={10} rx={2} fill={BRIGHT} />
        <text x={62} y={H - 4} fill={TICK} fontSize={10}>two levels (production)</text>
        <rect x={220} y={H - 12} width={10} height={10} rx={2} fill={DIM} />
        <text x={236} y={H - 4} fill={TICK} fontSize={10}>three levels (experiment)</text>
      </g>
    </svg>
  )
}

// ---- the view ---------------------------------------------------------------

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
  const ablation = data.ablation || []

  return (
    <div className="chart-grid">
      <div className="titanium-card span-2">
        <ChartTitle
          icon={<Award className="card-header-icon" size={18} />}
          title="How Often Each Model Is Right"
          sub="accuracy — share of all test accounts classified correctly"
        />
        <AccuracyLeaderboard models={models} best={best} />
      </div>

      <div className="titanium-card">
        <ChartTitle
          icon={<Target className="card-header-icon" size={18} />}
          title="High-Risk Accounts Caught"
          sub="out of every 100 truly high-risk accounts, how many the model finds"
        />
        <RecallLollipop models={models} />
      </div>

      <div className="titanium-card">
        <ChartTitle
          icon={<Scale className="card-header-icon" size={18} />}
          title="Balanced Score & High-Risk F1"
          sub="rewards catching the risky minority, not just the safe majority"
        />
        <GroupedColumns models={models} />
      </div>

      <div className="titanium-card span-2">
        <ChartTitle
          icon={<ScatterChart className="card-header-icon" size={18} />}
          title="Accuracy vs Balanced Score"
          sub="larger circles catch more high-risk accounts"
        />
        <AccuracyScatter models={models} best={best} />
      </div>

      {ablation.length > 0 && (
        <div className="titanium-card span-2">
          <ChartTitle
            icon={<Layers className="card-header-icon" size={18} />}
            title="Fine-Graded Risk Study — Two Levels vs Three Levels"
            sub="a secondary experiment: grading accounts Low / Medium / High instead of Low / High"
          />
          <GradingAblation models={models} ablation={ablation} />
          <div className="muted small" style={{ marginTop: 10 }}>
            Separating a middle "medium" grade from its neighbours is intrinsically
            ambiguous, which is why accuracy drops — the production task uses two levels.
          </div>
        </div>
      )}
    </div>
  )
}
