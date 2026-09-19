import React, { useEffect, useState } from 'react'
import { Activity, Shield, Cpu, RefreshCw } from 'lucide-react'
import { api } from '../api.js'

export default function TopHeader({ activeTab, onSearch }) {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkHealth = () => {
    setLoading(true)
    api.health()
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline', model_loaded: false }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const titles = {
    dashboard: 'Dashboard Overview',
    network: 'Interactive Network Explorer',
    wallets: 'Wallet Intelligence',
    risk: 'Risk Assessment Laboratory',
    explainability: 'XAI Attribution Suite',
    models: 'Model Lab & Comparison',
    training: 'Model Training Dynamics',
    federation: 'Federated Learning Network',
    privacy: 'Privacy & Security Center',
    architecture: 'System Architecture & Pipeline',
    status: 'System Diagnostics & Health',
  }

  return (
    <header className="top-header">
      <div className="page-title-badge">
        <h2>{titles[activeTab] || 'VERTEX Intelligence'}</h2>
      </div>

      <div className="header-meta-chips">
        <div className="meta-chip highlight">
          <Cpu size={14} />
          <span>Model: <strong>GraphSAGE</strong> (Heterogeneous)</span>
        </div>

        <div className="meta-chip">
          <Shield size={14} />
          <span>Observation: <strong>2025-01 to 2025-04</strong></span>
        </div>

        <div className="meta-chip">
          <Activity size={14} />
          <span>API: <strong style={{ color: health?.status === 'ok' ? 'var(--accent-emerald)' : 'var(--risk-high)' }}>
            {health ? health.status.toUpperCase() : 'CHECKING...'}
          </strong></span>
        </div>

        <button 
          className="btn btn-ghost btn-sm" 
          onClick={checkHealth} 
          title="Refresh system health" 
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>
    </header>
  )
}
