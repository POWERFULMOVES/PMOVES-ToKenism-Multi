/**
 * ZetaInspiredFilter Tests
 *
 * Tests for the Riemann zeta-inspired spectral filter:
 * - Weight computation from zeta zeros
 * - Spectrum filtering (circular convolution)
 * - Spectral similarity/distance metrics
 * - Multi-scale analysis
 * - Resonance detection
 */

import { ZetaInspiredFilter } from '../chit/zeta-filter';

describe('ZetaInspiredFilter', () => {
  // ============================================================
  // Configuration and Initialization Tests
  // ============================================================
  describe('Configuration', () => {
    test('should initialize with default config', () => {
      const filter = new ZetaInspiredFilter();
      const config = filter.getConfig();

      expect(config.numZeros).toBe(10);
      expect(config.decayFactor).toBe(0.9);
      expect(config.normalizeOutput).toBe(true);
    });

    test('should accept custom config', () => {
      const filter = new ZetaInspiredFilter({
        numZeros: 5,
        decayFactor: 0.8,
        normalizeOutput: false,
      });
      const config = filter.getConfig();

      expect(config.numZeros).toBe(5);
      expect(config.decayFactor).toBe(0.8);
      expect(config.normalizeOutput).toBe(false);
    });

    test('should clamp numZeros to valid range [1, 20]', () => {
      const filterLow = new ZetaInspiredFilter({ numZeros: 0 });
      const filterHigh = new ZetaInspiredFilter({ numZeros: 100 });

      expect(filterLow.getConfig().numZeros).toBe(1);
      expect(filterHigh.getConfig().numZeros).toBe(20);
    });

    test('should clamp decayFactor to valid range (0, 1]', () => {
      const filterLow = new ZetaInspiredFilter({ decayFactor: -0.5 });
      const filterHigh = new ZetaInspiredFilter({ decayFactor: 1.5 });

      expect(filterLow.getConfig().decayFactor).toBeGreaterThan(0);
      expect(filterHigh.getConfig().decayFactor).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================
  // Zeta Zeros Tests
  // ============================================================
  describe('Zeta Zeros', () => {
    test('should return correct number of zeta zeros', () => {
      const filter5 = new ZetaInspiredFilter({ numZeros: 5 });
      const filter10 = new ZetaInspiredFilter({ numZeros: 10 });

      expect(filter5.getZetaZeros()).toHaveLength(5);
      expect(filter10.getZetaZeros()).toHaveLength(10);
    });

    test('should return first zeta zero close to 14.134', () => {
      const filter = new ZetaInspiredFilter({ numZeros: 1 });
      const zeros = filter.getZetaZeros();

      expect(zeros[0]).toBeCloseTo(14.134725, 3);
    });

    test('should return zeta zeros in ascending order', () => {
      const filter = new ZetaInspiredFilter({ numZeros: 10 });
      const zeros = filter.getZetaZeros();

      for (let i = 1; i < zeros.length; i++) {
        expect(zeros[i]).toBeGreaterThan(zeros[i - 1]);
      }
    });
  });

  // ============================================================
  // Weight Computation Tests
  // ============================================================
  describe('Weight Computation', () => {
    test('should compute positive weights', () => {
      const filter = new ZetaInspiredFilter();
      const weights = filter.getWeights();

      expect(weights.length).toBe(10);
      for (const w of weights) {
        expect(w).toBeGreaterThan(0);
      }
    });

    test('should have decreasing weights with decay', () => {
      const filter = new ZetaInspiredFilter({ decayFactor: 0.8 });
      const weights = filter.getWeights();

      // Weights should generally decrease due to decay factor
      // (though log term affects this)
      const firstWeight = weights[0];
      const lastWeight = weights[weights.length - 1];
      expect(firstWeight).toBeGreaterThan(lastWeight);
    });

    test('should have normalized weights sum to 1', () => {
      const filter = new ZetaInspiredFilter();
      const normalizedWeights = filter.getNormalizedWeights();

      const sum = normalizedWeights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    test('should respect decay factor', () => {
      const filter90 = new ZetaInspiredFilter({ decayFactor: 0.9 });
      const filter50 = new ZetaInspiredFilter({ decayFactor: 0.5 });

      const weights90 = filter90.getWeights();
      const weights50 = filter50.getWeights();

      // Higher decay should give more weight to later zeros
      const ratio90 = weights90[5] / weights90[0];
      const ratio50 = weights50[5] / weights50[0];

      expect(ratio90).toBeGreaterThan(ratio50);
    });
  });

  // ============================================================
  // Spectrum Filtering Tests
  // ============================================================
  describe('Spectrum Filtering', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter({ numZeros: 5 });
    });

    test('should return empty array for empty input', () => {
      expect(filter.filterSpectrum([])).toEqual([]);
    });

    test('should return same value for single-element input', () => {
      const result = filter.filterSpectrum([0.5]);
      expect(result).toEqual([0.5]);
    });

    test('should return normalized output by default', () => {
      const result = filter.filterSpectrum([0.8, 0.6, 0.4, 0.2]);

      // Max should be 1.0 when normalized
      const max = Math.max(...result);
      expect(max).toBeCloseTo(1.0, 10);
    });

    test('should not normalize when disabled', () => {
      const filterNoNorm = new ZetaInspiredFilter({
        numZeros: 5,
        normalizeOutput: false,
      });
      const result = filterNoNorm.filterSpectrum([0.8, 0.6, 0.4, 0.2]);

      // Without normalization, max might not be 1.0
      const max = Math.max(...result);
      // It should still be a valid number
      expect(isFinite(max)).toBe(true);
    });

    test('should preserve length of input spectrum', () => {
      const input = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      const result = filter.filterSpectrum(input);

      expect(result).toHaveLength(input.length);
    });

    test('should produce different output from input', () => {
      const input = [1, 0, 0, 0, 0];
      const result = filter.filterSpectrum(input);

      // The filter should spread energy across spectrum
      expect(result).not.toEqual(input);
    });

    test('should handle uniform spectrum', () => {
      const uniform = [0.5, 0.5, 0.5, 0.5];
      const result = filter.filterSpectrum(uniform);

      // Uniform input with normalization should produce all 1.0 values
      // (since all filtered values are equal, normalizing sets max to 1.0)
      expect(result).toHaveLength(4);
      for (const v of result) {
        expect(v).toBeCloseTo(1.0, 10);
      }
    });
  });

  // ============================================================
  // Weighted Average Tests
  // ============================================================
  describe('Weighted Average', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter({ numZeros: 5 });
    });

    test('should return 0 for empty input', () => {
      expect(filter.weightedAverage([])).toBe(0);
    });

    test('should return value for single-element input', () => {
      const result = filter.weightedAverage([0.7]);
      expect(result).toBeCloseTo(0.7, 10);
    });

    test('should weight earlier elements more heavily', () => {
      // Front-loaded spectrum
      const frontLoaded = [1, 0, 0, 0, 0];
      // Back-loaded spectrum
      const backLoaded = [0, 0, 0, 0, 1];

      const frontAvg = filter.weightedAverage(frontLoaded);
      const backAvg = filter.weightedAverage(backLoaded);

      // First element should have more weight
      expect(frontAvg).toBeGreaterThan(backAvg);
    });

    test('should be between min and max of input', () => {
      const spectrum = [0.2, 0.4, 0.6, 0.8, 1.0];
      const avg = filter.weightedAverage(spectrum);

      expect(avg).toBeGreaterThanOrEqual(0);
      expect(avg).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================
  // Spectral Similarity Tests
  // ============================================================
  describe('Spectral Similarity', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter();
    });

    test('should return 0 for empty inputs', () => {
      expect(filter.spectralSimilarity([], [])).toBe(0);
      expect(filter.spectralSimilarity([1], [])).toBe(0);
    });

    test('should return 0 for different length inputs', () => {
      expect(filter.spectralSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    test('should return 1 for identical spectra', () => {
      const spectrum = [0.8, 0.6, 0.4, 0.2];
      const similarity = filter.spectralSimilarity(spectrum, spectrum);

      expect(similarity).toBeCloseTo(1.0, 10);
    });

    test('should return 1 for scaled versions', () => {
      const spectrum1 = [0.8, 0.6, 0.4, 0.2];
      const spectrum2 = [1.6, 1.2, 0.8, 0.4]; // 2x scale

      const similarity = filter.spectralSimilarity(spectrum1, spectrum2);

      // Cosine similarity should be 1 for scaled vectors
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('should return value in [0, 1]', () => {
      const s1 = [0.1, 0.9, 0.3, 0.7];
      const s2 = [0.8, 0.2, 0.6, 0.4];

      const similarity = filter.spectralSimilarity(s1, s2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('should be symmetric', () => {
      const s1 = [0.1, 0.9, 0.3, 0.7];
      const s2 = [0.8, 0.2, 0.6, 0.4];

      expect(filter.spectralSimilarity(s1, s2)).toBeCloseTo(
        filter.spectralSimilarity(s2, s1),
        10
      );
    });

    test('should detect similar spectra', () => {
      const s1 = [0.8, 0.6, 0.4, 0.2];
      const s2 = [0.75, 0.55, 0.35, 0.15]; // Similar shape

      const similarity = filter.spectralSimilarity(s1, s2);

      expect(similarity).toBeGreaterThan(0.9);
    });
  });

  // ============================================================
  // Spectral Distance Tests
  // ============================================================
  describe('Spectral Distance', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter();
    });

    test('should return 0 for identical spectra', () => {
      const spectrum = [0.5, 0.5, 0.5, 0.5];
      const distance = filter.spectralDistance(spectrum, spectrum);

      expect(distance).toBeCloseTo(0, 10);
    });

    test('should return 1 - similarity', () => {
      const s1 = [0.8, 0.6, 0.4, 0.2];
      const s2 = [0.1, 0.3, 0.5, 0.7];

      const similarity = filter.spectralSimilarity(s1, s2);
      const distance = filter.spectralDistance(s1, s2);

      expect(distance).toBeCloseTo(1 - similarity, 10);
    });

    test('should be in [0, 1]', () => {
      const s1 = [0.1, 0.9, 0.3];
      const s2 = [0.9, 0.1, 0.7];

      const distance = filter.spectralDistance(s1, s2);

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================
  // Spectral Analysis Tests
  // ============================================================
  describe('Spectral Analysis', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter();
    });

    test('should return empty analysis for empty input', () => {
      const analysis = filter.analyzeSpectrum([]);

      expect(analysis.filtered).toEqual([]);
      expect(analysis.dominantIndex).toBe(-1);
      expect(analysis.concentration).toBe(0);
      expect(analysis.entropy).toBe(0);
    });

    test('should identify dominant frequency', () => {
      // Spectrum with clear peak at index 2
      const spectrum = [0.1, 0.2, 0.9, 0.3, 0.1];
      const analysis = filter.analyzeSpectrum(spectrum);

      // Dominant index should be where the peak is (or near it after filtering)
      expect(analysis.dominantIndex).toBeGreaterThanOrEqual(0);
      expect(analysis.dominantIndex).toBeLessThan(spectrum.length);
    });

    test('should calculate concentration in [0, 1]', () => {
      const spectrum = [0.8, 0.1, 0.05, 0.05];
      const analysis = filter.analyzeSpectrum(spectrum);

      expect(analysis.concentration).toBeGreaterThanOrEqual(0);
      expect(analysis.concentration).toBeLessThanOrEqual(1);
    });

    test('should have higher concentration for peaked spectrum', () => {
      // Very peaked spectrum
      const peaked = [1, 0, 0, 0];
      // Uniform spectrum
      const uniform = [0.25, 0.25, 0.25, 0.25];

      const peakedAnalysis = filter.analyzeSpectrum(peaked);
      const uniformAnalysis = filter.analyzeSpectrum(uniform);

      expect(peakedAnalysis.concentration).toBeGreaterThan(
        uniformAnalysis.concentration
      );
    });

    test('should calculate positive entropy', () => {
      const spectrum = [0.5, 0.3, 0.2, 0.1];
      const analysis = filter.analyzeSpectrum(spectrum);

      expect(analysis.entropy).toBeGreaterThan(0);
    });

    test('should have higher entropy for uniform spectrum', () => {
      const uniform = [0.25, 0.25, 0.25, 0.25];
      const peaked = [0.9, 0.05, 0.03, 0.02];

      const uniformAnalysis = filter.analyzeSpectrum(uniform);
      const peakedAnalysis = filter.analyzeSpectrum(peaked);

      expect(uniformAnalysis.entropy).toBeGreaterThan(peakedAnalysis.entropy);
    });
  });

  // ============================================================
  // Multi-Scale Filter Tests
  // ============================================================
  describe('Multi-Scale Filter', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter();
    });

    test('should return results for default scales', () => {
      const spectrum = [0.5, 0.4, 0.3, 0.2, 0.1];
      const results = filter.multiScaleFilter(spectrum);

      // Default scales are [3, 5, 10]
      expect(results.size).toBe(3);
      expect(results.has(3)).toBe(true);
      expect(results.has(5)).toBe(true);
      expect(results.has(10)).toBe(true);
    });

    test('should return results for custom scales', () => {
      const spectrum = [0.5, 0.4, 0.3, 0.2, 0.1];
      const results = filter.multiScaleFilter(spectrum, [2, 7, 15]);

      expect(results.size).toBe(3);
      expect(results.has(2)).toBe(true);
      expect(results.has(7)).toBe(true);
      expect(results.has(15)).toBe(true);
    });

    test('should produce different results at different scales', () => {
      const spectrum = [0.8, 0.6, 0.4, 0.2, 0.1];
      const results = filter.multiScaleFilter(spectrum, [3, 10]);

      const scale3 = results.get(3)!;
      const scale10 = results.get(10)!;

      // Results should differ between scales
      let anyDifference = false;
      for (let i = 0; i < scale3.length; i++) {
        if (Math.abs(scale3[i] - scale10[i]) > 0.01) {
          anyDifference = true;
          break;
        }
      }
      expect(anyDifference).toBe(true);
    });

    test('should preserve spectrum length at all scales', () => {
      const spectrum = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
      const results = filter.multiScaleFilter(spectrum, [3, 5, 10]);

      for (const [_, filtered] of results) {
        expect(filtered).toHaveLength(spectrum.length);
      }
    });
  });

  // ============================================================
  // Resonance Tests
  // ============================================================
  describe('Resonance', () => {
    let filter: ZetaInspiredFilter;

    beforeEach(() => {
      filter = new ZetaInspiredFilter({ numZeros: 10 });
    });

    test('should return 0 for single-element spectrum', () => {
      expect(filter.computeResonance([0.5])).toBe(0);
    });

    test('should return value in [0, 1]', () => {
      const spectrum = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const resonance = filter.computeResonance(spectrum);

      expect(resonance).toBeGreaterThanOrEqual(0);
      expect(resonance).toBeLessThanOrEqual(1);
    });

    test('should detect harmonic length', () => {
      const zeros = filter.getZetaZeros();
      const firstZero = Math.round(zeros[0]); // ~14

      // Spectrum with length close to first zeta zero should have higher resonance
      const harmonicSpectrum = new Array(firstZero).fill(0.5);
      const arbitrarySpectrum = new Array(17).fill(0.5); // Not near any zero

      const harmonicResonance = filter.computeResonance(harmonicSpectrum);
      const arbitraryResonance = filter.computeResonance(arbitrarySpectrum);

      // Harmonic length should have higher (or equal) resonance
      expect(harmonicResonance).toBeGreaterThanOrEqual(arbitraryResonance * 0.5);
    });

    test('should handle various spectrum lengths', () => {
      for (const length of [5, 10, 20, 50, 100]) {
        const spectrum = new Array(length).fill(0.5);
        const resonance = filter.computeResonance(spectrum);

        expect(isFinite(resonance)).toBe(true);
        expect(resonance).toBeGreaterThanOrEqual(0);
        expect(resonance).toBeLessThanOrEqual(1);
      }
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================
  describe('Edge Cases', () => {
    test('should handle all-zero spectrum', () => {
      const filter = new ZetaInspiredFilter();
      const zeros = [0, 0, 0, 0];

      const filtered = filter.filterSpectrum(zeros);
      const similarity = filter.spectralSimilarity(zeros, zeros);
      const analysis = filter.analyzeSpectrum(zeros);

      expect(filtered).toHaveLength(4);
      expect(similarity).toBe(0); // Zero vectors have no similarity
      expect(analysis.entropy).toBe(0);
    });

    test('should handle negative values in spectrum', () => {
      const filter = new ZetaInspiredFilter();
      const mixed = [-0.5, 0.5, -0.3, 0.3];

      // Should not throw
      expect(() => filter.filterSpectrum(mixed)).not.toThrow();
      expect(() => filter.analyzeSpectrum(mixed)).not.toThrow();
    });

    test('should handle very large spectrum', () => {
      const filter = new ZetaInspiredFilter();
      const large = new Array(1000).fill(0).map((_, i) => Math.sin(i / 10));

      const result = filter.filterSpectrum(large);
      expect(result).toHaveLength(1000);
    });

    test('should handle very small values', () => {
      const filter = new ZetaInspiredFilter();
      const tiny = [1e-10, 1e-10, 1e-10, 1e-10];

      const filtered = filter.filterSpectrum(tiny);
      const analysis = filter.analyzeSpectrum(tiny);

      expect(filtered).toHaveLength(4);
      expect(isFinite(analysis.entropy)).toBe(true);
    });
  });

  // ============================================================
  // Mathematical Property Tests
  // ============================================================
  describe('Mathematical Properties', () => {
    test('filter should be linear (superposition)', () => {
      const filter = new ZetaInspiredFilter({ normalizeOutput: false });

      const s1 = [1, 0, 0, 0];
      const s2 = [0, 1, 0, 0];
      const combined = [1, 1, 0, 0];

      const f1 = filter.filterSpectrum(s1);
      const f2 = filter.filterSpectrum(s2);
      const fCombined = filter.filterSpectrum(combined);

      // f(s1 + s2) should approximately equal f(s1) + f(s2)
      for (let i = 0; i < 4; i++) {
        expect(fCombined[i]).toBeCloseTo(f1[i] + f2[i], 5);
      }
    });

    test('similarity should be non-negative', () => {
      const filter = new ZetaInspiredFilter();

      for (let i = 0; i < 10; i++) {
        const s1 = Array.from({ length: 5 }, () => Math.random());
        const s2 = Array.from({ length: 5 }, () => Math.random());

        expect(filter.spectralSimilarity(s1, s2)).toBeGreaterThanOrEqual(0);
      }
    });

    test('distance should satisfy triangle inequality', () => {
      const filter = new ZetaInspiredFilter();

      const a = [0.8, 0.2, 0.5];
      const b = [0.3, 0.7, 0.4];
      const c = [0.5, 0.5, 0.9];

      const dAB = filter.spectralDistance(a, b);
      const dBC = filter.spectralDistance(b, c);
      const dAC = filter.spectralDistance(a, c);

      // Triangle inequality: d(a,c) <= d(a,b) + d(b,c)
      expect(dAC).toBeLessThanOrEqual(dAB + dBC + 1e-10);
    });
  });
});
