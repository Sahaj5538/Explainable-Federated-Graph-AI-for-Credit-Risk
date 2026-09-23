import React, { useEffect, useState } from 'react'
import { Users, Lock, Info } from 'lucide-react'
import { api, pct, formatNumber } from '../api.js'

const ALL_CLIENTS = ["Aave", "Compound", "MakerDAO", "Uniswap", "Curve Finance"]

const CLIENT_INFO = {
  "Aave": "Mainly Aave protocol users",
  "Compound": "Mainly Compound protocol users",
  "MakerDAO": "Mainly MakerDAO users",
  "Uniswap": "Mainly Uniswap traders",
  "Curve Finance": "Aggregator - accounts with no single dominant protocol (diffuse activity)"
}

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

  const counts = {}
  ALL_CLIENTS.forEach(c=> counts[c]=0)
  net.accounts.forEach((a) => {
    if (counts[a.client] !== undefined) counts[a.client] += 1
    else counts[a.client] = (counts[a.client] || 0) + 1
  })
  // Ensure all 5 shown even if zero
  const clients = ALL_CLIENTS.map(name => [name, counts[name] || 0])
  const sortedClients = [...clients].sort((a,b)=>b[1]-a[1])
  const maxCount = Math.max(...clients.map(([,c])=>c), 1)

  const fed = stats.clients
  const centralAcc = stats.model.test_accuracy
  const centralF1 = stats.model.macro_f1

  const OutBar = ({ label, fedValue, centValue }) => (
    <div className="fed-out-row">
      <div className="fed-out-label">{label}</div>
      <div className="fed-out-bars">
        <div className="fed-out-bar">
          <span className="muted small">federated</span>
          <div className="fed-track"><div className="fed-fill" style={{ width: `${fedValue*100}%` }} /></div>
          <span className="mono fed-out-val">{pct(fedValue)}</span>
        </div>
        <div className="fed-out-bar">
          <span className="muted small">centralized</span>
          <div className="fed-track"><div className="fed-fill dim" style={{ width: `${centValue*100}%` }} /></div>
          <span className="mono fed-out-val">{pct(centValue)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="section-stack">
      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title"><Users className="card-header-icon" size={18} /><span>The 5 federated clients (always 5, even if one is empty)</span></div>
          <span className="muted small">each client trains on its own accounts only</span>
        </div>

        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(201,210,217,0.06)', borderRadius: 8, fontSize: 12, color: '#8B98A5', lineHeight: 1.6, display: 'flex', gap: 8 }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span><strong style={{ color: '#C9D2D9' }}>Why 5 clients?</strong> Aave, Compound, MakerDAO, Uniswap are the 4 main protocols. <strong style={{ color: '#C9D2D9' }}>Curve Finance</strong> is the 5th client that acts as aggregator for accounts that don't have one dominant protocol (less than 50% activity in any single protocol). If no account is diffuse, its count can be 0, but we still show it to keep the graph consistent with 5 clients.</span>
        </div>

        <div className="grid-5">
          {sortedClients.map(([name, count]) => (
            <div key={name} className="client-card" style={{ opacity: count===0?0.6:1, borderColor: count===0?'rgba(255,255,255,0.06)':'' }}>
              <div className="client-name">{name}</div>
              <div className="client-count mono">{formatNumber(count)}</div>
              <div className="muted small" style={{ marginBottom: 4 }}>accounts</div>
              <div style={{ fontSize: 10, color: '#616B74', marginBottom: 8, minHeight: 28, lineHeight: 1.4 }}>{CLIENT_INFO[name]}</div>
              <div className="client-share-track"><div className="client-share-fill" style={{ width: `${(100*count)/maxCount}%`, background: count===0?'#3D4852':'' }} /></div>
              <div className="muted small" style={{ marginTop: 6 }}>{count>0 ? `${((100*count)/net.accounts.length).toFixed(1)}% of network` : '0% - no diffuse accounts in this run'}</div>
            </div>
          ))}
        </div>

        <div className="muted small" style={{ marginTop: 12 }}>
          Total accounts: {net.accounts.length} • Graph always shows 5 clients to match federated setup (Aave, Compound, MakerDAO, Uniswap, Curve Finance as aggregator)
        </div>
      </div>

      <div className="titanium-card">
        <div className="card-header">
          <div className="card-header-title"><Lock className="card-header-icon" size={18} /><span>Outputs — same held-out test set</span></div>
          <span className="muted small">{fed.method} — server only sees masked aggregate</span>
        </div>
        <OutBar label="Test accuracy" fedValue={fed.test_accuracy} centValue={centralAcc} />
        <OutBar label="Macro F1" fedValue={fed.macro_f1} centValue={centralF1} />
        <div className="muted small" style={{ marginTop: 14 }}>
          Federated keeps {pct(fed.test_accuracy/centralAcc,1)} of centralized accuracy while no raw data leaves client.
        </div>
      </div>
    </div>
  )
}
