/**
 * Dirichlet Weights Model
 *
 * Implements Dirichlet distribution for attribution weighting.
 * Given contribution amounts, produces probability distributions that sum to 1.
 *
 * Key concepts:
 * - α (alpha) parameters act as "pseudo-counts" for each contributor
 * - Higher contributions → higher α → higher expected weight
 * - smoothingAlpha prevents zero-weights for inactive contributors
 * - Decay reduces old contributions over time
 */

export interface DirichletConfig {
  /** Base α added to all categories (0.1 = spiky, 10 = uniform) */
  smoothingAlpha: number;
  /** Overall concentration parameter (higher = more uniform) */
  concentrationK: number;
  /** Weeks for contribution decay half-life */
  decayHalfLife: number;
}

export interface ContributionWeight {
  address: string;
  /** Dirichlet-derived weight [0,1], sum of all weights = 1 */
  weight: number;
  /** Original contribution amount before weighting */
  rawContribution: number;
  /** Individual α value for this contributor */
  alphaComponent: number;
  /** Category of contribution */
  category: string;
}

export interface CategoryContributions {
  category: string;
  totalAlpha: number;
  contributors: Map<string, { alpha: number; rawContribution: number; lastWeek: number }>;
}

export interface AttributionExport {
  address: string;
  category: string;
  weight: number;
  rawContribution: number;
  alphaComponent: number;
}

export class DirichletWeights {
  private config: DirichletConfig;
  private categories: Map<string, CategoryContributions> = new Map();
  private currentWeek: number = 0;

  constructor(config: Partial<DirichletConfig> = {}) {
    this.config = {
      smoothingAlpha: 0.1,     // Small base α for spiky distributions
      concentrationK: 1.0,     // Default concentration
      decayHalfLife: 12,       // 12-week half-life for decay
      ...config,
    };
  }

  /**
   * Add a contribution to an address in a category
   * This increases the contributor's α parameter
   */
  addContribution(address: string, amount: number, category: string, week: number): void {
    this.currentWeek = week;

    if (!this.categories.has(category)) {
      this.categories.set(category, {
        category,
        totalAlpha: 0,
        contributors: new Map(),
      });
    }

    const cat = this.categories.get(category)!;
    const existing = cat.contributors.get(address);

    if (existing) {
      // Add to existing α
      existing.alpha += amount * this.config.concentrationK;
      existing.rawContribution += amount;
      existing.lastWeek = week;
    } else {
      // New contributor
      cat.contributors.set(address, {
        alpha: this.config.smoothingAlpha + amount * this.config.concentrationK,
        rawContribution: amount,
        lastWeek: week,
      });
    }

    // Update total α for the category
    this.recalculateTotalAlpha(category);
  }

  /**
   * Recalculate total α for a category
   */
  private recalculateTotalAlpha(category: string): void {
    const cat = this.categories.get(category);
    if (!cat) return;

    let total = 0;
    for (const contributor of cat.contributors.values()) {
      total += contributor.alpha;
    }
    cat.totalAlpha = total;
  }

  /**
   * Get expected attribution weights (mean of Dirichlet distribution)
   * For Dirichlet(α₁, α₂, ..., αₙ), E[Xᵢ] = αᵢ / Σα
   */
  getExpectedAttribution(category?: string): ContributionWeight[] {
    const results: ContributionWeight[] = [];
    const categoriesToProcess = category
      ? [this.categories.get(category)].filter(Boolean) as CategoryContributions[]
      : Array.from(this.categories.values());

    for (const cat of categoriesToProcess) {
      if (cat.totalAlpha === 0) continue;

      for (const [address, contrib] of cat.contributors) {
        const weight = contrib.alpha / cat.totalAlpha;
        results.push({
          address,
          weight,
          rawContribution: contrib.rawContribution,
          alphaComponent: contrib.alpha,
          category: cat.category,
        });
      }
    }

    return results;
  }

