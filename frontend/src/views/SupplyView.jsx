import React, { useState } from 'react'
import { ArrowUpRight, CheckCircle, Info } from 'lucide-react'

export default function SupplyView() {
  const [asset, setAsset] = useState('USDC')
  const [amount, setAmount] = useState('2500')
  const [submitted, setSubmitted] = useState(false)

  const numAmount = parseFloat(amount) || 0
  const yearlyYield = (numAmount * 0.0421).toFixed(2)

  const handleSupplySubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="section-stack" style={{ maxWdith: 760, margin: '0 auto' }}>
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ArrowUpRight className="card-header-icon" size={18} />
            <span>Supply Liquidity to VERTEX Pools</span>
          </div>
          <span className="risk-badge low">Simulation Environment</span>
        </div>

        <form onSubmit={handleSupplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Select Asset</label>
            <select className="select-field" style={{ width: '100%' }} value={asset} onChange={(e) => setAsset(e.target.value)}>
              <option value="USDC">USDC — USD Coin (APY: 4.21%)</option>
              <option value="ETH">ETH — Ethereum (APY: 3.15%)</option>
              <option value="WBTC">WBTC — Wrapped Bitcoin (APY: 1.85%)</option>
              <option value="DAI">DAI — Dai Stablecoin (APY: 4.45%)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Supply Amount</span>
              <span>Wallet Balance: <strong className="mono">5,840 {asset}</strong></span>
            </div>
            <input
              type="number"
              className="input-field"
              style={{ width: '100%', fontSize: 16 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div style={{ padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Supply APY:</span>
              <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>4.21%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Collateral Usage:</span>
              <strong style={{ color: 'var(--accent-emerald)' }}>Enabled (75% LTV)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Est. Yearly Yield:</span>
              <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>+${yearlyYield} {asset} / yr</strong>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" style={{ padding: 14, fontSize: 15 }}>
            <ArrowUpRight size={18} /> SUPPLY {asset}
          </button>
        </form>

        {submitted && (
          <div style={{ marginTop: 20, padding: 16, backgroundColor: 'rgba(32, 201, 151, 0.1)', border: '1px solid var(--accent-emerald)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <CheckCircle size={20} style={{ color: 'var(--accent-emerald)' }} />
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>Simulated Supply Execution Successful:</strong> Supplied {amount} {asset} to VERTEX liquidity pool. Health Factor updated to 2.64.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
