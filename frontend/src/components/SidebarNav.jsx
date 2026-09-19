import React from 'react'
import {
  LayoutDashboard,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  BrainCircuit,
  Network,
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
      title: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'markets', label: 'Markets', icon: TrendingUp }
      ]
    },
    {
      title: 'YOUR FINANCE',
      items: [
        { id: 'portfolio', label: 'Portfolio', icon: PieChart },
        { id: 'supply', label: 'Supply', icon: ArrowUpRight },
        { id: 'borrow', label: 'Borrow', icon: ArrowDownRight }
      ]
    },
    {
      title: 'RISK INTELLIGENCE',
      items: [
        { id: 'credit-risk', label: 'Credit Risk', icon: ShieldAlert },
        { id: 'explainability', label: 'XAI Explanation', icon: BrainCircuit },
        { id: 'network', label: 'Network Analysis', icon: Network }
      ]
    },
    {
      title: 'AI INFRASTRUCTURE',
      items: [
        { id: 'model-performance', label: 'Model Performance', icon: BarChart3 },
        { id: 'training', label: 'Training Dynamics', icon: Flame },
        { id: 'federation', label: 'Federated Learning', icon: Users },
        { id: 'privacy', label: 'Privacy Center', icon: Lock }
      ]
    },
    {
      title: 'SYSTEM',
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
                  <Icon size={17} className="nav-icon" />
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
          <span>Graph Credit Engine Active</span>
        </div>
      </div>
    </aside>
  )
}
