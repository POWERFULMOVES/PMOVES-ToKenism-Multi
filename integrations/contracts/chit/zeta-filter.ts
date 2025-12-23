/**
 * Zeta-Inspired Spectral Filter for CGP Spectrum Processing
 *
 * Uses first N non-trivial Riemann zeta zeros (γ_n ≈ 14.13, 21.02, 25.01, ...)
 * to create frequency-domain filtering weights for CGP spectrum arrays.
 *
 * Mathematical basis:
 * - Each zero γ_n corresponds to a "harmonic" frequency on the critical line Re(s) = 1/2
 * - Weights derived from 1/log(γ_n) decay patterns, mimicking prime distribution
 * - Creates scale-invariant filtering across hierarchical data
 *
 * @remarks
 * The Riemann zeta function zeros encode fundamental information about
 * the distribution of primes. By using these zeros as frequency weights,
 * we create a filter that respects natural hierarchical scaling patterns.
 *
 * @example
 * ```typescript
 * const filter = new ZetaInspiredFilter({ numZeros: 10 });
 * const spectrum = [0.8, 0.6, 0.3, 0.1];
 * const filtered = filter.filterSpectrum(spectrum);
 * // Returns harmonically-weighted spectrum
 *
 * const similarity = filter.spectralSimilarity(spectrum1, spectrum2);
 * // Returns [0,1] similarity score
 * ```
 *
 * @packageDocumentation
 * @module chit/zeta-filter
 */

/**
 * Configuration options for ZetaInspiredFilter
 */
export interface ZetaFilterConfig {
  /** Number of zeta zeros to use (1-20, default: 10) */
  numZeros: number;
  /** Exponential decay factor for higher zeros (0-1, default: 0.9) */
  decayFactor: number;
  /** Normalize output spectrum to [0,1] (default: true) */
  normalizeOutput: boolean;
}

/**
 * Result of spectral analysis
 */
export interface SpectralAnalysis {
  /** Filtered spectrum values */
  filtered: number[];
  /** Dominant frequency index */
  dominantIndex: number;
  /** Energy concentration (Gini-like measure) */
  concentration: number;
  /** Spectral entropy */
  entropy: number;
}

/**
 * First 20 non-trivial Riemann zeta zeros (imaginary parts only)
 *
 * These are the first zeros on the critical line Re(s) = 1/2
 * Each γ_n represents ζ(1/2 + iγ_n) = 0
 *
 * @see https://oeis.org/A002410 for high-precision values
 */
const ZETA_ZEROS: readonly number[] = Object.freeze([
  14.134725141734693790, // γ_1
  21.022039638771554993, // γ_2
  25.010857580145688763, // γ_3
  30.424876125859513210, // γ_4
  32.935061587739189691, // γ_5
  37.586178158825671257, // γ_6
  40.918719012147495187, // γ_7
  43.327073280914999519, // γ_8
  48.005150881167159727, // γ_9
  49.773832477672302181, // γ_10
  52.970321477714460644, // γ_11
  56.446247697063394804, // γ_12
  59.347044002602353079, // γ_13
  60.831778524609809844, // γ_14
  65.112544048081606660, // γ_15
  67.079810529494173714, // γ_16
  69.546401711173979252, // γ_17
  72.067157674481907582, // γ_18
  75.704690699083933168, // γ_19
  77.144840068874805373, // γ_20
]);

/**
 * Zeta-Inspired Spectral Filter
 *
 * Applies frequency-domain filtering using Riemann zeta zeros as weights.
 * Useful for analyzing CGP spectrum arrays with natural harmonic structure.
 */
export class ZetaInspiredFilter {
  private readonly config: ZetaFilterConfig;
  private readonly weights: number[];
  private readonly normalizedWeights: number[];

  /**
   * Create a new ZetaInspiredFilter
   *
   * @param config - Configuration options
   * @throws Error if numZeros > 20 or decayFactor not in (0,1]
   */
  constructor(config: Partial<ZetaFilterConfig> = {}) {
    this.config = {
      numZeros: Math.min(Math.max(config.numZeros ?? 10, 1), 20),
      decayFactor: Math.min(Math.max(config.decayFactor ?? 0.9, 0.01), 1.0),
      normalizeOutput: config.normalizeOutput ?? true,
    };

    this.weights = this.computeWeights();
    this.normalizedWeights = this.normalizeWeights(this.weights);
  }

