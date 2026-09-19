import React, { useEffect, useState } from 'react'
import { BrainCircuit, GitMerge, BarChart2, HelpCircle, ArrowRight } from 'lucide-react'
import { api } from '../api.js'
import ShapPanel from '../components/ShapPanel.jsx'

export default function ExplainabilityView({ onSelectAccount }) {
  const [selectedAccount, setSelectedAccount] = useState(789)
  const [importance, setImportance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.importance()
      .then(setImportance)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="section-stack">
      {/* Overview Banner */}
      <div className="titanium-card" style={{ background: 'linear-gradient(135deg, rgba(23, 28, 33, 0.9), rgba(13, 16, 19, 0.95))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="brand-logo-mark" style={{ minWidth: 44, height: 44 }}>
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              Explainable AI (XAI) Attribution Suite
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWdith: 900, lineHeight: 1.6 }}>
              VERTEX provides dual-level explainability: <strong>Feature-Level Attribution</strong> via Kernel SHAP and <strong>Graph-Level Attribution</strong> via GNNExplainer gradient attributions & z-score deviations against solvent baseline populations.
            </p>
          </div>
        </div>
      </div>

      {/* Dual Explanation Architecture Overview */}
      <div className="grid-2">
        {/* Feature-Level Explanation Card */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <BarChart2 className="card-header-icon" size={18} />
              <span>1. Feature-Level Attribution (SHAP)</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>"What tabular features influenced this prediction?"</strong>
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Kernel SHAP computes exact Shapley values across 300 background feature permutations, quantifying the marginal contribution of each financial metric relative to the Low-Risk mean baseline.
            </p>
          </div>
        </div>

        {/* Graph-Level Explanation Card */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <GitMerge className="card-header-icon" size={18} />
              <span>2. Graph-Level Attribution (GNNExplainer)</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>"What structural graph relationships influenced this prediction?"</strong>
            </p>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              GNNExplainer extracts the optimal sub-graph mask and node feature attributions using Integrated-Gradients, highlighting connected counterparty wallets and DeFi protocol interactions.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Account SHAP Inspector */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <BrainCircuit className="card-header-icon" size={18} />
            <span>Interactive Account XAI Explorer</span>
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

      {/* Global Feature Importance Matrix */}
      {importance && (
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <BarChart2 className="card-header-icon" size={18} />
              <span>Global Graph Permutation Feature Importance</span>
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
                    <div className="bar-fill-emerald" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="bar-row-val">{item.importance_drop.toFixed(4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
