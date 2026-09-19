import React from 'react'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react'

export default function MarketsView({ onNavigateTab }) {
  const assets = [
    { symbol: 'USDC', name: 'USD Coin', supplyApy: '4.21%', borrowApy: '6.72%', liquidity: '$48.5M', supplied: '$2,500' },
    { symbol: 'ETH', name: 'Ethereum', supplyApy: '3.15%', borrowApy: '4.88%', liquidity: '$124.2M', supplied: '$4,820' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', supplyApy: '1.85%', borrowApy: '3.42%', liquidity: '$88.9M', supplied: '$8,200' },
    { symbol: 'DAI', name: 'Dai Stablecoin', supplyApy: '4.45%', borrowApy: '7.10%', liquidity: '$32.1M', supplied: '$0' },
  ]

  return (
    <div className="section-stack">
      {/* Simulation Disclaimer Banner */}
      <div className="titanium-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Info size={20} className="text-emerald" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              DeFi Liquidity Markets — Simulation Environment
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Demonstrating Aave-inspired credit market parameters. Yields and liquidity pools simulate real-time credit risk pricing powered by VERTEX Graph AI.
            </div>
          </div>
        </div>
      </div>

      {/* Asset Markets Table */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <TrendingUp className="card-header-icon" size={18} />
            <span>Available Asset Markets</span>
          </div>
        </div>

        <div className="table-container">
          <table className="vertex-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Supply APY</th>
                <th>Borrow APY</th>
                <th>Total Liquidity</th>
                <th>Your Position</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.symbol}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--titanium-light)', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                        {asset.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{asset.symbol}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{asset.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{asset.supplyApy}</td>
                  <td className="mono" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{asset.borrowApy}</td>
                  <td className="mono">{asset.liquidity}</td>
                  <td className="mono">{asset.supplied}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('supply')}>
                        <ArrowUpRight size={13} /> Supply
                      </button>
                      <button className="btn btn-sm" onClick={() => onNavigateTab('borrow')}>
                        <ArrowDownRight size={13} /> Borrow
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
