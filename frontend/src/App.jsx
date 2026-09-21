import React, { useState } from 'react'
import SidebarNav from './components/SidebarNav.jsx'
import TopHeader from './components/TopHeader.jsx'
import IntroAnimation from './components/IntroAnimation.jsx'
import DetailModal from './components/DetailModal.jsx'
import GraphStage from './components/GraphStage.jsx'

// Views
import DashboardView from './views/DashboardView.jsx'
import CreditRiskView from './views/CreditRiskView.jsx'
import ExplainabilityView from './views/ExplainabilityView.jsx'
import ModelComparisonView from './views/ModelComparisonView.jsx'
import FederatedLearningView from './views/FederatedLearningView.jsx'
import SystemStatusView from './views/SystemStatusView.jsx'

export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [graphFilter, setGraphFilter] = useState('all')
  const [inspectedAccountId, setInspectedAccountId] = useState(null)

  const isDashboard = activeTab === 'dashboard'

  return (
    <div className="app-shell">
      {/* 1. Startup Intro Animation (slowed, silver) */}
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}

      {/* 2. Left Navigation */}
      <SidebarNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. The graph - hero on the dashboard, living background everywhere else */}
      <GraphStage
        mode={isDashboard ? 'hero' : 'background'}
        filter={graphFilter}
        onSelectAccount={setInspectedAccountId}
      />

      {/* 4. Main workspace (floats above the background graph) */}
      <div className="main-wrapper">
        <TopHeader activeTab={activeTab} />

        <main className={`main-content${isDashboard ? ' over-graph' : ''}`}>
          {isDashboard && (
            <DashboardView
              onNavigateTab={setActiveTab}
              onSelectAccount={setInspectedAccountId}
              graphFilter={graphFilter}
              setGraphFilter={setGraphFilter}
            />
          )}

          {activeTab === 'credit-risk' && (
            <CreditRiskView
              onNavigateTab={setActiveTab}
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'explainability' && (
            <ExplainabilityView onSelectAccount={setInspectedAccountId} />
          )}

          {activeTab === 'model-performance' && <ModelComparisonView />}

          {activeTab === 'federation' && <FederatedLearningView />}

          {activeTab === 'status' && <SystemStatusView />}
        </main>
      </div>

      {/* 5. Account inspection slide-over */}
      <DetailModal
        accountId={inspectedAccountId}
        onClose={() => setInspectedAccountId(null)}
      />
    </div>
  )
}
