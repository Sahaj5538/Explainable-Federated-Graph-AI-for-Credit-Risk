import React from 'react'
import { AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react'

export default function RiskBadge({ prediction, probability }) {
  const isHigh = prediction === 'HIGH RISK' || prediction === 'HIGH'
  const isMedium = prediction === 'MEDIUM RISK' || prediction === 'MEDIUM'

  if (isHigh) {
    return (
      <span className="risk-badge high">
        <AlertTriangle size={13} />
        <span>HIGH RISK</span>
      </span>
    )
  }

  if (isMedium) {
    return (
      <span className="risk-badge medium">
        <AlertCircle size={13} />
        <span>MEDIUM RISK</span>
      </span>
    )
  }

  return (
    <span className="risk-badge low">
      <ShieldCheck size={13} />
      <span>LOW RISK</span>
    </span>
  )
}
