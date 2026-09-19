import React, { useState } from 'react'
import { Network, Filter, Search, Info } from 'lucide-react'
import NetworkGraphCanvas from '../components/NetworkGraphCanvas.jsx'

export default function NetworkExplorerView({ onSelectAccount, onNavigateTab }) {
  const [riskFilter, setRiskFilter] = useState('all')

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Network className="card-header-icon" size={18} />
            <span>Interactive Graph Intelligence Matrix</span>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} className="text-secondary" />
              <select
                className="select-field"
                style={{ padding: '6px 12px', fontSize: 13 }}
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
              >
                <option value="all">All Graph Nodes (120)</option>
                <option value="high">Predicted HIGH Risk</option>
                <option value="low">Predicted LOW Risk</option>
                <option value="protocol">DeFi Protocols Only</option>
              </select>
            </div>
          </div>
        </div>

        <NetworkGraphCanvas
          height={680}
          riskFilter={riskFilter}
          onSelectAccount={onSelectAccount}
          onNavigateTab={onNavigateTab}
        />
      </div>

      <div className="grid-3">
        <div className="titanium-card">
          <div className="card-header-title" style={{ marginBottom: 12 }}>
            <Info size={16} className="text-emerald" />
            <span>Heterogeneous Topology</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            The graph models two primary node entities: <strong>Wallets</strong> (Accounts) and <strong>DeFi Protocols</strong> (Aave, Compound, Uniswap, Maker). Edges represent temporal transactions in the observation window.
          </p>
        </div>

        <div className="titanium-card">
          <div className="card-header-title" style={{ marginBottom: 12 }}>
            <Info size={16} className="text-emerald" />
            <span>GraphSAGE Message Passing</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Graph Neural Networks aggregate feature representations from neighboring wallets and protocol interactions, allowing credit risk predictions to capture systemic counterparty contagion.
          </p>
        </div>

        <div className="titanium-card">
          <div className="card-header-title" style={{ marginBottom: 12 }}>
            <Info size={16} className="text-emerald" />
            <span>Zero Temporal Leakage</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Edges and node features strictly originate from the observation window (2025-01-01 to 2025-04-30), guaranteeing unbiased evaluation against future liquidation outcomes.
          </p>
        </div>
      </div>
    </div>
  )
}
