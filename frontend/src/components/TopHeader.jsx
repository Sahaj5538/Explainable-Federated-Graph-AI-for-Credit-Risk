import React, { useEffect, useState } from 'react'
import { Activity, Cpu, RefreshCw } from 'lucide-react'
import { api } from '../api.js'

export default function TopHeader({ activeTab }) {
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
    dashboard: 'The Credit Graph',
    'credit-risk': 'Credit Risk Analysis',
    explainability: 'Deep Explanation',
    'model-performance': 'Model Performance',
    federation: 'Federated Learning',
    status: 'System Status',
  }

  return (
    <header className="top-header">
      <div className="page-title-badge">
        <h2>{titles[activeTab] || 'VERTEX'}</h2>
      </div>

      <div className="header-meta-chips">
        <div className="meta-chip">
          <Cpu size={14} />
          <span>Model: <strong>GraphSAGE</strong></span>
        </div>

        <div className="meta-chip">
          <Activity size={14} />
          <span>API:{' '}
            <strong style={{ color: health?.status === 'ok' ? 'var(--text-silver)' : 'var(--risk-high)' }}>
              {health ? health.status.toUpperCase() : 'CHECKING...'}
            </strong>
          </span>
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
