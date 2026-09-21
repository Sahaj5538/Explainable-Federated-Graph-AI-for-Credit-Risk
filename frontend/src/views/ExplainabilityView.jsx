import React, { useEffect, useState } from 'react'
import { BrainCircuit, BarChart2, GitMerge } from 'lucide-react'
import { api } from '../api.js'
import ShapPanel from '../components/ShapPanel.jsx'

export default function ExplainabilityView({ onSelectAccount }) {
  const [selectedAccount, setSelectedAccount] = useState(789)
  const [importance, setImportance] = useState(null)

  useEffect(() => {
    api.importance()
      .then(setImportance)
      .catch(() => {})
  }, [])

  return (
    <div className="section-stack">
      {/* Banner */}
      <div className="titanium-card" style={{ background: 'linear-gradient(135deg, rgba(23, 28, 33, 0.9), rgba(13, 16, 19, 0.95))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="brand-logo-mark" style={{ minWidth: 44, height: 44 }}>
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              Explainable AI Attribution
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Dual-level explainability: <strong>feature-level attribution</strong> via Kernel SHAP and{' '}
              <strong>graph-level attribution</strong> via GNNExplainer gradient attributions & z-score
              deviations against the low-risk baseline population.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive SHAP inspector */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BrainCircuit className="card-header-icon" size={18} />
            <span>Account SHAP Explorer</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Account ID:</span>
            <input
              type="number"
              className="input-field"
              style={{ width: 120, padding: '6px 10px', fontSize: 13 }}
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(parseInt(e.target.value, 10) || 789)}
            />
          </div>
        </div>

        <ShapPanel accountId={selectedAccount} autoLoad />
      </div>

      {/* Global permutation importance */}
      {importance && (
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <BarChart2 className="card-header-icon" size={18} />
              <span>Global Permutation Importance (Macro-F1 drop)</span>
            </div>
          </div>

          <div className="bar-chart-stack">
            {importance.features.map((item) => {
              const maxVal = Math.max(...importance.features.map((f) => f.importance_drop), 0.001)
              const widthPct = (100 * Math.max(item.importance_drop, 0)) / maxVal
              return (
                <div key={item.feature} className="bar-row-grid">
                  <span className="bar-row-label">{item.feature}</span>
                  <div className="bar-track-bg">
                    <div className="bar-fill-silver" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="bar-row-val">{item.importance_drop.toFixed(4)}</span>
                </div>
              )
            })}
          </div>

          <div className="muted small" style={{ marginTop: 12 }}>
            <GitMerge size={12} style={{ display: 'inline', marginRight: 6 }} />
            Baseline Macro-F1 {importance.baseline_macro_f1.toFixed(4)} — shuffling a feature and
            measuring the drop quantifies how much the model relies on it.
          </div>
        </div>
      )}
    </div>
  )
}
