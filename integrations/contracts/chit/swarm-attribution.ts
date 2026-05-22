/**
 * Swarm Attribution
 *
 * Integrates ToKenism economic simulation with the swarm.meta.v1 schema
 * for optimization tracking and fitness evaluation.
 *
 * Key capabilities:
 * - Create swarm meta records from simulation data
 * - Track optimization targets (Gini reduction, wealth growth, participation)
 * - Calculate fitness scores based on configurable objectives
 * - Support population-based optimization experiments
 *
 * @see swarm.meta.v1.schema.json for schema definition
 * @see cgp-generator.ts for CGP output
 */

import { WeeklySimulationData } from './cgp-generator';

/**
 * Swarm Meta v1 structure (following schema)
 */
export interface SwarmMeta {
  namespace: string;
  modality: string;
  pack_id: string;
  status: 'active' | 'draft' | 'archived';
  version?: string | null;
  population_id?: string | null;
  best_fitness?: number | null;
  metrics?: Record<string, unknown> | null;
  ts: string;
}

/**
 * Extended metrics for ToKenism simulations
 */
export interface ToKenismMetrics {
  /** Gini coefficient [0, 1] - lower is better */
  gini: number;
  /** Gini change from previous week */
  gini_delta?: number;
  /** Poverty rate [0, 1] - lower is better */
  poverty_rate: number;
  /** Poverty change from previous week */
  poverty_delta?: number;
  /** Total wealth in system */
  total_wealth: number;
  /** Wealth growth rate */
  wealth_growth_rate?: number;
  /** Total spending (velocity indicator) */
  total_spending: number;
  /** Total savings (stability indicator) */
  total_savings: number;
  /** Active participant count */
  participant_count: number;
  /** Participation rate [0, 1] */
  participation_rate?: number;
  /** Group purchase participation */
  group_participation?: number;
  /** Staking participation */
  staking_participation?: number;
  /** Governance participation (voting rate) */
  governance_participation?: number;
  /** Average loyalty streak */
  avg_loyalty_streak?: number;
}

/**
 * Optimization targets for fitness calculation
 */
export type OptimizationTarget =
  | 'gini_reduction'
  | 'wealth_growth'
  | 'participation'
  | 'poverty_reduction'
  | 'balanced'
  | 'custom';

/**
 * Fitness weights for multi-objective optimization
 */
export interface FitnessWeights {
  gini: number;
  poverty: number;
  wealth: number;
  participation: number;
  spending: number;
  savings: number;
}

/**
 * Swarm Attribution configuration
 */
export interface SwarmAttributionConfig {
  /** Namespace for swarm tracking */
  namespace: string;
  /** Modality identifier */
  modality: string;
  /** Optimization target */
  optimizationTarget: OptimizationTarget;
  /** Custom fitness weights (for 'custom' target) */
  fitnessWeights?: Partial<FitnessWeights>;
  /** Population identifier for experiments */
  populationId?: string;
  /** Version string */
  version?: string;
  /** Target Gini for fitness normalization */
  targetGini?: number;
  /** Target poverty rate for fitness normalization */
  targetPoverty?: number;
  /** Baseline wealth for growth calculation */
  baselineWealth?: number;
}

/**
 * Population tracking for optimization experiments
 */
export interface Population {
  id: string;
  name: string;
  config: SwarmAttributionConfig;
  generations: GenerationRecord[];
  bestFitness: number;
  bestWeek?: number;
  created: string;
}

/**
 * Generation record for evolutionary tracking
 */
export interface GenerationRecord {
  generation: number;
  week: number;
  fitness: number;
  metrics: ToKenismMetrics;
  timestamp: string;
}

/**
 * Default fitness weights for each optimization target
 */
const TARGET_WEIGHTS: Record<OptimizationTarget, FitnessWeights> = {
  gini_reduction: {
    gini: 0.6,
    poverty: 0.2,
    wealth: 0.1,
    participation: 0.05,
    spending: 0.025,
    savings: 0.025,
  },
  wealth_growth: {
    gini: 0.1,
    poverty: 0.1,
    wealth: 0.5,
    participation: 0.1,
    spending: 0.1,
    savings: 0.1,
  },
  participation: {
    gini: 0.1,
    poverty: 0.1,
    wealth: 0.1,
    participation: 0.5,
    spending: 0.1,
    savings: 0.1,
  },
  poverty_reduction: {
    gini: 0.2,
    poverty: 0.6,
    wealth: 0.1,
    participation: 0.05,
    spending: 0.025,
    savings: 0.025,
  },
  balanced: {
    gini: 0.2,
    poverty: 0.2,
    wealth: 0.2,
    participation: 0.2,
    spending: 0.1,
    savings: 0.1,
  },
  custom: {
    gini: 0.2,
    poverty: 0.2,
    wealth: 0.2,
    participation: 0.2,
    spending: 0.1,
    savings: 0.1,
  },
};