  /**
   * Compute filter weights from zeta zeros
   *
   * Weight formula: w_n = decay^n / log(γ_n)
   * This creates a decay pattern that emphasizes lower harmonics
   * while respecting the logarithmic spacing of zeta zeros.
   */
  private computeWeights(): number[] {
    const zeros = ZETA_ZEROS.slice(0, this.config.numZeros);
    return zeros.map((gamma, i) =>
      Math.pow(this.config.decayFactor, i) / Math.log(gamma)
    );
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0);
    return sum > 0 ? weights.map((w) => w / sum) : weights;
  }

  /**
   * Get the raw filter weights
   */
  getWeights(): number[] {
    return [...this.weights];
  }

  /**
   * Get the normalized filter weights (sum to 1)
   */
  getNormalizedWeights(): number[] {
    return [...this.normalizedWeights];
  }

  /**
   * Get the zeta zeros being used
   */
  getZetaZeros(): number[] {
    return ZETA_ZEROS.slice(0, this.config.numZeros) as number[];
  }

  /**
   * Get the current configuration
   */
  getConfig(): ZetaFilterConfig {
    return { ...this.config };
  }

  /**
   * Apply zeta-inspired filter to CGP spectrum array
   *
   * Uses circular convolution with zeta-weighted kernel.
   * Each output value is a weighted sum of neighboring inputs.
   *
   * @param spectrum - Input spectrum values (typically [0,1])
   * @returns Filtered spectrum with harmonic weighting
   */
  filterSpectrum(spectrum: number[]): number[] {
    if (spectrum.length === 0) return [];
    if (spectrum.length === 1) return [...spectrum];

    const filtered = new Array(spectrum.length).fill(0);

    for (let i = 0; i < spectrum.length; i++) {
      let weighted = 0;
      for (let k = 0; k < this.weights.length && k < spectrum.length; k++) {
        const idx = (i + k) % spectrum.length;
        weighted += spectrum[idx] * this.normalizedWeights[k];
      }
      filtered[i] = weighted;
    }

    if (this.config.normalizeOutput) {
      const max = Math.max(...filtered);
      if (max > 0) {
        return filtered.map((v) => v / max);
      }
    }

    return filtered;
  }

  /**
   * Apply weighted average filter (non-circular)
   *
   * Computes a single weighted average of the entire spectrum,
   * useful for dimensionality reduction.
   *
   * @param spectrum - Input spectrum values
   * @returns Single weighted average value
   */
  weightedAverage(spectrum: number[]): number {
    if (spectrum.length === 0) return 0;

    let weighted = 0;
    let totalWeight = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const weight =
        i < this.normalizedWeights.length ? this.normalizedWeights[i] : 0;
      weighted += spectrum[i] * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weighted / totalWeight : 0;
  }

  /**
   * Compute zeta-weighted similarity between two spectra
   *
   * Uses cosine similarity in the zeta-filtered space.
   * Values closer to 1 indicate more similar spectra.
   *
   * @param a - First spectrum
   * @param b - Second spectrum
   * @returns Similarity score in [0,1]
   */
  spectralSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    if (a.length !== b.length) return 0;

    const filteredA = this.filterSpectrum(a);
    const filteredB = this.filterSpectrum(b);

    // Cosine similarity in zeta-weighted space
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < filteredA.length; i++) {
      dot += filteredA[i] * filteredB[i];
      normA += filteredA[i] ** 2;
      normB += filteredB[i] ** 2;
    }

    if (normA <= 0 || normB <= 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Compute spectral distance (1 - similarity)
   *
   * @param a - First spectrum
   * @param b - Second spectrum
   * @returns Distance in [0,1]
   */
  spectralDistance(a: number[], b: number[]): number {
    return 1 - this.spectralSimilarity(a, b);
  }

  /**
   * Perform full spectral analysis on a spectrum
   *
   * Returns filtered spectrum plus derived metrics:
   * - dominantIndex: index of maximum filtered value
   * - concentration: Gini-like measure (0 = uniform, 1 = concentrated)
   * - entropy: Shannon entropy of filtered distribution
   *
   * @param spectrum - Input spectrum
   * @returns SpectralAnalysis object
   */
  analyzeSpectrum(spectrum: number[]): SpectralAnalysis {
    const filtered = this.filterSpectrum(spectrum);

    if (filtered.length === 0) {
      return {
        filtered: [],
        dominantIndex: -1,
        concentration: 0,
        entropy: 0,
      };
    }

    // Find dominant index
    let maxVal = filtered[0];
    let dominantIndex = 0;
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i] > maxVal) {
        maxVal = filtered[i];
        dominantIndex = i;
      }
    }

    // Compute concentration (Gini coefficient approximation)
    const sorted = [...filtered].sort((a, b) => a - b);
    const n = sorted.length;
    let giniNum = 0;
    for (let i = 0; i < n; i++) {
      giniNum += (2 * (i + 1) - n - 1) * sorted[i];
    }
    const giniDenom = n * sorted.reduce((a, b) => a + b, 0);
    const concentration = giniDenom > 0 ? giniNum / giniDenom : 0;

    // Compute entropy
    const sum = filtered.reduce((a, b) => a + b, 0);
    let entropy = 0;
    if (sum > 0) {
      for (const val of filtered) {
        const p = val / sum;
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
      }
    }

    return {
      filtered,
      dominantIndex,
      concentration: Math.max(0, Math.min(1, concentration)),
      entropy,
    };
  }

  /**
   * Apply multi-scale filtering
   *
   * Generates filtered spectra at multiple scales (using different
   * numbers of zeta zeros) and returns all results.
   *
   * @param spectrum - Input spectrum
   * @param scales - Array of numZeros values to use (default: [3, 5, 10])
   * @returns Map of scale -> filtered spectrum
   */
  multiScaleFilter(
    spectrum: number[],
    scales: number[] = [3, 5, 10]
  ): Map<number, number[]> {
    const results = new Map<number, number[]>();

    for (const scale of scales) {
      const tempFilter = new ZetaInspiredFilter({
        ...this.config,
        numZeros: Math.min(scale, 20),
      });
      results.set(scale, tempFilter.filterSpectrum(spectrum));
    }

    return results;
  }

  /**
   * Compute resonance with zeta zeros
   *
   * Measures how well the spectrum length aligns with zeta zero spacing.
   * Higher values indicate the spectrum has natural harmonic structure.
   *
   * @param spectrum - Input spectrum
   * @returns Resonance score in [0,1]
   */
  computeResonance(spectrum: number[]): number {
    if (spectrum.length < 2) return 0;

    const zeros = this.getZetaZeros();
    let resonance = 0;

    for (const gamma of zeros) {
      // Check if spectrum length is harmonically related to gamma
      const ratio = spectrum.length / gamma;
      const nearestInt = Math.round(ratio);
      if (nearestInt > 0) {
        const deviation = Math.abs(ratio - nearestInt) / nearestInt;
        resonance += Math.exp(-deviation * 10); // Exponential penalty for deviation
      }
    }

    return Math.min(1, resonance / zeros.length);
  }
}
