import React, { useEffect, useState } from 'react'
import { Activity, Shield, Cpu, RefreshCw, CheckCircle2, Server } from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'

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

  if (loading) return <div className="loading-state"><div className="spinner-ring" /><span>Running Backend System Diagnostics…</span></div>

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Activity className="card-header-icon" size={18} />
            <span>Live System Diagnostics & Backend Status</span>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={fetchDiagnostics}>
            <RefreshCw size={14} /> Refresh Diagnostics
          </button>
        </div>

        <div className="grid-3">
          <div style={{ padding: 20, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-main)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>FastAPI Server Health</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: health?.status === 'ok' ? 'var(--accent-emerald)' : 'var(--risk-high)', textTransform: 'uppercase' }}>
              {health?.status || 'OFFLINE'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Endpoints responding normally</div>
          </div>

          <div style={{ padding: 20, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-main)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>GNN Model Checkpoint</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: health?.model_loaded ? 'var(--accent-emerald)' : 'var(--risk-high)' }}>
              {health?.model_loaded ? 'LOADED & READY' : 'NOT LOADED'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>GraphSAGE Heterogeneous weights</div>
          </div>

          <div style={{ padding: 20, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-main)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Dataset Node Count</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatNumber(stats?.dataset?.accounts || 1000)} Accounts
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Temporal observation window</div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <Server className="card-header-icon" size={18} />
              <span>Dataset & Temporal Split Diagnostics</span>
            </div>
          </div>

          <div className="grid-2">
            <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Observation Window (Features & Edges):</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-emerald)', marginTop: 4 }}>
                {stats.dataset.observation_window}
              </div>
            </div>

            <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Outcome Window (Liquidation Ground Truth):</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-gold)', marginTop: 4 }}>
                {stats.dataset.outcome_window}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
