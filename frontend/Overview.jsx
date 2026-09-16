import React, { useEffect, useState } from 'react'
import { api, pct } from '../api.js'

// Overview tab: model / dataset / federated stat cards + global
// feature importance bars, all from GET /api/stats.

function Card({ title, rows }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="card-rows">
        {rows.map(([label, value, accent]) => (
          <div className="card-row" key={label}>
            <span className="card-label">{label}</span>
            <span className={accent ? 'accent' : ''}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImportanceBars({ features }) {
  const max = Math.max(...features.map((f) => f.importance), 1e-9)
  return (
    <div className="card">
      <div className="card-title">
        Global feature importance (permutation, Macro-F1 drop)
      </div>
      <div className="bars">
        {features.map((f) => (
          <div className="bar-row" key={f.feature}>
            <span className="bar-label">{f.feature}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(100 * f.importance) / max}%` }}
              />
            </div>
            <span className="bar-value">{f.importance.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Overview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <div className="error">Could not load stats: {error}</div>
  if (!stats) return <div className="loading">Loading…</div>

  const fed = stats.clients

  return (
    <div className="stack">
      <div className="grid-3">
        <Card
          title="Model (production)"
          rows={[
            ['Type', `${stats.model.type} · binary liquidation risk`],
            ['Test accuracy', pct(stats.model.test_accuracy), true],
            ['Test Macro-F1', pct(stats.model.macro_f1), true],
            ['Features', `${stats.model.features} (observation window)`],
            ['Leakage-free', stats.model.leakage_free ? 'yes (seeded)' : 'no'],
          ]}
        />
        <Card
          title="Dataset"
          rows={[
            ['Accounts', stats.dataset.accounts.toLocaleString()],
            ['Observation window', stats.dataset.observation_window],
            ['Outcome window', stats.dataset.outcome_window],
            ['Actual HIGH RISK', stats.dataset.actual_high_risk],
            ['Predicted HIGH RISK', stats.dataset.predicted_high_risk],
          ]}
        />
        <Card
          title="Federated learning"
          rows={
            fed && fed.trained
              ? [
                  ['Method', fed.method],
                  ['Clients', (fed.clients || []).join(', ')],
                  ['Rounds', fed.rounds],
                  ['FL test accuracy', pct(fed.test_accuracy), true],
                  ['FL Macro-F1', pct(fed.macro_f1), true],
                ]
              : [['Status', 'not trained']]
          }
        />
      </div>
      <ImportanceBars features={stats.top_features} />
    </div>
  )
}
