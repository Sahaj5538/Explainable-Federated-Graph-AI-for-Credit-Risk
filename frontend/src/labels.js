// ---------------------------------------------------------------------------
// HUMAN-READABLE LABELS + RISK BANDS (shared across the whole frontend)
//
// The model works with technical feature names (e.g. historical_liquidation_count).
// The interface never shows them raw - everything is mapped to language a
// non-technical reader understands.
// ---------------------------------------------------------------------------

export const FEATURE_LABELS = {
  historical_liquidation_count: 'History of adverse credit events',
  liquidation_rate: 'Share of borrowing that ended badly',
  borrow_frequency: 'How often it borrows',
  borrow_volume: 'Total amount borrowed',
  borrow_intensity: 'Borrowing vs. overall activity',
  unique_counterparties: 'Number of distinct trading partners',
  deposit_volume: 'Total amount deposited',
  borrow_to_repay_ratio: 'Balance between borrowing and repaying',
  repayment_ratio: 'Repayment consistency',
  repay_count: 'Number of repayments made',
  total_volume: 'Total transaction volume',
  failed_tx_ratio: 'Share of transactions that failed',
  failed_transactions: 'Failed transactions',
}

export const humanFeature = (feature) =>
  FEATURE_LABELS[feature] || feature.replace(/_/g, ' ')

// ---------------------------------------------------------------------------
// RISK BANDS (Option A: the binary model's probability mapped to a spectrum)
//
//   LOW       p < 0.35      score 690 - 900
//   MODERATE  0.35 - 0.65   score 510 - 690
//   ELEVATED  0.65 - 0.85   score 390 - 510
//   HIGH      p >= 0.85     score 300 - 390
// ---------------------------------------------------------------------------

export const RISK_BANDS = [
  { key: 'high', label: 'High Risk', short: 'HIGH', color: '#E05A5A', min: 0.85 },
  { key: 'elevated', label: 'Elevated Risk', short: 'ELEVATED', color: '#929CA3', min: 0.65 },
  { key: 'moderate', label: 'Moderate Risk', short: 'MODERATE', color: '#C9D2D9', min: 0.35 },
  { key: 'low', label: 'Low Risk', short: 'LOW', color: '#F2F6F9', min: 0 },
]

export const riskBand = (p) =>
  RISK_BANDS.find((b) => p >= b.min) || RISK_BANDS[RISK_BANDS.length - 1]

// Traditional credit-score style value (300 - 900, higher = safer)
export const creditScore = (p) => Math.round(300 + (1 - p) * 600)
