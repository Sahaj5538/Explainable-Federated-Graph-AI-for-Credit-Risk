import React, { useState } from 'react'
import Overview from './components/Overview.jsx'
import AccountsTable from './components/AccountsTable.jsx'
import AccountDetail from './components/AccountDetail.jsx'
import PredictForm from './components/PredictForm.jsx'

// App shell: header + tab navigation + footer. The Accounts tab
// shows the full explanation inline under the table when a row is
// selected.

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts & explanations' },
  { id: 'predict', label: 'Predict' },
]

export default function App() {
  const [tab, setTab] = useState('overview')
  const [selectedAccountId, setSelectedAccountId] = useState(null)

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>DeFi Credit Risk</h1>
          <p className="muted">
            Explainable, privacy-preserving Graph AI · GraphSAGE ·
            federated learning with secure aggregation · SHAP
          </p>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'overview' && <Overview />}

        {tab === 'accounts' && (
          <div className="stack">
            <AccountsTable onSelect={setSelectedAccountId} />
            {selectedAccountId !== null && (
              <AccountDetail
                accountId={selectedAccountId}
                onClose={() => setSelectedAccountId(null)}
              />
            )}
          </div>
        )}

        {tab === 'predict' && <PredictForm />}
      </main>

      <footer className="footer muted">
        Features computed from the observation window only (no outcome
        leakage) · labels from the future window · seeded pipeline
      </footer>
    </div>
  )
}
