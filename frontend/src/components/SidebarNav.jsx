import React from 'react'
import {
  LayoutDashboard,
  ShieldAlert,
  BrainCircuit,
  BarChart3,
  Users,
  Activity,
  Layers,
} from 'lucide-react'

export default function SidebarNav({ activeTab, setActiveTab }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'credit-risk', label: 'Credit Risk', icon: ShieldAlert },
    { id: 'explainability', label: 'XAI Explanation', icon: BrainCircuit },
    { id: 'model-performance', label: 'Model Performance', icon: BarChart3 },
    { id: 'federation', label: 'Federated Learning', icon: Users },
    { id: 'status', label: 'System Status', icon: Activity },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo-mark">
          <Layers size={22} />
        </div>
        <div className="brand-title-group">
          <h1>VERTEX</h1>
          <p>Graph Credit Intelligence</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-group">
          {items.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                className={active ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={17} className="nav-item-icon" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="mono">GraphSAGE · FedAvg · SHAP</div>
        <div className="muted small">observation-window features only</div>
      </div>
    </aside>
  )
}
