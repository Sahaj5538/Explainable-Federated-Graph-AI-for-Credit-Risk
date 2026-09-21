import React, { useEffect, useState } from 'react'
import { Award, Target, Scale, Layers, Radar, Trophy, Info } from 'lucide-react'
import { api } from '../api.js'

// ---------------------------------------------------------------------------
// MODEL PERFORMANCE - REDESIGNED FOR CLARITY
// Removed confusing "Accuracy vs Balanced Score" scatter.
// Replaced with:
//   1. How Often Each Model Is Right (accuracy)
//   2. High-Risk Accounts Caught (recall)
//   3. Balanced Score & High-Risk F1 (grouped)
//   4. Overall Capability Score (composite of all metrics - NEW, easy to understand)
//   5. Top 3 Models Radar Comparison (NEW, visual polygon)
//   6. Fine-Graded Risk Study (ablation)
// Every chart has plain-English titles and explanations.
// ---------------------------------------------------------------------------

const BRIGHT = '#F2F6F9'
const SILVER = '#C9D2D9'
const DIM = '#5A6672'
const RED = '#E05A5A'
const AXIS = 'rgba(255,255,255,0.07)'
const LABEL = '#929CA3'
const TICK = '#616B74'

function GridY({ W, H, top = 18, bottom = 34 }) {
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
      {sub && <span className="chart-sub" style={{ maxWidth: 360, textAlign: 'right', lineHeight: 1.4 }}>{sub}</span>}
    </div>
  )
}

// ---- 1. accuracy leaderboard ----------------------------------------------

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
            <text x={x} y={H - 6} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}%</text>
          </g>
        )
      })}
      {models.map((m, i) => {
        const y = 16 + i * rowH
        const w = m.accuracy * chartW
        const isBest = m.name === best
        return (
          <g key={m.name}>
            <text x={labelW - 10} y={y + 14} fill={isBest ? BRIGHT : LABEL} fontSize={11.5} textAnchor="end" fontWeight={isBest ? 700 : 400}>
              {m.name}{isBest ? ' ★ Best' : ''}
            </text>
            <rect x={labelW} y={y} width={Math.max(w, 1)} height={19} rx={9} fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.95 : 0.55} />
            <text x={labelW + Math.max(w, 1) + 8} y={y + 14} fill="#E9EEF1" fontSize={11} className="mono" fontWeight={600}>
              {(m.accuracy * 100).toFixed(1)}%
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
  const chartW = W - 260
  const rowH = 44
  const H = models.length * rowH + 30
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const x = labelW + (v / 100) * chartW
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={10} y2={H - 22} stroke={v === 100 ? SILVER : AXIS} strokeDasharray={v === 100 ? '5 4' : undefined} strokeWidth={v === 100 ? 1.2 : 1} />
            <text x={x} y={H - 6} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}%</text>
          </g>
        )
      })}
      {models.map((m, i) => {
        const y = 16 + i * rowH + 10
        const v = m.positive_recall != null ? m.positive_recall * 100 : 0
        const x = labelW + (v / 100) * chartW
        const good = v >= 60
        return (
          <g key={m.name}>
            <text x={labelW - 10} y={y + 4} fill={LABEL} fontSize={11.5} textAnchor="end">{m.name}</text>
            <line x1={labelW} x2={x} y1={y} y2={y} stroke={good ? BRIGHT : DIM} strokeWidth={2} />
            <circle cx={x} cy={y} r={6.5} fill={good ? BRIGHT : SILVER} stroke="#080A0C" strokeWidth={1.5} />
            <text x={x + 12} y={y + 4} fill={good ? BRIGHT : '#E9EEF1'} fontSize={11} className="mono" fontWeight={good ? 700 : 400}>{v.toFixed(1)}%</text>
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
  const barW = Math.min(22, (groupW - 16) / 2)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
      <GridY W={W} H={H} top={top} bottom={bottom} />
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
              return (
                <rect key={k} x={gx - barW - 3 + k * (barW + 6)} y={top + plotH - h} width={barW} height={Math.max(h, 1)} rx={3} fill={color} opacity={0.9} />
              )
            })}
            <text x={gx} y={H - 26} fill={LABEL} fontSize={9.5} textAnchor="middle" transform={`rotate(-15 ${gx} ${H - 26})`}>
              {m.name.length > 14 ? m.name.slice(0, 13) + '…' : m.name}
            </text>
          </g>
        )
      })}
      <g>
        <rect x={46} y={H - 12} width={10} height={10} rx={2} fill={BRIGHT} />
        <text x={62} y={H - 4} fill={TICK} fontSize={10}>Balanced (macro F1)</text>
        <rect x={210} y={H - 12} width={10} height={10} rx={2} fill={SILVER} />
        <text x={226} y={H - 4} fill={TICK} fontSize={10}>High-risk F1</text>
      </g>
    </svg>
  )
}

