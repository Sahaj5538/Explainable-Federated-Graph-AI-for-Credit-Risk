import React, { useState } from 'react'
import { ArrowDownRight, AlertTriangle, Info, CheckCircle } from 'lucide-react'

export default function BorrowView() {
  const [asset, setAsset] = useState('USDC')
  const [amount, setAmount] = useState('5000')
  const [submitted, setSubmitted] = useState(false)

  const handleBorrowSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="section-stack" style={{ maxWdith: 760, margin: '0 auto' }}>
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ArrowDownRight className="card-header-icon" size={18} style={{ color: 'var(--accent-gold)' }} />
            <span>Borrow Credit Against Collateral</span>
          </div>
          <span className="risk-badge medium">Simulation Environment</span>
        </div>

        <form onSubmit={handleBorrowSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Select Borrow Asset</label>
            <select className="select-field" style={{ width: '100%' }} value={asset} onChange={(e) => setAsset(e.target.value)}>
              <option value="USDC">USDC — USD Coin (Borrow APY: 6.72%)</option>
              <option value="ETH">ETH — Ethereum (Borrow APY: 4.88%)</option>
              <option value="WBTC">WBTC — Wrapped Bitcoin (Borrow APY: 3.42%)</option>
              <option value="DAI">DAI — Dai Stablecoin (Borrow APY: 7.10%)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Borrow Amount</span>
              <span>Available Borrowing Power: <strong className="mono">$7,830</strong></span>
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

          {/* Dynamic Risk Transition Indicator */}
          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-bright)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
              Dynamic Risk Impact Assessment
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: 12, backgroundColor: 'var(--titanium-card)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Health Factor Impact</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--risk-medium)', marginTop: 2 }}>
                  2.64 → <span style={{ color: 'var(--risk-medium)' }}>1.91</span>
                </div>
              </div>

              <div style={{ padding: 12, backgroundColor: 'var(--titanium-card)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Vertex Risk Assessment</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--risk-medium)', marginTop: 2 }}>
                  LOW → <span style={{ color: 'var(--risk-medium)' }}>MEDIUM</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Prob: 4.8% → 12.7%
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              Borrow APY: <strong className="mono" style={{ color: 'var(--accent-gold)' }}>6.72% variable</strong>
            </div>
          </div>

          <button className="btn btn-primary" type="submit" style={{ padding: 14, fontSize: 15, background: 'linear-gradient(135deg, #a67c33, #d6a84f)', borderColor: 'var(--accent-gold)' }}>
            <ArrowDownRight size={18} /> BORROW {amount} {asset}
          </button>
        </form>

        {submitted && (
          <div style={{ marginTop: 20, padding: 16, backgroundColor: 'rgba(217, 164, 65, 0.1)', border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <CheckCircle size={20} style={{ color: 'var(--accent-gold)' }} />
            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              <strong>Simulated Loan Execution Successful:</strong> Borrowed ${amount} {asset}. Health factor updated to 1.91.
            </div>
          </div>
        )}
      </div>

      {/* Traditional vs VERTEX Credit Paradigm Explanation */}
      <div className="titanium-card">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Info size={22} className="text-emerald" style={{ minWidth: 22 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Traditional DeFi vs VERTEX Credit Intelligence:</strong>
            <br />
            Traditional protocols evaluate borrowing limits strictly based on over-collateralization ratios. <strong>VERTEX</strong> augments collateral limits with Graph Neural Networks evaluating borrower counterparty networks, historical liquidation patterns, and transaction reliability to detect liquidation risks before collateral thresholds breach.
          </div>
        </div>
      </div>
    </div>
  )
}
