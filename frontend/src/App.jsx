import React, { useState } from 'react'
import SidebarNav from './components/SidebarNav.jsx'
import TopHeader from './components/TopHeader.jsx'
import IntroAnimation from './components/IntroAnimation.jsx'
import DetailModal from './components/DetailModal.jsx'

// Views
import DashboardView from './views/DashboardView.jsx'
import NetworkExplorerView from './views/NetworkExplorerView.jsx'
import WalletIntelligenceView from './views/WalletIntelligenceView.jsx'
import RiskAssessmentView from './views/RiskAssessmentView.jsx'
import ExplainabilityView from './views/ExplainabilityView.jsx'
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
      {/* 1. Cinematic Intro Overlay */}
      {showIntro && (
        <IntroAnimation onComplete={() => setShowIntro(false)} />
      )}

      {/* 2. Left Navigation Sidebar */}
      <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. Main Workspace */}
      <div className="main-wrapper">
        <TopHeader activeTab={activeTab} />

        <main className="main-content">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigateTab={setActiveTab}
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'network' && (
            <NetworkExplorerView
              onSelectAccount={setInspectedAccountId}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'wallets' && (
            <WalletIntelligenceView
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'risk' && (
            <RiskAssessmentView
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'explainability' && (
            <ExplainabilityView
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'models' && <ModelComparisonView />}

          {activeTab === 'training' && <TrainingView />}

          {activeTab === 'federation' && <FederatedLearningView />}

          {activeTab === 'privacy' && <PrivacyCenterView />}

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
