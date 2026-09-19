import React from 'react'
import { Workflow, Layers, ArrowRight, ShieldCheck, Database, Cpu, BrainCircuit, Lock } from 'lucide-react'

export default function SystemArchitectureView() {
  const pipelineStages = [
    { title: '1. Data Layer', icon: Database, desc: 'Raw blockchain transactions, account features (11 metrics), protocol registry & ground-truth liquidation labels.' },
    { title: '2. Preprocessing', icon: Layers, desc: 'Train-only z-score normalization and temporal observation window filtering (2025-01-01 to 2025-04-30).' },
    { title: '3. Graph Construction', icon: Workflow, desc: 'Heterogeneous graph construction: Account nodes, Protocol nodes, Account-Account and Account-Protocol edges.' },
    { title: '4. GNN Architecture', icon: Cpu, desc: 'Heterogeneous GraphSAGE / GAT model with 32 hidden channels, 4 attention heads, Adam optimizer.' },
    { title: '5. Risk Prediction', icon: ShieldCheck, desc: 'Binary liquidation risk scoring (`future_liquidation_count >= 1` in held-out outcome window 2025-05 to 2025-07).' },
    { title: '6. Explainability', icon: BrainCircuit, desc: 'Dual-level attributions: Kernel SHAP (feature-level) and GNNExplainer gradient attributions (graph-level).' },
    { title: '7. Federated Learning', icon: Workflow, desc: 'Decentralized FedAvg aggregation across 3 institutional client partitions without raw data pooling.' },
    { title: '8. Privacy Guarantee', icon: Lock, desc: 'On-premise dataset isolation, encrypted model weight updates, zero future outcome leakage.' },
  ]

  return (
    <div className="section-stack">
      {/* Overview Banner */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Workflow className="card-header-icon" size={18} />
            <span>VERTEX End-to-End System Architecture Pipeline</span>
          </div>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          An integrated, privacy-preserving research pipeline designed for DeFi credit risk assessment. Connects temporal transaction graph construction to Graph Neural Network scoring, local SHAP attributions, and federated learning aggregation.
        </p>
      </div>

      {/* Interactive 8-Stage Architecture Flow */}
      <div className="titanium-card">
        <div className="grid-2">
          {pipelineStages.map((stage) => {
            const Icon = stage.icon
            return (
              <div
                key={stage.title}
                style={{
                  padding: 20,
                  backgroundColor: 'var(--obsidian-deep)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-main)',
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--titanium-light)', border: '1px solid var(--border-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)', minWidth: 40 }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{stage.title}</h4>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{stage.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
