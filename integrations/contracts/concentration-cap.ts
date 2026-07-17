/**
 * Concentration cap (policy variable, open decision #6).
 *
 * `capWeights` clamps any weight above `cap` and redistributes the excess to the
 * under-cap holders proportionally (water-filling), preserving Σweight = 1. It
 * limits how much of a single distribution any one holder can receive — a
 * wealth-concentration guardrail (e.g. the Fordham <15% cap). Left OPEN as a
 * knob so the sweep can show its effect on concentration / Gini.
 */
export function capWeights(weights: number[], cap: number): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const s0 = weights.reduce((s, x) => s + x, 0);
  if (s0 <= 0) return weights.map(() => 1 / n); // degenerate → equal split

  const w = weights.map((x) => x / s0); // normalize to sum 1

  // If the cap is too low to be satisfiable (cap·n <= 1), NO distribution can
  // keep every holder at/under `cap` (they would sum to < 1). The flattest
  // possible distribution is equal shares (1/n each) — but note 1/n >= cap here,
  // so the cap is NOT actually enforced. Warn loudly so an operator relying on a
  // hard guardrail (e.g. Fordham <15% with a small cohort) is not misled.
  if (cap * n <= 1) {
    console.warn(
      `[capWeights] cap ${cap} is infeasible for ${n} holders (cap*n=${cap * n} <= 1): ` +
        `returning an equal 1/${n} split — the concentration cap is NOT enforceable at this cohort size.`
    );
    return w.map(() => 1 / n);
  }

  for (let iter = 0; iter < 1000; iter++) {
    let excess = 0;
    for (let i = 0; i < n; i++) {
      if (w[i] > cap) {
        excess += w[i] - cap;
        w[i] = cap;
      }
    }
    if (excess <= 1e-12) break;

    // Redistribute the excess to holders strictly under the cap, proportional
    // to their current weight.
    const underSum = w.reduce((s, x) => (x < cap ? s + x : s), 0);
    if (underSum <= 0) break; // everyone at the cap — nothing left to receive
    for (let i = 0; i < n; i++) {
      if (w[i] < cap) w[i] += (excess * w[i]) / underSum;
    }
  }

  return w;
}
