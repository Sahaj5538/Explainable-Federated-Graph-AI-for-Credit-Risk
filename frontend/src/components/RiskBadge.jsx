import React from 'react'
import { AlertTriangle, ShieldCheck, AlertCircle, Info } from 'lucide-react'
import { riskBand } from '../labels.js'

/**
 * RiskBadge - now correctly shows 4 risk levels based on probability
 * 
 * Before: only checked prediction string "HIGH RISK" vs "LOW RISK" (binary model)
 *   -> moderate accounts (p=0.4-0.65) were incorrectly shown as HIGH RISK if p>0.5
 * 
 * After: if probability is provided, uses riskBand(probability) to get:
 *   - High (p >=0.85) -> red
 *   - Elevated (0.65-0.85) -> gray
 *   - Moderate (0.35-0.65) -> light gray
 *   - Low (p <0.35) -> very light
 */

export default function RiskBadge({ prediction, probability }) {
  // If probability is available, use the 4-band system (more accurate)
  if (probability != null && !isNaN(probability)) {
    const band = riskBand(probability)
    
    const config = {
      high: { icon: AlertTriangle, className: 'high', label: 'HIGH RISK' },
      elevated: { icon: AlertCircle, className: 'elevated', label: 'ELEVATED RISK' },
      moderate: { icon: Info, className: 'moderate', label: 'MODERATE RISK' },
      low: { icon: ShieldCheck, className: 'low', label: 'LOW RISK' },
    }

    const { icon: Icon, className, label } = config[band.key] || config.low

    return (
      <span className={`risk-badge ${className}`} title={`${band.label} - ${(probability*100).toFixed(1)}% risk, score ${Math.round(300 + (1-probability)*600)}`}>
        <Icon size={13} />
        <span>{label}</span>
      </span>
    )
  }

  // Fallback: old binary logic if probability not provided
  const isHigh = prediction === 'HIGH RISK' || prediction === 'HIGH'
  const isMedium = prediction === 'MEDIUM RISK' || prediction === 'MEDIUM' || prediction === 'ELEVATED RISK' || prediction === 'MODERATE RISK'

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
      <span className="risk-badge moderate">
        <AlertCircle size={13} />
        <span>{prediction}</span>
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
