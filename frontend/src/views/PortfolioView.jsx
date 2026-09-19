import React from 'react'
import { PieChart, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react'

export default function PortfolioView({ onNavigateTab }) {
  const supplied = [
    { symbol: 'USDC', balance: '2,500 USDC', value: '$2,500', apy: '4.21%', collateral: 'Enabled' },
    { symbol: 'ETH', balance: '1.45 ETH', value: '$4,820', apy: '3.15%', collateral: 'Enabled' },
    { symbol: 'WBTC', balance: '0.088 WBTC', value: '$8,200', apy: '1.85%', collateral: 'Enabled' },
  ]

  const borrowed = [
    { symbol: 'USDC', balance: '9,420 USDC', value: '$9,420', apy: '6.72%' },
  ]

  return (
    <div className="section-stack">
      {/* Portfolio Overview Banner */}
      <div className="titanium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
              Active User Portfolio Overview
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 700 }}>Total Net Value: $15,430</h3>
          </div>
          <span className="risk-badge low">Simulated Position</span>
        </div>
      </div>

      {/* Position Tables */}
      <div className="grid-2">
        {/* Supplied Assets */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <ArrowUpRight className="card-header-icon" size={18} />
              <span>Your Supplied Collateral ($15,520)</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('supply')}>+ Supply</button>
          </div>

          <div className="table-container">
            <table className="vertex-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Value</th>
                  <th>APY</th>
                  <th>Collateral</th>
                </tr>
              </thead>
              <tbody>
                {supplied.map((item) => (
                  <tr key={item.symbol}>
                    <td style={{ fontWeight: 600 }}>{item.symbol}</td>
                    <td className="mono">{item.value}</td>
                    <td className="mono" style={{ color: 'var(--accent-emerald)' }}>{item.apy}</td>
                    <td><span className="risk-badge low" style={{ fontSize: 10 }}>{item.collateral}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Borrowed Assets */}
        <div className="titanium-card">
          <div className="card-header">
            <div className="card-header-title">
              <ArrowDownRight className="card-header-icon" size={18} style={{ color: 'var(--accent-gold)' }} />
              <span>Your Active Loans ($9,420)</span>
            </div>
            <button className="btn btn-sm" onClick={() => onNavigateTab('borrow')}>+ Borrow</button>
          </div>

          <div className="table-container">
            <table className="vertex-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Value</th>
                  <th>Borrow APY</th>
                </tr>
              </thead>
              <tbody>
                {borrowed.map((item) => (
                  <tr key={item.symbol}>
                    <td style={{ fontWeight: 600 }}>{item.symbol}</td>
                    <td className="mono">{item.value}</td>
                    <td className="mono" style={{ color: 'var(--accent-gold)' }}>{item.apy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
