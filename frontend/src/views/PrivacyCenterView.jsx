import React from 'react'
import { Lock, ShieldCheck, EyeOff, Server, FileCheck, Check } from 'lucide-react'

export default function PrivacyCenterView() {
  const securityGuarantees = [
    { title: 'Zero Raw Data Leakage', desc: 'Financial transaction logs, deposit volumes, and wallet interactions are strictly retained within client institution storage.' },
    { title: 'Gradient Masking & Noise Integration', desc: 'Local parameter updates undergo clipping and differential privacy noise injection prior to transit.' },
    { title: 'Secure Aggregation Protocol', desc: 'Central coordinator aggregates model weights via multiparty cryptography without inspecting individual client parameter vectors.' },
    { title: 'No Outcome Window Leakage', desc: 'Node features are computed strictly from observation window transactions (2025-01-01 to 2025-04-30).' },
  ]

  return (
    <div className="section-stack">
      {/* Top Banner */}
      <div className="titanium-card" style={{ border: '1px solid rgba(111, 168, 220, 0.4)', background: 'linear-gradient(135deg, rgba(111, 168, 220, 0.08), rgba(23, 28, 33, 0.95))' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--privacy-bg)', border: '1px solid var(--privacy-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--privacy-cyan)' }}>
            <Lock size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              Privacy & Security Architecture
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              VERTEX ensures privacy preservation by decoupling raw financial transaction ledgers from global credit risk modeling. Institutional datasets remain sovereign and air-gapped.
            </p>
          </div>
        </div>
      </div>

      {/* Visual Workflow Concept */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <EyeOff className="card-header-icon" size={18} style={{ color: 'var(--privacy-cyan)' }} />
            <span>End-to-End Privacy Preservation Flow</span>
          </div>
        </div>

        <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--privacy-cyan)', marginBottom: 4 }}>1. PRIVATE DATA</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Local transactions & features remain on-premise.</p>
          </div>

          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--privacy-cyan)', marginBottom: 4 }}>2. LOCAL GNN</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Model trains locally on client hardware.</p>
          </div>

          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--privacy-cyan)', marginBottom: 4 }}>3. WEIGHT ENCRYPTION</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Gradients encrypted & differentially masked.</p>
          </div>

          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--privacy-cyan)', marginBottom: 4 }}>4. SECURE FEDAVG</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Central server aggregates without decryption.</p>
          </div>

          <div style={{ padding: 18, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: 4 }}>5. GLOBAL MODEL</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Updated global weights broadcasted back.</p>
          </div>
        </div>
      </div>

      {/* Security Guarantees Grid */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <ShieldCheck className="card-header-icon" size={18} style={{ color: 'var(--privacy-cyan)' }} />
            <span>Cryptographic & System Privacy Guarantees</span>
          </div>
        </div>

        <div className="grid-2">
          {securityGuarantees.map((item) => (
            <div key={item.title} style={{ display: 'flex', gap: 12, padding: 16, backgroundColor: 'var(--obsidian-deep)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(111, 168, 220, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--privacy-cyan)', minWidth: 24 }}>
                <Check size={14} />
              </div>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</h4>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
