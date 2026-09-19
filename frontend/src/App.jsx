import React, { useState } from 'react'
import SidebarNav from './components/SidebarNav.jsx'
import TopHeader from './components/TopHeader.jsx'
import IntroAnimation from './components/IntroAnimation.jsx'
import DetailModal from './components/DetailModal.jsx'

// Views
import DashboardView from './views/DashboardView.jsx'
import MarketsView from './views/MarketsView.jsx'
import PortfolioView from './views/PortfolioView.jsx'
import SupplyView from './views/SupplyView.jsx'
import BorrowView from './views/BorrowView.jsx'
import CreditRiskView from './views/CreditRiskView.jsx'
import ExplainabilityView from './views/ExplainabilityView.jsx'
import NetworkExplorerView from './views/NetworkExplorerView.jsx'
import ModelComparisonView from './views/ModelComparisonView.jsx'
import TrainingView from './views/TrainingView.jsx'
import FederatedLearningView from './views/FederatedLearningView.jsx'
import PrivacyCenterView from './views/PrivacyCenterView.jsx'
import SystemArchitectureView from './views/SystemArchitectureView.jsx'
import SystemStatusView from './views/SystemStatusView.jsx'

export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [inspectedAccountId, setInspectedAccountId] = useState(null)

  return (
    <div className="app-shell">
      {/* 1. Startup Intro Animation */}
      {showIntro && (
        <IntroAnimation onComplete={() => setShowIntro(false)} />
      )}

      {/* 2. Left Navigation Sidebar */}
      <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. Main Workspace */}
      <div className="main-wrapper">
        <TopHeader activeTab={activeTab} />

        <main className="main-content">
          {/* OVERVIEW */}
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigateTab={setActiveTab}
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'markets' && (
            <MarketsView onNavigateTab={setActiveTab} />
          )}

          {/* YOUR FINANCE */}
          {activeTab === 'portfolio' && (
            <PortfolioView onNavigateTab={setActiveTab} />
          )}

          {activeTab === 'supply' && <SupplyView />}

          {activeTab === 'borrow' && <BorrowView />}

          {/* RISK INTELLIGENCE */}
          {activeTab === 'credit-risk' && (
            <CreditRiskView
              onNavigateTab={setActiveTab}
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'explainability' && (
            <ExplainabilityView
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'network' && (
            <NetworkExplorerView
              onSelectAccount={setInspectedAccountId}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* AI INFRASTRUCTURE */}
          {activeTab === 'model-performance' && <ModelComparisonView />}

          {activeTab === 'training' && <TrainingView />}

          {activeTab === 'federation' && <FederatedLearningView />}

          {activeTab === 'privacy' && <PrivacyCenterView />}

          {/* SYSTEM */}
          {activeTab === 'architecture' && <SystemArchitectureView />}

          {activeTab === 'status' && <SystemStatusView />}
        </main>
      </div>

      {/* 4. Account Inspection Slide-Over / Modal */}
      <DetailModal
        accountId={inspectedAccountId}
        onClose={() => setInspectedAccountId(null)}
      />
    </div>
  )
}
