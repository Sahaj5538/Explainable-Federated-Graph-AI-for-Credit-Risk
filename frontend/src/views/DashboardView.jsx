import React, { useEffect, useState } from 'react'
import {
  Users,
  ShieldAlert,
  Activity,
  Award,
  Layers,
  Network,
  ArrowRight,
  BrainCircuit,
  Lock,
  ChevronRight
} from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'
import MetricCard from '../components/MetricCard.jsx'
import NetworkGraphCanvas from '../components/NetworkGraphCanvas.jsx'

export default function DashboardView({ onNavigateTab, onSelectAccount }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.stats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-state"><div className="spinner-ring" /><span>Loading Intelligence Dashboard…</span></div>
  if (error) return <div className="error">Dashboard load error: {error}</div>

  const model = stats.model
  const dataset = stats.dataset
  const fed = stats.clients
  const topFeatures = stats.top_features || []

  const highRiskRatio = dataset.actual_high_risk / (dataset.accounts || 1)
  const lowRiskCount = dataset.accounts - dataset.actual_high_risk

  return (
    <div className="section-stack">
      {/* Metrics Row */}
      <div className="grid-4">
        <MetricCard
          title="Total Evaluated Accounts"
          value={formatNumber(dataset.accounts)}
          subtitle={`Window: ${dataset.observation_window}`}
          icon={Users}
          accent="emerald"
        />
        <MetricCard
          title="High Risk Liquidations"
          value={formatNumber(dataset.predicted_high_risk)}
          subtitle={`${pct(highRiskRatio)} of network accounts`}
          icon={ShieldAlert}
          accent="gold"
        />
        <MetricCard
          title="GraphSAGE Test Accuracy"
          value={pct(model.test_accuracy)}
          subtitle={`Macro F1: ${pct(model.macro_f1)}`}
          icon={Award}
          accent="emerald"
        />
        <MetricCard
          title="Federated Status"
          value={fed?.trained ? 'ACTIVE' : 'READY'}
          subtitle={fed?.trained ? `${fed.rounds} Rounds · ${fed.clients?.length || 3} Clients` : 'FedAvg aggregation ready'}
          icon={Lock}
          accent="gold"
        />
      </div>

      {/* Hero Interactive Network Element */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Network className="card-header-icon" size={18} />
            <span>Hero Network Topology Intelligence</span>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigateTab('network')}
          >
            <span>Explore Full Network</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <NetworkGraphCanvas
          height={440}
          onSelectAccount={onSelectAccount}
          onNavigateTab={onNavigateTab}
        />
      </div>

      {/* Analytics Split: Risk Distribution & Global Feature Importance */}
      <div className="grid-2">
        {/* Risk Distribution Breakdown */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <ShieldAlert className="card-header-icon" size={18} />
              <span>Liquidation Risk Distribution</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', height: 28, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-main)' }}>
              <div
                style={{
                  width: `${(100 * lowRiskCount) / dataset.accounts}%`,
                  backgroundColor: 'var(--risk-low)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#080A0C',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                LOW RISK ({pct(lowRiskCount / dataset.accounts)})
              </div>
              <div
                style={{
                  width: `${(100 * dataset.actual_high_risk) / dataset.accounts}%`,
                  backgroundColor: 'var(--risk-high)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                HIGH ({pct(highRiskRatio)})
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Solvent Accounts (Low Risk)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--risk-low)' }}>{formatNumber(lowRiskCount)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>No future liquidations</div>
              </div>

              <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>At-Risk Accounts (High Risk)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--risk-high)' }}>{formatNumber(dataset.actual_high_risk)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>≥1 future liquidation event</div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Permutation Importance Bars */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <BrainCircuit className="card-header-icon" size={18} />
              <span>Global Feature Attributions</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('explainability')}>
              Details <ChevronRight size={14} />
            </button>
          </div>

          <div className="bar-chart-stack">
            {topFeatures.slice(0, 5).map((f) => {
              const maxImp = Math.max(...topFeatures.map((item) => item.importance), 0.01)
              const widthPct = (100 * Math.max(f.importance, 0)) / maxImp
              return (
                <div className="bar-row-grid" key={f.feature}>
                  <span className="bar-row-label">{f.feature}</span>
                  <div className="bar-track-bg">
                    <div className="bar-fill-emerald" style={{ width: `${widthPct}%` }} />
                  </div>
                  <span className="bar-row-val">{f.importance.toFixed(4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
