import React from 'react'

export default function MetricCard({ title, value, subtitle, icon: Icon, accent = 'emerald' }) {
  const accentClass = accent === 'emerald' ? 'emerald-accent' : accent === 'gold' ? 'gold-accent' : ''

  return (
    <div className={`metric-tile ${accentClass}`}>
      <div className="metric-label">
        <span>{title}</span>
        {Icon && <Icon size={16} className="text-secondary" />}
      </div>
      <div className="metric-value-huge">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  )
}
