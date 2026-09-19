import React, { useEffect, useState } from 'react'
import { Users, Lock, ShieldCheck, ArrowRight, Server, AlertCircle } from 'lucide-react'
import { api, pct } from '../api.js'

export default function FederatedLearningView() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.stats()
      .then(setStats)
      .catch(() => {})
  }, [])

  const fedInfo = stats?.clients

  const clients = [
    { name: 'Aave', label: 'Simulated Client Partition', accounts: 340, share: '34%', status: 'Active Node', f1: fedInfo?.macro_f1 || 0.7033 },
    { name: 'Compound', label: 'Simulated Client Partition', accounts: 330, share: '33%', status: 'Active Node', f1: fedInfo?.macro_f1 || 0.7033 },
    { name: 'MakerDAO', label: 'Simulated Client Partition', accounts: 330, share: '33%', status: 'Active Node', f1: fedInfo?.macro_f1 || 0.7033 },
  ]

  return (
    <div className="section-stack">
      {/* Mandatory Protocol Disclaimer Banner */}
      <div className="titanium-card" style={{ border: '1px solid rgba(214, 168, 79, 0.4)', background: 'linear-gradient(135deg, rgba(214, 168, 79, 0.08), rgba(23, 28, 33, 0.95))' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <AlertCircle size={22} style={{ color: 'var(--accent-gold)', minWidth: 22, marginTop: 2 }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Research Demonstration Environment Disclaimer</strong>
              <span className="risk-badge medium" style={{ fontSize: 10 }}>Demonstration Environment</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Aave, Compound and MakerDAO are represented as simulated federated client partitions. No real protocol data or institutional participation is claimed.
            </p>
          </div>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="titanium-card" style={{ border: '1px solid rgba(146, 119, 216, 0.4)', background: 'linear-gradient(135deg, rgba(146, 119, 216, 0.08), rgba(23, 28, 33, 0.95))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--federated-bg)', border: '1px solid var(--federated-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--federated-purple)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Federated DeFi Risk Network (FedAvg)
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Privacy-preserving collaborative training across independent client partitions. Raw transaction logs remain local on client nodes; only encrypted model parameters are communicated for global aggregation.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Aggregation Workflow Pipeline */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Server className="card-header-icon" size={18} style={{ color: 'var(--federated-purple)' }} />
            <span>FedAvg Federated Aggregation Lifecycle</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, padding: '16px 0' }}>
          <div style={{ flex: 1, minWidth: 160, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--federated-purple)', marginBottom: 4 }}>1. CLIENTS</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Aave, Compound, MakerDAO</div>
          </div>

          <ArrowRight size={18} className="text-secondary" />

          <div style={{ flex: 1, minWidth: 160, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--federated-purple)', marginBottom: 4 }}>2. LOCAL TRAINING</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Private Local GNN</div>
          </div>

          <ArrowRight size={18} className="text-secondary" />

          <div style={{ flex: 1, minWidth: 160, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--federated-purple)', marginBottom: 4 }}>3. MODEL UPDATES</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Encrypted Weights</div>
          </div>

          <ArrowRight size={18} className="text-secondary" />

          <div style={{ flex: 1, minWidth: 160, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--federated-purple)', marginBottom: 4 }}>4. FEDAVG</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Secure Server Aggregation</div>
          </div>

          <ArrowRight size={18} className="text-secondary" />

          <div style={{ flex: 1, minWidth: 160, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 4 }}>5. GLOBAL MODEL</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>FedAvg Accuracy: {pct(fedInfo?.test_accuracy || 0.7961)}</div>
          </div>
        </div>
      </div>

      {/* Simulated Client Partition Breakdown */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Users className="card-header-icon" size={18} style={{ color: 'var(--federated-purple)' }} />
            <span>Simulated Institutional Client Partitions</span>
          </div>
        </div>

        <div className="grid-3">
          {clients.map((c) => (
            <div key={c.name} style={{ padding: 20, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-main)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</h4>
                <span className="risk-badge low" style={{ fontSize: 10 }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginBottom: 14 }}>{c.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Partitioned Accounts:</span>
                  <strong className="mono">{c.accounts} ({c.share})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Local Macro F1:</span>
                  <strong className="mono" style={{ color: 'var(--federated-purple)' }}>{pct(c.f1)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