/**
 * Swarm Attribution class
 *
 * Integrates ToKenism simulation with swarm.meta.v1 for fitness and
 * population tracking. It records generations and scores simulation states;
 * it does not perform mutation, selection, crossover, or particle updates.
 *
 * @example
 * ```typescript
 * const swarm = new SwarmAttribution({
 *   namespace: 'pmoves.tokenism',
 *   modality: 'economic_simulation',
 *   optimizationTarget: 'gini_reduction'
 * });
 *
 * const meta = swarm.createSwarmMeta(weekData);
 * const fitness = swarm.calculateFitness(weekData);
 * ```
 */
export class SwarmAttribution {
  private config: SwarmAttributionConfig;
  private populations: Map<string, Population> = new Map();
  private fitnessWeights: FitnessWeights;
  private previousWeekData?: WeeklySimulationData;
  private bestFitness: number = -Infinity;

  constructor(config: Partial<SwarmAttributionConfig> = {}) {
    this.config = {
      namespace: 'pmoves.tokenism',
      modality: 'economic_simulation',
      optimizationTarget: 'gini_reduction',
      targetGini: 0.3,
      targetPoverty: 0.1,
      baselineWealth: 100000,
      ...config,
    };

    // Set fitness weights based on target
    this.fitnessWeights = {
      ...TARGET_WEIGHTS[this.config.optimizationTarget],
      ...(this.config.fitnessWeights || {}),
    };
  }

  /**
   * Create swarm meta record from simulation data
   */
  createSwarmMeta(simulation: WeeklySimulationData): SwarmMeta {
    const fitness = this.calculateFitness(simulation);
    const metrics = this.extractMetrics(simulation);

    // Track best fitness
    if (fitness > this.bestFitness) {
      this.bestFitness = fitness;
    }

    return {
      namespace: this.config.namespace,
      modality: this.config.modality,
      pack_id: `sim-week-${simulation.week}`,
      status: 'active',
      version: this.config.version || '1.0.0',
      population_id: simulation.populationId || this.config.populationId || null,
      best_fitness: this.bestFitness,
      metrics: metrics as unknown as Record<string, unknown>,
      ts: new Date().toISOString(),
    };
  }

  /**
   * Calculate fitness score for simulation state
   *
   * Higher is better. Score in range [0, 1].
   */
  calculateFitness(simulation: WeeklySimulationData): number {
    const w = this.fitnessWeights;

    // Calculate component scores (all normalized to [0, 1], higher is better)
    const giniScore = this.calculateGiniScore(simulation.gini);
    const povertyScore = this.calculatePovertyScore(simulation.povertyRate);
    const wealthScore = this.calculateWealthScore(simulation.totalWealth);
    const participationScore = this.calculateParticipationScore(simulation);
    const spendingScore = this.calculateSpendingScore(simulation);
    const savingsScore = this.calculateSavingsScore(simulation);

    // Weighted sum
    const fitness =
      w.gini * giniScore +
      w.poverty * povertyScore +
      w.wealth * wealthScore +
      w.participation * participationScore +
      w.spending * spendingScore +
      w.savings * savingsScore;

    // Store for delta calculations
    this.previousWeekData = simulation;

    return Math.max(0, Math.min(1, fitness));
  }

  /**
   * Calculate Gini component score
   * Lower Gini = higher score
   */
  private calculateGiniScore(gini: number): number {
    const target = this.config.targetGini || 0.3;
    // Score = 1 when gini <= target, decreases as gini increases
    if (gini <= target) {
      return 1.0;
    }
    // Linear decay from target to 1.0 (max gini)
    return Math.max(0, 1 - (gini - target) / (1 - target));
  }

  /**
   * Calculate poverty component score
   * Lower poverty = higher score
   */
  private calculatePovertyScore(povertyRate: number): number {
    const target = this.config.targetPoverty || 0.1;
    if (povertyRate <= target) {
      return 1.0;
    }
    return Math.max(0, 1 - (povertyRate - target) / (1 - target));
  }

  /**
   * Calculate wealth component score
   * Higher wealth growth = higher score
   */
  private calculateWealthScore(totalWealth: number): number {
    const baseline = this.config.baselineWealth || 100000;
    // Score based on wealth ratio to baseline
    const ratio = totalWealth / baseline;
    // Sigmoid-like scaling: 0.5 at baseline, approaches 1 as wealth grows
    return 1 / (1 + Math.exp(-2 * (ratio - 1)));
  }

  /**
   * Calculate participation component score
   */
  private calculateParticipationScore(simulation: WeeklySimulationData): number {
    // Simple participation based on activity
    // Could be extended with more detailed participation metrics
    const expectedParticipants = simulation.participantCount || 50;
    const actualParticipants = simulation.participantCount;
    return Math.min(1, actualParticipants / expectedParticipants);
  }

  /**
   * Calculate spending component score
   * Healthy spending velocity = higher score
   */
  private calculateSpendingScore(simulation: WeeklySimulationData): number {
    // Target spending as percentage of wealth
    const spendingRate = simulation.totalSpending / Math.max(1, simulation.totalWealth);
    // Optimal spending rate around 5-10%
    const optimalRate = 0.075;
    const deviation = Math.abs(spendingRate - optimalRate);
    return Math.max(0, 1 - deviation / optimalRate);
  }

