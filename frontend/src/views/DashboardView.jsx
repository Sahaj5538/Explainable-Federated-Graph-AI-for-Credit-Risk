import React, { useEffect, useState } from 'react'
import { ShieldAlert, BrainCircuit, ChevronRight, X } from 'lucide-react'
import { api, getNetwork, pct, formatNumber } from '../api.js'

// ---------------------------------------------------------------------------
// DASHBOARD - the graph IS the dashboard.
//
// Only minimal overlays float over the hero graph:
//   * the name + four live stat chips (accounts, transactions, high-risk,
//     accuracy)
//   * graph filters (all / high / moderate / low / protocols)
//   * a one-line hint
//
// When the user interacts with the 3D graph (rotate / zoom / click), the
// overlay fades out smoothly (CSS transition) and fades back in ~1.6 s after
// the last gesture - the Netflix-logo fade, not a hard cut.
// ---------------------------------------------------------------------------

const TOUR_KEY = 'vertex_tour_seen'

const TOUR_STEPS = [
  {
    title: 'Rotate the graph',
    text: 'Drag anywhere to rotate the 3D credit network in any direction.',
  },
  {
    title: 'Zoom in and out',
    text: 'Scroll to move closer or further. The labels step aside while you interact.',
  },
  {
    title: 'Inspect an account',
    text: 'Click any sphere to open its full credit analysis.',
  },
]

export default function DashboardView({
  onNavigateTab,
  graphFilter,
  setGraphFilter,
  overlayHidden,
}) {
  const [stats, setStats] = useState(null)
  const [net, setNet] = useState(null)
  const [tourStep, setTourStep] = useState(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TOUR_KEY)
      ? -1
      : 0
  )

  const finishTour = () => {
    sessionStorage.setItem(TOUR_KEY, 'true')
    setTourStep(-1)
  }

  useEffect(() => {
    api.stats().then(setStats).catch(() => {})
    getNetwork().then(setNet).catch(() => {})
  }, [])

  const chips = [
    {
      value: stats ? formatNumber(stats.dataset.accounts) : '—',
      label: 'accounts',
    },
    {
      value: net ? formatNumber(net.transactions_count) : '—',
      label: 'transactions',
    },
    {
      value: stats ? formatNumber(stats.dataset.actual_high_risk) : '—',
      label: 'high-risk accounts',
    },
    {
      value: stats && stats.model ? pct(stats.model.test_accuracy) : '—',
      label: 'model accuracy',
    },
  ]

  return (
    <div className={`dashboard-overlay${overlayHidden ? ' overlay-hidden' : ''}`}>
      {/* top-left: identity + minimal stats */}
      <div className="dash-top-left">
        <div className="dash-caption">Vertex · Graph Credit Intelligence</div>

        <div className="dash-stats">
          {chips.map((c) => (
            <div key={c.label} className="dash-chip">
              <span className="dash-chip-value mono">{c.value}</span>
              <span className="dash-chip-label">{c.label}</span>
            </div>
          ))}
        </div>

        <div className="dash-actions">
          <button className="btn btn-primary btn-sm" onClick={() => onNavigateTab('credit-risk')}>
            <ShieldAlert size={14} /> Run Credit Analysis
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigateTab('explainability')}>
            <BrainCircuit size={14} /> Explain a Prediction
          </button>
        </div>
      </div>

      {/* top-right: graph filters */}
      <div className="dash-top-right">
        {[
          ['all', 'All accounts'],
          ['high', 'High risk'],
          ['moderate', 'Moderate'],
          ['low', 'Low risk'],
          ['protocols', 'Protocols'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={graphFilter === value ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setGraphFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* bottom-center: one quiet hint line */}
      <div className="dash-hint">Drag to rotate · Scroll to zoom · Click an account to inspect it</div>

      {/* first-visit guided tour */}
      {tourStep >= 0 && tourStep < TOUR_STEPS.length && (
        <div className="tour-card">
          <button className="tour-close" onClick={finishTour} aria-label="Skip tour">
            <X size={13} />
          </button>
          <div className="tour-step-count">
            {tourStep + 1} of {TOUR_STEPS.length}
          </div>
          <div className="tour-title">{TOUR_STEPS[tourStep].title}</div>
          <div className="tour-text">{TOUR_STEPS[tourStep].text}</div>
          <div className="tour-footer">
            <div className="tour-dots">
              {TOUR_STEPS.map((_, i) => (
                <span key={i} className={i === tourStep ? 'tour-dot active' : 'tour-dot'} />
              ))}
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => (tourStep === TOUR_STEPS.length - 1 ? finishTour() : setTourStep(tourStep + 1))}
            >
              {tourStep === TOUR_STEPS.length - 1 ? 'Got it' : 'Next'} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
