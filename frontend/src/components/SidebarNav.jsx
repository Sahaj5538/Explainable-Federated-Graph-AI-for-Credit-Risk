import React from 'react'
import {
  LayoutDashboard,
  Network,
  Wallet,
  ShieldAlert,
  BrainCircuit,
  BarChart3,
  Flame,
  Users,
  Lock,
  Workflow,
  Activity,
  Layers
} from 'lucide-react'

export default function SidebarNav({ activeTab, setActiveTab }) {
  const sections = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'Intelligence',
      items: [
        { id: 'network', label: 'Network Explorer', icon: Network },
        { id: 'wallets', label: 'Wallet Intelligence', icon: Wallet },
        { id: 'risk', label: 'Risk Assessment', icon: ShieldAlert }
      ]
    },
    {
      title: 'Explainability',
      items: [
        { id: 'explainability', label: 'XAI Explanations', icon: BrainCircuit }
      ]
    },
    {
      title: 'Models',
      items: [
        { id: 'models', label: 'Model Comparison', icon: BarChart3 },
        { id: 'training', label: 'Training Dynamics', icon: Flame }
      ]
    },
    {
      title: 'Federation',
      items: [
        { id: 'federation', label: 'Federated Learning', icon: Users },
        { id: 'privacy', label: 'Privacy Center', icon: Lock }
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'architecture', label: 'Architecture', icon: Workflow },
        { id: 'status', label: 'System Status', icon: Activity }
      ]
    }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo-mark">
          <Layers size={22} />
        </div>
        <div className="brand-title-group">
          <h1>VERTEX</h1>
          <p>GRAPH CREDIT INTELLIGENCE</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map((sec) => (
          <div key={sec.title} className="nav-group">
            <div className="nav-section-title">{sec.title}</div>
            {sec.items.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status-indicator">
          <span className="status-dot-pulse" />
          <span>Graph Engine Active</span>
        </div>
      </div>
    </aside>
  )
}
