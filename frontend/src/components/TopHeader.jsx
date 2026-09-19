import React, { useEffect, useState } from 'react'
import { Activity, Shield, Cpu, RefreshCw, CheckCircle, Wallet } from 'lucide-react'
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
    dashboard: 'Dashboard Overview',
    markets: 'DeFi Liquidity Markets',
    portfolio: 'Portfolio & Position Management',
    supply: 'Supply Liquidity',
    borrow: 'Borrow Credit & Collateral',
    'credit-risk': 'Vertex Credit Risk Engine',
    explainability: 'XAI Attribution Suite',
    network: 'Interactive Network Analysis',
    'model-performance': 'Model Performance & Benchmark',
    training: 'Model Training Dynamics',
    federation: 'Federated DeFi Risk Network',
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
        <div className="meta-chip highlight" style={{ backgroundColor: 'rgba(32, 201, 151, 0.08)', borderColor: 'rgba(32, 201, 151, 0.3)' }}>
          <Wallet size={14} className="text-emerald" />
          <span>Wallet: <strong className="mono">0x7A...8921</strong> <CheckCircle size={12} style={{ color: 'var(--accent-emerald)', display: 'inline', marginLeft: 4 }} /></span>
        </div>

        <div className="meta-chip">
          <Cpu size={14} />
          <span>Model: <strong>GraphSAGE</strong></span>
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
