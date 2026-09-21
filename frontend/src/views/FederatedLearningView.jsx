import React, { useEffect, useState } from 'react'
import { Users, Lock } from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'

// ---------------------------------------------------------------------------
// FEDERATED LEARNING - no lifecycle, no rounds timeline.
// Just the essentials: the 5 protocol clients, how many accounts each one
// holds, and the output each side produces (federated vs centralized model
// on the same held-out test set).
// ---------------------------------------------------------------------------

export default function FederatedLearningView() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.network(), api.stats()])
      .then(([net, stats]) => setState({ net, stats }))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error">Could not load federated data: {error}</div>
  if (!state) return <div className="loading-state"><div className="spinner-ring" /><span>Loading federation data…</span></div>

  const { net, stats } = state

  // account counts per client (the non-IID partition)
  const counts = {}
  net.accounts.forEach((a) => {
    counts[a.client] = (counts[a.client] || 0) + 1
  })
  const clients = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const maxCount = Math.max(...clients.map(([, c]) => c), 1)

  const fed = stats.clients
  const centralAcc = stats.model.test_accuracy
  const centralF1 = stats.model.macro_f1

  const OutBar = ({ label, fedValue, centValue }) => (
    <div className="fed-out-row">
      <div className="fed-out-label">{label}</div>
      <div className="fed-out-bars">
        <div className="fed-out-bar">
          <span className="muted small">federated</span>
          <div className="fed-track">
            <div className="fed-fill" style={{ width: `${fedValue * 100}%` }} />
          </div>
          <span className="mono fed-out-val">{pct(fedValue)}</span>
        </div>
        <div className="fed-out-bar">
          <span className="muted small">centralized</span>
          <div className="fed-track">
            <div className="fed-fill dim" style={{ width: `${centValue * 100}%` }} />
          </div>
          <span className="mono fed-out-val">{pct(centValue)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="section-stack">
      {/* the 5 clients */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Users className="card-header-icon" size={18} />
            <span>The 5 federated clients (protocol institutions)</span>
          </div>
          <span className="muted small">each client trains on its own accounts only</span>
        </div>

        <div className="grid-5">
          {clients.map(([name, count]) => (
            <div key={name} className="client-card">
              <div className="client-name">{name}</div>
              <div className="client-count mono">{formatNumber(count)}</div>
              <div className="muted small" style={{ marginBottom: 8 }}>accounts</div>
              <div className="client-share-track">
                <div className="client-share-fill" style={{ width: `${(100 * count) / maxCount}%` }} />
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                {((100 * count) / net.accounts.length).toFixed(1)}% of network
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* outputs */}
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title">
            <Lock className="card-header-icon" size={18} />
            <span>Outputs — same held-out test set (0–100 scale)</span>
          </div>
          <span className="muted small">
            {fed.method} — the server only ever sees the masked aggregate
          </span>
        </div>

        <OutBar label="Test accuracy" fedValue={fed.test_accuracy} centValue={centralAcc} />
        <OutBar label="Macro F1" fedValue={fed.macro_f1} centValue={centralF1} />

        <div className="muted small" style={{ marginTop: 14 }}>
          The federated model keeps {pct(fed.test_accuracy / centralAcc, 1)} of the centralized
          accuracy while no raw account data ever leaves a client — updates are protected with
          pairwise-mask secure aggregation.
        </div>
      </div>
    </div>
  )
}
