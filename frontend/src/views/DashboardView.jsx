import React, { useEffect, useState } from 'react'
import { ArrowRight, BrainCircuit, ShieldAlert } from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'

// ---------------------------------------------------------------------------
// DASHBOARD - the graph IS the dashboard.
//
// The interactive 3D graph lives in GraphStage behind this view (hero mode).
// Here we only render minimal, translucent overlays so the graph stays the
// dominant element: a few stat chips, graph filters and a hint line.
// ---------------------------------------------------------------------------

export default function DashboardView({ onNavigateTab, onSelectAccount, graphFilter, setGraphFilter }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
  }, [])

  const edges =
    stats && stats.dataset
      ? null // filled from network stats when available
      : null

  return (
    <div className="dashboard-overlay">
      {/* top-left: identity + minimal stats */}
      <div className="dash-top-left">
        <div className="dash-caption">Graph Credit Intelligence</div>
        <div className="dash-headline">
          Every circle is a wallet. Every diamond is a protocol.
        </div>

        <div className="dash-stats">
          <div className="dash-chip">
            <span className="dash-chip-value mono">
              {stats ? formatNumber(stats.dataset.accounts) : '—'}
            </span>
            <span className="dash-chip-label">accounts</span>
          </div>
          <div className="dash-chip">
            <span className="dash-chip-value mono">
              {stats ? formatNumber(stats.dataset.actual_high_risk) : '—'}
            </span>
            <span className="dash-chip-label">high-risk wallets</span>
          </div>
          <div className="dash-chip">
            <span className="dash-chip-value mono">
              {stats && stats.model ? pct(stats.model.test_accuracy) : '—'}
            </span>
            <span className="dash-chip-label">model accuracy</span>
          </div>
          <div className="dash-chip">
            <span className="dash-chip-value mono">
              {stats && stats.clients ? stats.clients.clients.length : '—'}
            </span>
            <span className="dash-chip-label">federated clients</span>
          </div>
        </div>

        <div className="dash-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('credit-risk')}>
            <ShieldAlert size={14} /> Run Risk Assessment
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('explainability')}>
            <BrainCircuit size={14} /> Explain a Prediction
          </button>
        </div>
      </div>

      {/* top-right: graph filters */}
      <div className="dash-top-right">
        {[
          ['all', 'All nodes'],
          ['high', 'High risk'],
          ['low', 'Low risk'],
          ['protocols', 'Protocols'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={graphFilter === value ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setGraphFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* bottom-center: how to use the graph */}
      <div className="dash-bottom">
        <span className="muted">Drag to rotate · Scroll to zoom · Click an account node to inspect it</span>
        <span className="dash-legend">
          <span className="legend-dot low" /> low risk
          <span className="legend-dot high" /> high risk
          <span className="legend-diamond" /> protocol
        </span>
      </div>
    </div>
  )
}