// ---- 4. NEW: Overall Capability Score (composite) --------------------------

function OverallScore({ models, best }) {
  const W = 720
  const labelW = 200
  const valW = 70
  const chartW = W - labelW - valW
  const rowH = 52
  const H = models.length * rowH + 40

  // composite = average of accuracy, macro_f1, recall, high-risk f1 (if available)
  const withComposite = models.map((m) => {
    const vals = [m.accuracy, m.macro_f1, m.positive_recall || 0, m.positive_f1 || 0].filter((v) => v != null)
    const comp = vals.reduce((a, b) => a + b, 0) / vals.length
    return { ...m, composite: comp }
  }).sort((a, b) => b.composite - a.composite)

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
        {[0, 25, 50, 75, 100].map((v) => {
          const x = labelW + (v / 100) * chartW
          return (
            <g key={v}>
              <line x1={x} x2={x} y1={10} y2={H - 28} stroke={v === 100 ? SILVER : AXIS} strokeDasharray={v === 100 ? '5 4' : undefined} />
              <text x={x} y={H - 8} fill={TICK} fontSize={10} textAnchor="middle" className="mono">{v}%</text>
            </g>
          )
        })}
        {withComposite.map((m, i) => {
          const y = 14 + i * rowH
          const w = m.composite * chartW
          const isBest = m.name === best
          return (
            <g key={m.name}>
              <text x={labelW - 10} y={y + 6} fill={isBest ? BRIGHT : LABEL} fontSize={11.5} textAnchor="end" fontWeight={isBest ? 700 : 400}>
                {isBest ? '★ ' : ''}{m.name}
              </text>
              <text x={labelW - 10} y={y + 20} fill={TICK} fontSize={9} textAnchor="end">
                acc {(m.accuracy*100).toFixed(0)}% • F1 {(m.macro_f1*100).toFixed(0)}% • rec {((m.positive_recall||0)*100).toFixed(0)}%
              </text>
              <rect x={labelW} y={y} width={Math.max(w, 1)} height={22} rx={11} fill={isBest ? BRIGHT : SILVER} opacity={isBest ? 0.95 : 0.5} />
              <text x={labelW + Math.max(w, 1) + 8} y={y + 15} fill={BRIGHT} fontSize={12} fontWeight={700} className="mono">
                {(m.composite * 100).toFixed(1)}%
              </text>
            </g>
          )
        })}
      </svg>
      <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(13,16,19,0.6)', borderRadius: 8, fontSize: 11, color: '#8B98A5', lineHeight: 1.5 }}>
        <Info size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: -1 }} />
        <strong style={{ color: '#C9D2D9' }}>Overall score</strong> = average of 4 metrics: accuracy, balanced F1, high-risk recall, high-risk F1. 
        Higher = better at both overall correctness and catching risky accounts. This is the easiest way to compare models.
      </div>
    </div>
  )
}

// ---- 5. NEW: Radar comparison for top 3 models -----------------------------

