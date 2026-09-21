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
  const [explainAccountId, setExplainAccountId] = useState(null)
  const [graphInteracting, setGraphInteracting] = useState(false)

  const isDashboard = activeTab === 'dashboard'

  // Central navigation. Accepts an optional payload, e.g.
  //   navigate('explainability', { accountId: 42 })
  // which is how "Deep Explanation" hands the analysed account over to the
  // XAI view (the old stale-789 bug).
  const navigate = (tab, opts) => {
    setActiveTab(tab)
    setExplainAccountId(opts && opts.accountId != null ? opts.accountId : null)
  }

  return (
    <div className="app-shell">
      {/* 1. Startup Intro Animation (cinematic, silver) */}
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}

      {/* 2. Left Navigation */}
      <SidebarNav activeTab={activeTab} setActiveTab={(tab) => navigate(tab)} />

      {/* 3. The graph - hero on the dashboard, living background everywhere else */}
      <GraphStage
        mode={isDashboard ? 'hero' : 'background'}
        filter={graphFilter}
        onSelectAccount={setInspectedAccountId}
        onUserInteraction={setGraphInteracting}
      />

      {/* 4. Main workspace (floats above the background graph) */}
      <div className="main-wrapper">
        <TopHeader activeTab={activeTab} />

        <main className={`main-content${isDashboard ? ' over-graph' : ''}`}>
          {isDashboard && (
            <DashboardView
              onNavigateTab={navigate}
              graphFilter={graphFilter}
              setGraphFilter={setGraphFilter}
              overlayHidden={graphInteracting}
            />
          )}

          {activeTab === 'credit-risk' && (
            <CreditRiskView
              onNavigateTab={navigate}
              onSelectAccount={setInspectedAccountId}
            />
          )}

          {activeTab === 'explainability' && (
            <ExplainabilityView
              focusAccountId={explainAccountId}
              onSelectAccount={setInspectedAccountId}
            />
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
