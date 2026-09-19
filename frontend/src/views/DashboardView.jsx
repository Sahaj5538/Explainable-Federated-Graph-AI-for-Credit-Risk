import React, { useEffect, useState } from 'react'
import {
  Users,
  ShieldAlert,
  Activity,
  Award,
  Layers,
  Network,
  ArrowRight,
  BrainCircuit,
  Lock,
  ChevronRight,
  TrendingUp,
  BarChart3,
  CheckCircle,
  HelpCircle
} from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'
import MetricCard from '../components/MetricCard.jsx'
import NetworkGraphCanvas from '../components/NetworkGraphCanvas.jsx'

export default function DashboardView({ onNavigateTab, onSelectAccount }) {
  const [modelPerf, setModelPerf] = useState(null)
  const [perfLoading, setPerfLoading] = useState(true)
  const [perfError, setPerfError] = useState(null)

  const fetchModelPerformance = () => {
    setPerfLoading(true)
    setPerfError(null)
    api.modelPerformance()
      .then(setModelPerf)
      .catch((err) => setPerfError(err.message))
      .finally(() => setPerfLoading(false))
  }

  useEffect(() => {
    fetchModelPerformance()
  }, [])

  return (
    <div className="section-stack">
      {/* Top Greeting & Wallet Context Banner */}
      <div className="titanium-card" style={{ background: 'linear-gradient(135deg, rgba(23, 28, 33, 0.9), rgba(13, 16, 19, 0.95))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--accent-emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              DeFi Credit Intelligence
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>Good evening</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Active Session: <span className="mono" style={{ color: 'var(--text-primary)' }}>0x7A4b...8921</span> · Connected <CheckCircle size={13} style={{ color: 'var(--accent-emerald)', display: 'inline', marginLeft: 2 }} />
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => onNavigateTab('borrow')}>
              <span>Borrow Asset</span>
              <ArrowRight size={14} />
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigateTab('credit-risk')}>
              <span>Test Account ID</span>
            </button>
          </div>
        </div>
      </div>

      {/* DeFi Portfolio Summary Row (Labeled Simulated Position) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
            DeFi Financial Position Summary
          </span>
          <span className="risk-badge low" style={{ fontSize: 10 }}>Demo Environment</span>
        </div>

        <div className="grid-4">
          <MetricCard
            title="Total Supplied"
            value="$24,850"
            subtitle="Collateral Position (USDC, ETH, WBTC)"
            icon={TrendingUp}
            accent="emerald"
          />
          <MetricCard
            title="Total Borrowed"
            value="$9,420"
            subtitle="Active Liquidity Loans"
            icon={ShieldAlert}
            accent="gold"
          />
          <MetricCard
            title="Available Borrowing"
            value="$7,830"
            subtitle="Credit Allowance"
            icon={Users}
            accent="emerald"
          />
          <MetricCard
            title="Health Factor"
            value="2.64"
            subtitle="Solvency Threshold > 1.0"
            icon={Award}
            accent="emerald"
          />
        </div>
      </div>

      {/* VERTEX CREDIT RISK SCORE CARD (Hero Feature) */}
      <div className="titanium-card" style={{ border: '1px solid rgba(32, 201, 151, 0.4)', background: 'linear-gradient(135deg, rgba(32, 201, 151, 0.05), rgba(23, 28, 33, 0.95))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-emerald)' }}>
                Vertex Graph AI Credit Engine
              </span>
              <span className="risk-badge low" style={{ fontSize: 10 }}>Simulated Position</span>
            </div>

            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              VERTEX CREDIT SCORE: <span style={{ color: 'var(--accent-emerald)' }}>842 / 1000</span>
            </h3>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 640 }}>
              Vertex evaluates wallet transaction behaviour, repayment patterns, failed transactions, borrowing behaviour, and graph relationships to estimate credit/liquidation risk.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Liquidation Probability</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--accent-emerald)' }}>4.8%</div>
              <div className="risk-badge low" style={{ fontSize: 10, marginTop: 4 }}>LOW RISK</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, padding: 14, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Repayment Reliability:</span>
                <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>94.2%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Transaction Reliability:</span>
                <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>91.7%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Graph Stability:</span>
                <strong className="mono" style={{ color: 'var(--accent-emerald)' }}>88.4%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LARGE INTERACTIVE NETWORK GRAPH (Centerpiece) */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Network className="card-header-icon" size={18} />
            <span>Account & Protocol Relationship Topology</span>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigateTab('network')}
          >
            <span>Explore Full Network</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <NetworkGraphCanvas
          height={480}
          onSelectAccount={onSelectAccount}
          onNavigateTab={onNavigateTab}
        />
      </div>

      {/* COMPACT MODEL PERFORMANCE CARD (Dynamic Backend Metrics) */}
      <div className="titanium-card" style={{ border: '1px solid var(--border-bright)' }}>
        <div className="card-header">
          <div className="card-header-title">
            <BarChart3 className="card-header-icon" size={18} />
            <span>MODEL PERFORMANCE — Traditional ML vs Graph Neural Networks</span>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigateTab('model-performance')}
          >
            <span>Full Infrastructure Benchmark</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {perfError && (
          <div className="error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Unable to retrieve model evaluation results: {perfError}</span>
            <button className="btn btn-sm" onClick={fetchModelPerformance}>Retry</button>
          </div>
        )}

        {perfLoading && (
          <div className="loading-state" style={{ padding: '24px 0' }}>
            <div className="spinner-ring" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading model benchmark metrics from backend...</span>
          </div>
        )}

        {modelPerf && !perfLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Evaluated Checkpoints ({modelPerf.models.length} Models) · Primary Metric: <strong>{modelPerf.primary_metric}</strong></span>
              <span>Top Performer: <strong style={{ color: 'var(--accent-emerald)' }}>{modelPerf.best_model}</strong></span>
            </div>

            <div className="bar-chart-stack">
              {modelPerf.models.map((m) => {
                const maxVal = Math.max(...modelPerf.models.map((x) => x.macro_f1), 0.01)
                const widthPct = (100 * m.macro_f1) / maxVal
                const isGNN = m.category === 'GNN'
                const isWinner = m.name === modelPerf.best_model

                return (
                  <div className="bar-row-grid" key={m.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="bar-row-label" style={{ fontWeight: isWinner ? 600 : 400, color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {m.name}
                      </span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, backgroundColor: isGNN ? 'rgba(32, 201, 151, 0.12)' : 'rgba(255, 255, 255, 0.06)', color: isGNN ? 'var(--accent-emerald)' : 'var(--text-tertiary)' }}>
                        {m.category}
                      </span>
                    </div>

                    <div className="bar-track-bg">
                      <div
                        className={isGNN ? 'bar-fill-emerald' : 'bar-fill-gold'}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    <span className="bar-row-val" style={{ fontWeight: 600 }}>{pct(m.macro_f1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