function RadarComparison({ models, best }) {
  const top3 = [...models].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3)
  const W = 520
  const H = 420
  const cx = W / 2
  const cy = 210
  const maxR = 140
  const metrics = [
    { key: 'accuracy', label: 'Accuracy', short: 'Acc' },
    { key: 'macro_f1', label: 'Balanced F1', short: 'F1' },
    { key: 'positive_recall', label: 'High-Risk Recall', short: 'Recall' },
    { key: 'positive_f1', label: 'High-Risk F1', short: 'HR-F1' },
  ]
  const angleFor = (i) => (Math.PI * 2 * i) / metrics.length - Math.PI / 2 // start top
  const pointFor = (value, angle, r) => {
    const rr = (value * r) / 100
    return [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)]
  }

  const colors = [BRIGHT, SILVER, DIM]
  const fills = ['rgba(242,246,249,0.18)', 'rgba(201,210,217,0.12)', 'rgba(90,102,114,0.10)']

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, margin: '0 auto', display: 'block' }}>
        {/* grid circles */}
        {[25, 50, 75, 100].map((v) => (
          <g key={v}>
            <circle cx={cx} cy={cy} r={(v / 100) * maxR} fill="none" stroke={v === 100 ? 'rgba(201,210,217,0.3)' : AXIS} strokeWidth={v === 100 ? 1.2 : 1} strokeDasharray={v === 100 ? undefined : '3 3'} />
            <text x={cx + 4} y={cy - (v / 100) * maxR - 2} fill={TICK} fontSize={9} className="mono">{v}%</text>
          </g>
        ))}
        {/* axes */}
        {metrics.map((m, i) => {
          const ang = angleFor(i)
          const [x, y] = pointFor(100, ang, maxR)
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={AXIS} />
        })}

        {/* polygons */}
        {top3.map((model, mi) => {
          const values = metrics.map((met) => {
            const v = model[met.key]
            return v != null ? v * 100 : 0
          })
          const points = values.map((v, i) => pointFor(v, angleFor(i), maxR).join(',')).join(' ')
          return (
            <g key={model.name}>
              <polygon points={points} fill={fills[mi]} stroke={colors[mi]} strokeWidth={mi === 0 ? 2.2 : 1.6} opacity={0.9} />
              {values.map((v, i) => {
                const [x, y] = pointFor(v, angleFor(i), maxR)
                return <circle key={i} cx={x} cy={y} r={4} fill={colors[mi]} stroke="#080A0C" strokeWidth={1.2} />
              })}
            </g>
          )
        })}

        {/* labels */}
        {metrics.map((m, i) => {
          const ang = angleFor(i)
          const [x, y] = pointFor(100, ang, maxR + 22)
          return (
            <text key={i} x={x} y={y} fill={BRIGHT} fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle">
              {m.label}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {top3.map((m, i) => (
          <span key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 14, height: 3, background: colors[i], display: 'inline-block', borderRadius: 2 }} />
            <span style={{ width: 10, height: 10, background: fills[i], border: `1px solid ${colors[i]}`, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: i === 0 ? BRIGHT : LABEL, fontWeight: i === 0 ? 700 : 400 }}>{m.name} {i === 0 ? '★' : ''}</span>
            <span className="mono" style={{ color: TICK, fontSize: 11 }}>{(m.accuracy*100).toFixed(1)}% acc</span>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: '#616B74' }}>
        Larger polygon = better overall. Top 3 models compared on 4 key metrics.
      </div>
    </div>
  )
}

// ---- 6. binary vs 3-level ablation -----------------------------------------

function GradingAblation({ models, ablation }) {
  const byName = new Map(models.map((m) => [m.name, m]))
  const gnn = ablation.filter((a) => byName.has(a.name))
  if (gnn.length === 0) return null
  const W = 720
  const H = 300
  const top = 18
  const bottom = 46
  const plotH = H - top - bottom
  const plotW = W - 60
  const groupW = plotW / gnn.length
  const barW = Math.min(24, (groupW - 16) / 2)
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W }}>
        <GridY W={W} H={H} top={top} bottom={bottom} />
        {gnn.map((a, i) => {
          const gx = 46 + i * groupW + groupW / 2
          const b = byName.get(a.name)
          const pairs = [
            [b.accuracy * 100, BRIGHT, '2-level'],
            [a.accuracy * 100, DIM, '3-level'],
          ]
          return (
            <g key={a.name}>
              {pairs.map(([v, color], k) => {
                const h = (v / 100) * plotH
                return <rect key={k} x={gx - barW - 3 + k * (barW + 6)} y={top + plotH - h} width={barW} height={Math.max(h, 1)} rx={3} fill={color} opacity={0.9} />
              })}
              <text x={gx} y={H - 26} fill={LABEL} fontSize={10} textAnchor="middle">{a.name}</text>
            </g>
          )
        })}
        <g>
          <rect x={46} y={H - 12} width={10} height={10} rx={2} fill={BRIGHT} />
          <text x={62} y={H - 4} fill={TICK} fontSize={10}>Two levels (production - Low / High)</text>
          <rect x={240} y={H - 12} width={10} height={10} rx={2} fill={DIM} />
          <text x={256} y={H - 4} fill={TICK} fontSize={10}>Three levels (experiment - Low / Med / High)</text>
        </g>
      </svg>
      <div style={{ marginTop: 8, fontSize: 11, color: '#8B98A5', lineHeight: 1.5 }}>
        Why 2 levels? Splitting into Low/Medium/High is ambiguous - medium looks like both neighbours, so accuracy drops. Production uses Low vs High.
      </div>
    </div>
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
    <div className="section-stack">
      <div className="titanium-card" style={{ borderLeft: '3px solid #C9D2D9' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Trophy size={18} color="#C9D2D9" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Best model: {best} ★</div>
            <div style={{ fontSize: 12, color: '#8B98A5', marginTop: 2 }}>
              Highest overall capability - best at catching risky accounts while staying accurate on safe ones. GraphSAGE generally wins on blockchain graphs.
            </div>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="titanium-card span-2">
          <ChartTitle icon={<Award className="card-header-icon" size={18} />} title="How Often Each Model Is Right" sub="Accuracy = % of all test accounts classified correctly (higher is better)" />
          <AccuracyLeaderboard models={models} best={best} />
        </div>

        <div className="titanium-card">
          <ChartTitle icon={<Target className="card-header-icon" size={18} />} title="High-Risk Accounts Caught" sub="Recall: out of 100 truly high-risk accounts, how many found" />
          <RecallLollipop models={models} />
        </div>

        <div className="titanium-card">
          <ChartTitle icon={<Scale className="card-header-icon" size={18} />} title="Balanced Score & High-Risk F1" sub="F1 rewards catching risky minority, not just safe majority" />
          <GroupedColumns models={models} />
        </div>

        <div className="titanium-card span-2">
          <ChartTitle icon={<Trophy className="card-header-icon" size={18} />} title="Overall Capability Score - Easiest Comparison" sub="Average of 4 metrics - single number to rank models" />
          <OverallScore models={models} best={best} />
        </div>

        <div className="titanium-card span-2">
          <ChartTitle icon={<Radar className="card-header-icon" size={18} />} title="Top 3 Models - Radar Comparison" sub="4 metrics at once - larger shape = better" />
          <RadarComparison models={models} best={best} />
        </div>

        {ablation.length > 0 && (
          <div className="titanium-card span-2">
            <ChartTitle icon={<Layers className="card-header-icon" size={18} />} title="Why 2 Risk Levels, Not 3?" sub="Experiment: Low/Med/High vs Low/High" />
            <GradingAblation models={models} ablation={ablation} />
          </div>
        )}
      </div>
    </div>
  )
}