  /**
   * Calculate savings component score
   * Healthy savings = higher score
   */
  private calculateSavingsScore(simulation: WeeklySimulationData): number {
    // Target savings as percentage of spending
    const savingsRate = simulation.totalSavings / Math.max(1, simulation.totalSpending);
    // Optimal savings rate around 10-20%
    const optimalRate = 0.15;
    const deviation = Math.abs(savingsRate - optimalRate);
    return Math.max(0, 1 - deviation / (optimalRate * 2));
  }

  /**
   * Extract detailed metrics from simulation
   */
  extractMetrics(simulation: WeeklySimulationData): ToKenismMetrics {
    const metrics: ToKenismMetrics = {
      gini: simulation.gini,
      poverty_rate: simulation.povertyRate,
      total_wealth: simulation.totalWealth,
      total_spending: simulation.totalSpending,
      total_savings: simulation.totalSavings,
      participant_count: simulation.participantCount,
    };

    // Add delta metrics if we have previous data
    if (this.previousWeekData) {
      metrics.gini_delta = simulation.gini - this.previousWeekData.gini;
      metrics.poverty_delta = simulation.povertyRate - this.previousWeekData.povertyRate;
      metrics.wealth_growth_rate =
        (simulation.totalWealth - this.previousWeekData.totalWealth) /
        Math.max(1, this.previousWeekData.totalWealth);
    }

    return metrics;
  }

  /**
   * Create or get a population for experiments
   */
  createPopulation(id: string, name: string, config?: Partial<SwarmAttributionConfig>): Population {
    if (this.populations.has(id)) {
      return this.populations.get(id)!;
    }

    const population: Population = {
      id,
      name,
      config: { ...this.config, ...config },
      generations: [],
      bestFitness: -Infinity,
      created: new Date().toISOString(),
    };

    this.populations.set(id, population);
    return population;
  }

  /**
   * Record a generation in a population
   */
  recordGeneration(
    populationId: string,
    generation: number,
    simulation: WeeklySimulationData
  ): GenerationRecord {
    const population = this.populations.get(populationId);
    if (!population) {
      throw new Error(`Population not found: ${populationId}`);
    }

    const fitness = this.calculateFitness(simulation);
    const metrics = this.extractMetrics(simulation);

    const record: GenerationRecord = {
      generation,
      week: simulation.week,
      fitness,
      metrics,
      timestamp: new Date().toISOString(),
    };

    population.generations.push(record);

    // Update best fitness
    if (fitness > population.bestFitness) {
      population.bestFitness = fitness;
      population.bestWeek = simulation.week;
    }

    return record;
  }

  /**
   * Get population summary
   */
  getPopulationSummary(populationId: string): {
    id: string;
    name: string;
    generations: number;
    bestFitness: number;
    bestWeek?: number;
    avgFitness: number;
    fitnessImprovement: number;
  } | null {
    const population = this.populations.get(populationId);
    if (!population) {
      return null;
    }

    const generations = population.generations;
    const avgFitness = generations.length > 0
      ? generations.reduce((sum, g) => sum + g.fitness, 0) / generations.length
      : 0;

    const fitnessImprovement = generations.length > 1
      ? generations[generations.length - 1].fitness - generations[0].fitness
      : 0;

    return {
      id: population.id,
      name: population.name,
      generations: generations.length,
      bestFitness: population.bestFitness,
      bestWeek: population.bestWeek,
      avgFitness,
      fitnessImprovement,
    };
  }

  /**
   * Create batch swarm metas for multiple weeks
   */
  createBatchSwarmMeta(simulations: WeeklySimulationData[]): SwarmMeta[] {
    return simulations.map(sim => this.createSwarmMeta(sim));
  }

  /**
   * Export population data for NATS publishing
   */
  exportPopulationNATS(populationId: string): {
    subject: string;
    payload: Record<string, unknown>;
  } | null {
    const summary = this.getPopulationSummary(populationId);
    if (!summary) {
      return null;
    }

    return {
      subject: 'tokenism.swarm.population.v1',
      payload: {
        population_id: summary.id,
        name: summary.name,
        generations: summary.generations,
        best_fitness: summary.bestFitness,
        best_week: summary.bestWeek,
        avg_fitness: summary.avgFitness,
        fitness_improvement: summary.fitnessImprovement,
        namespace: this.config.namespace,
        optimization_target: this.config.optimizationTarget,
        ts: new Date().toISOString(),
      },
    };
  }

  /**
   * Get best fitness achieved
   */
  getBestFitness(): number {
    return this.bestFitness;
  }

  /**
   * Reset tracking state
   */
  reset(): void {
    this.bestFitness = -Infinity;
    this.previousWeekData = undefined;
    this.populations.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): SwarmAttributionConfig {
    return { ...this.config };
  }

  /**
   * Get fitness weights
   */
  getFitnessWeights(): FitnessWeights {
    return { ...this.fitnessWeights };
  }
}