  /**
   * Sample weights from Dirichlet distribution
   * Uses the gamma distribution method: sample Γ(αᵢ, 1) and normalize
   * For reproducibility, we use expected values (mean) as default
   */
  sampleWeights(category?: string, useMean: boolean = true): ContributionWeight[] {
    if (useMean) {
      return this.getExpectedAttribution(category);
    }

    // Monte Carlo sampling from Dirichlet
    const results: ContributionWeight[] = [];
    const categoriesToProcess = category
      ? [this.categories.get(category)].filter(Boolean) as CategoryContributions[]
      : Array.from(this.categories.values());

    for (const cat of categoriesToProcess) {
      if (cat.contributors.size === 0) continue;

      // Sample from Gamma(α, 1) for each contributor
      const gammaSamples: Map<string, number> = new Map();
      let totalGamma = 0;

      for (const [address, contrib] of cat.contributors) {
        // Simple gamma sampling via sum of exponentials approximation
        const sample = this.sampleGamma(contrib.alpha);
        gammaSamples.set(address, sample);
        totalGamma += sample;
      }

      // Normalize to get Dirichlet sample
      for (const [address, contrib] of cat.contributors) {
        const sample = gammaSamples.get(address)!;
        const weight = totalGamma > 0 ? sample / totalGamma : 0;
        results.push({
          address,
          weight,
          rawContribution: contrib.rawContribution,
          alphaComponent: contrib.alpha,
          category: cat.category,
        });
      }
    }

    return results;
  }

  /**
   * Approximate Gamma(α, 1) sampling using Marsaglia and Tsang's method
   * For small α, uses transformation
   */
  private sampleGamma(alpha: number): number {
    if (alpha < 1) {
      // For α < 1, use X = Y * U^(1/α) where Y ~ Gamma(α+1, 1)
      const u = Math.random();
      return this.sampleGamma(alpha + 1) * Math.pow(u, 1 / alpha);
    }

    // Marsaglia and Tsang's method for α >= 1
    const d = alpha - 1/3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.sampleNormal();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Sample from standard normal distribution using Box-Muller transform
   */
  private sampleNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Apply decay to contributions based on time
   * Uses exponential decay with configurable half-life
   */
  applyDecay(week: number): void {
    this.currentWeek = week;
    const decayRate = Math.log(2) / this.config.decayHalfLife;

    for (const cat of this.categories.values()) {
      for (const [address, contrib] of cat.contributors) {
        const weeksInactive = week - contrib.lastWeek;
        if (weeksInactive > 0) {
          const decayFactor = Math.exp(-decayRate * weeksInactive);
          contrib.alpha *= decayFactor;

          // Remove if α falls below smoothing threshold
          if (contrib.alpha < this.config.smoothingAlpha * 0.1) {
            cat.contributors.delete(address);
          }
        }
      }
      this.recalculateTotalAlpha(cat.category);
    }
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get contributor count for a category
   */
  getContributorCount(category: string): number {
    return this.categories.get(category)?.contributors.size ?? 0;
  }

  /**
   * Get total α for a category
   */
  getTotalAlpha(category: string): number {
    return this.categories.get(category)?.totalAlpha ?? 0;
  }

  /**
   * Get α parameters array for a category (for CGP encoding)
   */
  getAlphaVector(category: string): number[] {
    const cat = this.categories.get(category);
    if (!cat) return [];
    return Array.from(cat.contributors.values()).map(c => c.alpha);
  }

  /**
   * Export attribution data for CHIT encoding
   */
  exportAttribution(): AttributionExport[] {
    const results: AttributionExport[] = [];

    for (const cat of this.categories.values()) {
      if (cat.totalAlpha === 0) continue;

      for (const [address, contrib] of cat.contributors) {
        results.push({
          address,
          category: cat.category,
          weight: contrib.alpha / cat.totalAlpha,
          rawContribution: contrib.rawContribution,
          alphaComponent: contrib.alpha,
        });
      }
    }

    return results;
  }

  /**
   * Verify that weights sum to 1 for a category
   */
  verifyWeightSum(category: string): boolean {
    const weights = this.getExpectedAttribution(category);
    if (weights.length === 0) return true;

    const sum = weights.reduce((acc, w) => acc + w.weight, 0);
    return Math.abs(sum - 1.0) < 1e-10;
  }

  /**
   * Reset all contributions
   */
  reset(): void {
    this.categories.clear();
    this.currentWeek = 0;
  }

  /**
   * Get current week
   */
  getCurrentWeek(): number {
    return this.currentWeek;
  }
}
