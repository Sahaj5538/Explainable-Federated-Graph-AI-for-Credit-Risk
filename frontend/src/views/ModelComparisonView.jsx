import React, { useEffect, useState } from 'react'
import { Trophy, BarChart3, HelpCircle, Layers, Cpu, ShieldCheck, Zap, RefreshCw, Database } from 'lucide-react'
import { api, pct } from '../api.js'

export default function ModelComparisonView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedMetric, setSelectedMetric] = useState('macro_f1')

  const fetchMetrics = () => {
    setLoading(true)
    setError(null)
    api.modelPerformance()
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner-ring" />
        <span>Loading model evaluation results from backend pipeline...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="section-stack">
        <div className="titanium-card">
          <div className="card-header-title" style={{ marginBottom: 12, color: 'var(--risk-high)' }}>
            Model Performance Engine Unavailable
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Unable to retrieve evaluation results from the backend evaluation pipeline: {error || 'No response'}
          </p>
          <button className="btn btn-primary" onClick={fetchMetrics}>
            <RefreshCw size={14} /> Retry Connecting to Evaluation Pipeline
          </button>
        </div>
      </div>
    )
  }

  const models = data.models || []
  const bestModelName = data.best_model || 'GraphSAGE'
  const winner = models.find((m) => m.name === bestModelName) || models[0]

  const metricsConfig = [
    { id: 'macro_f1', label: 'Macro F1 Score', desc: 'Balanced metric across Low and High risk classes.' },
    { id: 'accuracy', label: 'Test Accuracy', desc: 'Overall percentage of correct risk predictions.' },
    { id: 'positive_recall', label: 'HIGH RISK Recall', desc: 'Percentage of actual liquidation accounts correctly detected.' },
    { id: 'positive_f1', label: 'HIGH RISK F1', desc: 'F1 harmonic score specifically on the HIGH RISK class.' },
  ]

  return (
    <div className="section-stack">
      {/* Top Banner & Dynamic Winner Identification */}
      <div className="titanium-card" style={{ border: '1px solid rgba(32, 201, 151, 0.4)', background: 'linear-gradient(135deg, rgba(32, 201, 151, 0.08), rgba(23, 28, 33, 0.95))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--accent-emerald-glow)', border: '1px solid var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
              <Trophy size={26} style={{ margin: 'auto' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-emerald)', marginBottom: 2 }}>
                Top Performing Model Architecture
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                {winner?.name} ({winner?.category})
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Dynamically calculated from backend evaluation checkpoints on held-out test split.
              </p>
            </div>
          </div>

          {winner && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '10px 18px', backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Test Accuracy</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-emerald)' }}>{pct(winner.accuracy)}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 18px', backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Macro F1</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-emerald)' }}>{pct(winner.macro_f1)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Metric Switcher & Horizontal Bar Chart */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BarChart3 className="card-header-icon" size={18} />
            <span>Model Performance — Comparison of traditional machine learning and graph neural network approaches</span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {metricsConfig.map((m) => (
              <button
                key={m.id}
                className={`btn btn-sm ${selectedMetric === m.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedMetric(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bar-chart-stack" style={{ marginTop: 16 }}>
          {models.map((m) => {
            const val = m[selectedMetric]
            const isGNN = m.category === 'GNN'
            const isWinner = m.name === bestModelName

            if (val === null || val === undefined) return null

            const maxVal = Math.max(...models.map((x) => x[selectedMetric] || 0), 0.01)
            const widthPct = (100 * val) / maxVal

            return (
              <div className="bar-row-grid" key={m.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bar-row-label" style={{ fontWeight: isWinner ? 600 : 400, color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, backgroundColor: isGNN ? 'rgba(32, 201, 151, 0.12)' : 'rgba(255, 255, 255, 0.06)', color: isGNN ? 'var(--accent-emerald)' : 'var(--text-tertiary)' }}>
                    {m.category}
                  </span>
                </div>

                <div className="bar-track-bg">
                  <div
                    className={isGNN ? 'bar-fill-emerald' : 'bar-fill-gold'}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <span className="bar-row-val" style={{ fontWeight: 600 }}>{pct(val)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Model Benchmark Data Table */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Layers className="card-header-icon" size={18} />
            <span>Evaluated Model Metrics Table (Backend Checkpoints)</span>
          </div>
        </div>

        <div className="table-container">
          <table className="vertex-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Category</th>
                <th>Accuracy</th>
                <th>Macro F1</th>
                <th>HIGH RISK Recall</th>
                <th>HIGH RISK F1</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.name} style={{ backgroundColor: m.name === bestModelName ? 'rgba(32, 201, 151, 0.04)' : 'transparent' }}>
                  <td style={{ fontWeight: m.name === bestModelName ? 600 : 400 }}>
                    {m.name} {m.name === bestModelName ? '★' : ''}
                  </td>
                  <td>
                    <span className="risk-badge low" style={{ fontSize: 10, backgroundColor: m.category === 'GNN' ? 'rgba(32, 201, 151, 0.1)' : 'rgba(214, 168, 79, 0.1)', color: m.category === 'GNN' ? 'var(--accent-emerald)' : 'var(--accent-gold)' }}>
                      {m.category}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{pct(m.accuracy)}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>{pct(m.macro_f1)}</td>
                  <td className="mono">{m.positive_recall !== null ? pct(m.positive_recall) : 'N/A'}</td>
                  <td className="mono">{m.positive_f1 !== null ? pct(m.positive_f1) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-Technical Metric Glossary */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <HelpCircle className="card-header-icon" size={18} />
            <span>Non-Technical Metric Glossary</span>
          </div>
        </div>

        <div className="grid-4">
          <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 6 }}>Accuracy</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "How often the model makes the correct overall prediction across all accounts."
            </p>
          </div>

          <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 6 }}>Precision</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "When the model predicts high risk, how often is it actually correct?"
            </p>
          </div>

          <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 6 }}>Recall</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "How many of the actual high-risk wallets did the model detect?"
            </p>
          </div>

          <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 6 }}>F1 Score</h4>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              "A balance between precision and recall."
            </p>
          </div>
        </div>
      </div>

      {/* Data Provenance & Pipeline Source */}
      <div className="titanium-card">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Database size={20} className="text-emerald" />
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Data Provenance:</strong> Evaluation results generated dynamically by the VERTEX model evaluation pipeline (`backend.evaluation.compare_models`) from saved PyTorch checkpoints in `backend/model/saved_models/`. Test set: 152 held-out account nodes.
          </div>
        </div>
      </div>
    </div>
  )
}
