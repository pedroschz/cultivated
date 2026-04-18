/**
 * Utilities to map SAT-like section scores to initial mastery percentages.
 * Uses an adjusted normal CDF centered at 500 with sigma ~= 118.82
 * so that 600 maps to roughly the 80th percentile.
 */

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Error function approximation using Math.erf when available; polyfill otherwise.
 */
function erf(x: number): number {
  if (typeof (Math as any).erf === 'function') {
    return (Math as any).erf(x);
  }
  // Abramowitz and Stegun formula 7.1.26
  // with maximal error of 1.5×10−7
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Adjusted normal CDF with mean mu and standard deviation sigma.
 * Returns a number in [0, 1].
 */
export function adjustedNormalCdf(x: number, mu: number = 500, sigma: number = 118.82): number {
  if (!Number.isFinite(x)) return 0;
  const z = (x - mu) / (sigma * Math.SQRT2);
  const y = 0.5 * (1 + erf(z));
  return clamp(y, 0, 1);
}

/**
 * Maps a SAT-like section score to a mastery percentage [0, 100].
 */
export function satScoreToMasteryPercent(x: number): number {
  return Math.round(adjustedNormalCdf(x) * 100);
}

/**
 * Proportionally cap a pair of section scores so that their sum does not exceed a cap.
 * If total <= cap, returns inputs unchanged.
 */
export function capSectionPairProportionally(mathScore: number, rwScore: number, capTotal: number = 1450): { math: number; rw: number } {
  const m = Math.max(0, Number(mathScore) || 0);
  const r = Math.max(0, Number(rwScore) || 0);
  const total = m + r;
  if (total <= capTotal || total === 0) return { math: m, rw: r };
  const factor = capTotal / total;
  return { math: Math.round(m * factor), rw: Math.round(r * factor) };
}


