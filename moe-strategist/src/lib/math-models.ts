/**
 * Core mathematical models for real-time economic analysis.
 * All functions are pure (no side effects) and safe to use in useMemo/useCallback.
 */

// ── EMA smoothing factor (0 < α ≤ 1). Higher = more reactive. ────────────────
export const EMA_ALPHA = 0.3

/**
 * Compound Annual Growth Rate
 *
 *   CAGR = (V_final / V_initial)^(1/t) − 1
 *
 * @param vFinal  - Ending value
 * @param vInitial - Starting value (must be > 0)
 * @param t       - Number of periods (years)
 * @returns CAGR as a decimal (e.g. 0.042 = 4.2%)
 */
export function cagr(vFinal: number, vInitial: number, t: number): number {
  if (vInitial <= 0 || t <= 0 || vFinal <= 0) return 0
  return Math.pow(vFinal / vInitial, 1 / t) - 1
}

/**
 * Exponential Moving Average — smooths noisy live data.
 *
 *   EMA_t = α · X_t + (1 − α) · EMA_{t−1}
 *
 * @param alpha    - Smoothing factor (use EMA_ALPHA = 0.3)
 * @param x        - New raw data point
 * @param prevEma  - Previous EMA value
 */
export function ema(alpha: number, x: number, prevEma: number): number {
  return alpha * x + (1 - alpha) * prevEma
}

/**
 * Dynamic Sustainability Score — weighted ratio of renewables to total energy.
 *
 *   S_score = Σ w_i · (R_i / T_i)
 *
 * @param sectors - Array of { r: renewables, t: total, w: weight }
 * @returns Score in [0, 1]; multiply by 100 for percentage
 */
export function sustainabilityScore(
  sectors: Array<{ r: number; t: number; w: number }>
): number {
  return sectors.reduce((sum, s) => {
    if (s.t <= 0) return sum
    return sum + s.w * (s.r / s.t)
  }, 0)
}

/**
 * Normalise a value to [0, 100] range given known min/max.
 * Useful for displaying scores on stat cards.
 */
export function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

// ── LaTeX-style formula strings (used in Methodology tooltips) ────────────────
export const FORMULAS = {
  cagr: {
    label: 'Compound Annual Growth Rate',
    latex: 'CAGR = \\left(\\frac{V_{final}}{V_{initial}}\\right)^{\\frac{1}{t}} - 1',
    plain: 'CAGR = (V_final ÷ V_initial)^(1/t) − 1',
    description:
      'Projects future economic states by measuring the mean annual growth rate of a value over a specified time period, assuming compounding.',
  },
  ema: {
    label: 'Exponential Moving Average',
    latex: 'EMA_t = \\alpha \\cdot X_t + (1 - \\alpha) \\cdot EMA_{t-1}',
    plain: 'EMAₜ = α·Xₜ + (1−α)·EMAₜ₋₁',
    description:
      'Smooths noisy live-streamed data by applying exponentially decreasing weights to older observations. α=0.3 balances responsiveness with stability.',
  },
  sustainability: {
    label: 'Dynamic Sustainability Score',
    latex: 'S_{score} = \\sum_{i=1}^{n} w_i \\left(\\frac{R_i}{T_i}\\right)',
    plain: 'S_score = Σ wᵢ·(Rᵢ / Tᵢ)',
    description:
      'A weighted composite score measuring a country\'s live energy transition velocity — ratio of renewable (R) to total (T) energy per sector, weighted by strategic importance.',
  },
} as const
