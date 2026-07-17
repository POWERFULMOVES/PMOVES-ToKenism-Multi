/**
 * Concentration cap (open decision #6) — no single holder may exceed a maximum
 * share of a distribution. capWeights clamps any over-cap weight and redistributes
 * the excess to the smaller holders (water-filling), preserving the total.
 */

import { capWeights } from '../concentration-cap';

describe('capWeights', () => {
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
  const max = (a: number[]) => a.reduce((m, x) => (x > m ? x : m), -Infinity);

  it('caps every weight at the cap and preserves the total (feasible cap)', () => {
    const out = capWeights([0.625, 0.25, 0.125], 0.4);
    expect(max(out)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(sum(out)).toBeCloseTo(1, 9);
  });

  it('redistributes the capped excess to the smaller holders', () => {
    // top 0.8 capped to 0.6; excess 0.2 flows to the other holder → 0.4.
    const out = capWeights([0.8, 0.2], 0.6);
    expect(out[0]).toBeCloseTo(0.6, 9);
    expect(out[1]).toBeCloseTo(0.4, 9);
  });

  it('leaves an already-compliant distribution unchanged', () => {
    const out = capWeights([0.5, 0.3, 0.2], 0.6);
    expect(out[0]).toBeCloseTo(0.5, 9);
    expect(max(out)).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(sum(out)).toBeCloseTo(1, 9);
  });

  it('converges when redistribution pushes a holder over the cap (multi-pass)', () => {
    // 0.7→0.4 excess 0.3 → 0.28 becomes 0.56 (over cap) → must re-clamp next pass.
    const out = capWeights([0.7, 0.28, 0.02], 0.4);
    expect(max(out)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(sum(out)).toBeCloseTo(1, 9);
  });

  it('warns and returns an equal split when the cap is infeasible (cap*n <= 1)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const out = capWeights([0.5, 0.3, 0.2], 0.1); // 0.1*3 = 0.3 <= 1
    expect(out).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(warn).toHaveBeenCalled(); // operator is signalled the cap did not hold
    warn.mockRestore();
  });

  it('handles degenerate input', () => {
    expect(capWeights([], 0.4)).toEqual([]);
    expect(capWeights([0, 0], 0.4)).toEqual([0.5, 0.5]); // all-zero → equal split
  });
});
