import React, { useEffect, useState } from 'react'
import { Activity, RefreshCw, Server } from 'lucide-react'
import { api, formatNumber } from '../api.js'

export default function SystemStatusView() {
  const [health, setHealth] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchDiagnostics = () => {
    setLoading(true)
    Promise.all([api.health(), api.stats()])
      .then(([h, s]) => {
        setHealth(h)
        setStats(s)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDiagnostics()
  }, [])

  if (loading && !stats)
    return <div className="loading-state"><div className="spinner-ring" /><span>Running backend diagnostics…</span></div>

  const okColor = 'var(--text-silver)'

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Activity className="card-header-icon" size={18} />
            <span>Live Backend Status</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchDiagnostics}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className="grid-3">
          <div className="status-tile">
            <div className="status-tile-label">API server</div>
            <div className="status-tile-value mono" style={{ color: health?.status === 'ok' ? okColor : 'var(--risk-high)' }}>
              {(health?.status || 'OFFLINE').toUpperCase()}
            </div>
            <div className="muted small">all endpoints responding</div>
          </div>

          <div className="status-tile">
            <div className="status-tile-label">Model checkpoint</div>
            <div className="status-tile-value mono" style={{ color: health?.model_loaded ? okColor : 'var(--risk-high)' }}>
              {health?.model_loaded ? 'LOADED' : 'MISSING'}
            </div>
            <div className="muted small">binary GraphSAGE weights</div>
          </div>

          <div className="status-tile">
            <div className="status-tile-label">Dataset</div>
            <div className="status-tile-value mono">
              {formatNumber(stats?.dataset?.accounts || 0)} accounts
            </div>
            <div className="muted small">temporal observation window</div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <Server className="card-header-icon" size={18} />
              <span>Temporal Split (leakage-free by construction)</span>
            </div>
          </div>

          <div className="grid-2">
            <div className="status-tile">
              <div className="status-tile-label">Observation window (features + edges)</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                {stats.dataset.observation_window}
              </div>
            </div>
            <div className="status-tile">
              <div className="status-tile-label">Outcome window (ground-truth labels)</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                {stats.dataset.outcome_window}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
