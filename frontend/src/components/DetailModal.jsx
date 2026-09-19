import React from 'react'
import { X } from 'lucide-react'
import AccountDetail from './AccountDetail.jsx'

export default function DetailModal({ accountId, onClose, onSelectAccount }) {
  if (accountId === null || accountId === undefined) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, color: 'var(--text-primary)' }}>
            Account #{accountId} Inspection
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <AccountDetail accountId={accountId} onClose={onClose} />
      </div>
    </div>
  )
}
