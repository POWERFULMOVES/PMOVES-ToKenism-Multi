/**
 * Contract Coordinator
 * Unified coordinator for all PMOVES smart contract models
 *
 * Extended with CHIT (Context-Hybrid Information Token) integration:
 * - Shape Attribution for provable credit tracking
 * - CGP (CHIT Geometry Packet) v2 document export
 * - Swarm optimization integration
 */

import { GroTokenDistribution, GroTokenConfig, DistributionEvent } from './grotoken-model';
import { CommitmentModel } from './commitment-model';
import { DirichletWeights } from './chit/dirichlet-weights';
import { FoodUSDModel, FoodUSDConfig } from './foodusd-model';
import { GroupPurchaseModel, GroupPurchaseConfig } from './grouppurchase-model';
import { GroVaultModel, GroVaultConfig } from './grovault-model';
import { CoopGovernorModel, GovernanceConfig } from './coopgovernor-model';
import { EventBus } from '../event-bus/event-bus';

// CHIT Integration imports
import {
  ShapeAttribution,
  ShapeAttributionConfig,
  CGPGenerator,
  CGPGeneratorConfig,
  CGPDocument,
  SwarmAttribution,
  SwarmAttributionConfig,
  SwarmMeta,
  HyperbolicEncoder,
  WeeklySimulationData as CHITWeeklySimulationData,
} from './chit';

/**
 * CHIT Configuration for contract coordinator
 */
export interface CHITConfig {
  /** Enable CHIT attribution tracking */
  enabled: boolean;
  /** Shape attribution configuration */
  attribution?: Partial<ShapeAttributionConfig>;
  /** CGP generator configuration */
  cgp?: Partial<CGPGeneratorConfig>;
  /** Swarm optimization configuration */
  swarm?: Partial<SwarmAttributionConfig>;
}

export interface ContractCoordinatorConfig {
  groToken?: Partial<GroTokenConfig>;
  foodUSD?: Partial<FoodUSDConfig>;
  groupPurchase?: Partial<GroupPurchaseConfig>;
  groVault?: Partial<GroVaultConfig>;
  governance?: Partial<GovernanceConfig>;
  /** CHIT integration configuration */
  chit?: Partial<CHITConfig>;
  /** GroToken minted per participating household per week (flat commitment share). Default 0.5. */
  groTokenWeeklyPerCapita?: number;
}

export interface PopulationConfig {
  addresses: string[];
  initialWealth: number[];
}

export interface WeeklySimulationData {
  week: number;
  groTokenDistribution: ReturnType<typeof GroTokenDistribution.prototype.exportData>;
  foodUSDSpending: ReturnType<typeof FoodUSDModel.prototype.exportData>;
  groupPurchases: ReturnType<typeof GroupPurchaseModel.prototype.exportData>;
  staking: ReturnType<typeof GroVaultModel.prototype.exportData>;
  governance: ReturnType<typeof CoopGovernorModel.prototype.exportData>;
}

export class ContractCoordinator {
  // Models
  private groToken: GroTokenDistribution;
  private foodUSD: FoodUSDModel;
  private groupPurchase: GroupPurchaseModel;
  private groVault: GroVaultModel;
  private governance: CoopGovernorModel;

  // Commitment-first distribution (token-structure refresh): kept commitments
  // feed Dirichlet attribution that drives the weekly GroToken mint.
  private commitments: CommitmentModel = new CommitmentModel();
  private groTokenWeeklyPerCapita: number;

  // Event bus for integration
  private eventBus?: EventBus;

  // CHIT Integration components
  private chitEnabled: boolean = false;
  private shapeAttribution?: ShapeAttribution;
  private cgpGenerator?: CGPGenerator;
  private swarmAttribution?: SwarmAttribution;
  private hyperbolicEncoder?: HyperbolicEncoder;

  // State
  private currentWeek: number = 0;
  private initialized: boolean = false;
  private weeklySimulationHistory: CHITWeeklySimulationData[] = [];

  constructor(
    config: ContractCoordinatorConfig = {},
    eventBus?: EventBus
  ) {
    // Initialize models
    this.groToken = new GroTokenDistribution(config.groToken);
    this.foodUSD = new FoodUSDModel(config.foodUSD);
    this.groupPurchase = new GroupPurchaseModel(this.foodUSD, config.groupPurchase);
    this.groVault = new GroVaultModel(this.groToken, config.groVault);
    this.governance = new CoopGovernorModel(this.groVault, config.governance);
    this.groTokenWeeklyPerCapita = config.groTokenWeeklyPerCapita ?? 0.5;

    this.eventBus = eventBus;

    // Initialize CHIT components if enabled
    if (config.chit?.enabled) {
      this.initializeCHIT(config.chit);
    }

    console.log('[ContractCoordinator] Initialized all contract models');
  }

  /**
   * Initialize CHIT attribution components
   */
  private initializeCHIT(chitConfig: Partial<CHITConfig>): void {
    this.chitEnabled = true;

    // Initialize shape attribution
    this.shapeAttribution = new ShapeAttribution(chitConfig.attribution);

    // Initialize hyperbolic encoder
    this.hyperbolicEncoder = new HyperbolicEncoder();

    // Initialize CGP generator
    this.cgpGenerator = new CGPGenerator({
      namespace: 'pmoves.tokenism',
      includeProofs: true,
      includeHyperbolic: true,
      ...chitConfig.cgp,
    });

    // Initialize swarm attribution
    this.swarmAttribution = new SwarmAttribution({
      namespace: 'pmoves.tokenism',
      modality: 'economic_simulation',
      optimizationTarget: 'gini_reduction',
      ...chitConfig.swarm,
    });

    console.log('[ContractCoordinator] CHIT integration initialized');
  }

  /**
   * Initialize population and starting state
   */
  initialize(population: PopulationConfig): void {
    if (this.initialized) {
      console.warn('[ContractCoordinator] Already initialized');
      return;
    }

    // Initialize GroToken holders
    this.groToken.initializeHolders(population.addresses);

    // Initialize FoodUSD holders including contract addresses
    const foodUsdAddresses = [
      ...population.addresses,
      '0xGROUPPURCHASE_CONTRACT', // Group purchase escrow
      '0xSUPPLIER', // Generic supplier address
    ];
    this.foodUSD.initializeHolders(foodUsdAddresses);

    this.initialized = true;

    console.log(
      `[ContractCoordinator] Initialized with ${population.addresses.length} participants`
    );

    // Publish initialization event
    if (this.eventBus) {
      this.eventBus.publish(
        'contracts.initialized.v1',
        {
          population: population.addresses.length,
          timestamp: new Date().toISOString(),
        },
        'contract-coordinator'
      );
    }
  }

  /**
   * Distribute the weekly GroToken pool by kept-commitment attribution
   * (token-structure refresh §4.3). Each participating household keeps a flat
   * weekly commitment; those kept commitments feed Dirichlet attribution, which
   * drives the mint via distributeByAttribution — deterministic and
   * contribution-anchored, replacing the Gaussian random draw.
   *
   * Flat per-capita share is the simulation default; swap for a real
   * contribution measure (hosting / uplink / verified workload) once specced.
   */
  private distributeByCommitments(
    week: number,
    householdBudgets: Map<string, { foodBudget: number; totalIncome: number }>
  ): DistributionEvent[] {
    const participants = Array.from(householdBudgets.keys());
    if (participants.length === 0) return [];

    const dirichlet = new DirichletWeights();
    for (const address of participants) {
      // A household's weekly participation is a kept commitment (flat share).
      const id = this.commitments.createCommitment({
        deliverable: `weekly participation w${week}`,
        parties: [{ address, share: 1 }],
        category: 'weekly',
        deadline: week,
        week,
      });
      const records = this.commitments.markKept(id, week);
      for (const r of records) {
        dirichlet.addContribution(r.address, r.amount, r.category, r.week);
      }
    }

    const attribution = dirichlet.getExpectedAttribution('weekly');
    const pool = participants.length * this.groTokenWeeklyPerCapita;
    return this.groToken.distributeByAttribution(attribution, pool, week);
  }

  /**
   * Process a week of simulation
   */
  async processWeek(
    week: number,
    householdBudgets: Map<string, { foodBudget: number; totalIncome: number }>
  ): Promise<void> {
    this.currentWeek = week;

    console.log(`\n[ContractCoordinator] Processing week ${week}`);

    // 1. Distribute GroTokens by kept-commitment attribution (refresh §4.3),
    //    replacing the Gaussian random draw — distribution now tracks
    //    contribution and is deterministic/auditable.
    const tokenEvents = this.distributeByCommitments(week, householdBudgets);

    console.log(`  - Distributed ${tokenEvents.length} GroToken events`);

    // Record CHIT attribution for token distributions
    if (this.chitEnabled && this.shapeAttribution) {
      for (const event of tokenEvents) {
        // recordAction takes: address, action, amount, week, category
        this.shapeAttribution.recordAction(
          event.recipient,
          'token_received',
          event.dollarValue,
          week,
          'grotoken'
        );
      }
    }

    // Publish token distribution events
    if (this.eventBus) {
      for (const event of tokenEvents) {
        await this.eventBus.publish(
          'finance.transactions.ingested.v1',
          {
            namespace: 'simulation:grotoken',
            source: 'contract_coordinator',
            external_id: `grotoken-${week}-${event.recipient}`,
            occurred_at: new Date().toISOString(),
            amount: event.dollarValue,
            currency: 'USD',
            description: `GroToken distribution: ${event.amount} GRO to ${event.recipient}`,
            category: 'rewards',
            counterparty: event.recipient,
          },
          'grotoken-distribution'
        );
      }
    }

    // 2. Fund FoodUSD accounts
    for (const [address, budget] of householdBudgets) {
      this.foodUSD.fundAccount(address, budget.foodBudget);
    }

    // 3. Process food spending (simulated)
    for (const [address, budget] of householdBudgets) {
      // Distribute food budget across categories
      const groceries = budget.foodBudget * 0.6;
      const preparedFood = budget.foodBudget * 0.25;
      const dining = budget.foodBudget * 0.15;

      this.foodUSD.processWeeklySpending(week, address, {
        groceries,
        prepared_food: preparedFood,
        dining,
      });

      // Record CHIT attribution for spending
      if (this.chitEnabled && this.shapeAttribution) {
        if (groceries > 0) {
          this.shapeAttribution.recordAction(address, 'spending', groceries, week, 'groceries');
        }
        if (preparedFood > 0) {
          this.shapeAttribution.recordAction(address, 'spending', preparedFood, week, 'prepared_food');
        }
        if (dining > 0) {
          this.shapeAttribution.recordAction(address, 'spending', dining, week, 'dining');
        }
      }
    }

    // 4. Accrue interest on staked positions
    this.groVault.accrueInterest(week);

    // 5. Update weekly simulation history for CHIT
    if (this.chitEnabled) {
      this.updateWeeklyHistory(week);
    }

    console.log(`[ContractCoordinator] Week ${week} processed`);
  }

  /**
   * Update weekly simulation history for CHIT exports
   */
  private updateWeeklyHistory(week: number): void {
    const stats = this.getComprehensiveStats();

    // Calculate economic metrics
    const totalWealth = stats.groToken.totalValue + stats.staking.totalLockedValue;
    const totalSpending = stats.foodUSD.totalSpent;
    const totalSavings = stats.groupPurchase.totalSaved;

    // Calculate Gini coefficient (simplified)
    const gini = this.calculateGiniFromStats(stats);
    const povertyRate = this.calculatePovertyRate(stats);

    const weekData: CHITWeeklySimulationData = {
      week,
      gini,
      povertyRate,
      totalWealth,
      totalSpending,
      totalSavings,
      participantCount: stats.groToken.totalHolders,
    };

    this.weeklySimulationHistory.push(weekData);
  }

  /**
   * Calculate Gini coefficient from stats (simplified estimation)
   */
  private calculateGiniFromStats(stats: ReturnType<typeof this.getComprehensiveStats>): number {
    // This is a simplified Gini calculation
    // In production, would use actual wealth distribution
    const participationRate = stats.summary.participationRate;
    // Lower participation typically correlates with higher inequality
    return Math.max(0.2, Math.min(0.8, 0.6 - participationRate * 0.3));
  }

  /**
   * Calculate poverty rate from stats (simplified estimation)
   */
  private calculatePovertyRate(stats: ReturnType<typeof this.getComprehensiveStats>): number {
    // Simplified poverty rate based on participation
    const participationRate = stats.summary.participationRate;
    return Math.max(0.05, Math.min(0.5, 0.3 - participationRate * 0.2));
  }

  /**
   * Create a group purchase order
   */
  createGroupOrder(
    week: number,
    creator: string,
    category: string,
    targetAmount: number
  ): number {
    return this.groupPurchase.createOrder(
      week,
      creator,
      '0xSUPPLIER',
      targetAmount,
      category
    );
  }

  /**
   * Contribute to a group order
   */
  contributeToOrder(
    week: number,
    orderId: number,
    contributor: string,
    amount: number
  ): boolean {
    const result = this.groupPurchase.contribute(week, orderId, contributor, amount);

    // Record CHIT attribution for group contribution
    if (result && this.chitEnabled && this.shapeAttribution) {
      this.shapeAttribution.recordAction(contributor, 'group_contribution', amount, week, 'group_purchase');
    }

    return result;
  }

  /**
   * Stake GroTokens
   */
  stakeTokens(
    week: number,
    address: string,
    amount: number,
    durationYears: number
  ): boolean {
    const result = this.groVault.createLock(week, address, amount, durationYears);

    // Record CHIT attribution for staking
    if (result && this.chitEnabled && this.shapeAttribution) {
      this.shapeAttribution.recordAction(address, 'staking', amount, week, 'staking');
    }

    return result;
  }

  /**
   * Create a governance proposal
   */
  createProposal(
    week: number,
    proposer: string,
    description: string,
    category: string = 'general'
  ): number {
    return this.governance.createProposal(week, proposer, description, category);
  }

  /**
   * Vote on a proposal
   */
  vote(
    week: number,
    proposalId: number,
    voter: string,
    votes: number,
    support: boolean
  ): boolean {
    const result = this.governance.castVote(week, proposalId, voter, votes, support);

    // Record CHIT attribution for voting
    if (result && this.chitEnabled && this.shapeAttribution) {
      this.shapeAttribution.recordAction(voter, 'voting', votes, week, 'governance');
    }

    return result;
  }

  /**
   * Get comprehensive statistics for all contracts
   */
  getComprehensiveStats(): {
    groToken: ReturnType<typeof GroTokenDistribution.prototype.getStatistics>;
    foodUSD: ReturnType<typeof FoodUSDModel.prototype.getStatistics>;
    groupPurchase: ReturnType<typeof GroupPurchaseModel.prototype.getStatistics>;
    staking: ReturnType<typeof GroVaultModel.prototype.getStatistics>;
    governance: ReturnType<typeof CoopGovernorModel.prototype.getStatistics>;
    summary: {
      totalValueLocked: number;
      totalSavingsGenerated: number;
      participationRate: number;
      governanceEngagement: number;
    };
  } {
    const groTokenStats = this.groToken.getStatistics();
    const foodUSDStats = this.foodUSD.getStatistics();
    const groupPurchaseStats = this.groupPurchase.getStatistics();
    const stakingStats = this.groVault.getStatistics();
    const governanceStats = this.governance.getStatistics();

    const totalValueLocked =
      groTokenStats.totalValue + stakingStats.totalLockedValue;

    const summary = {
      totalValueLocked,
      totalSavingsGenerated: groupPurchaseStats.totalSaved,
      participationRate:
        groTokenStats.totalHolders > 0
          ? groTokenStats.activeParticipants / groTokenStats.totalHolders
          : 0,
      governanceEngagement: governanceStats.averageParticipationRate,
    };

    return {
      groToken: groTokenStats,
      foodUSD: foodUSDStats,
      groupPurchase: groupPurchaseStats,
      staking: stakingStats,
      governance: governanceStats,
      summary,
    };
  }

  /**
   * Calculate wealth impact for an address
   */
  calculateWealthImpact(address: string): {
    groTokenValue: number;
    stakingValue: number;
    groupBuyingSavings: number;
    totalImpact: number;
    breakdown: {
      tokens: ReturnType<typeof GroTokenDistribution.prototype.calculateWealthImpact>;
      staking: ReturnType<typeof GroVaultModel.prototype.calculateWealthAccumulation>;
      savings: ReturnType<typeof GroupPurchaseModel.prototype.getParticipantSavings>;
    };
  } {
    const tokenImpact = this.groToken.calculateWealthImpact(address);
    const stakingImpact = this.groVault.calculateWealthAccumulation(address);
    const savingsImpact = this.groupPurchase.getParticipantSavings(address);

    return {
      groTokenValue: tokenImpact.dollarValue,
      stakingValue: stakingImpact.totalValue * 2.0, // Assuming $2 per token
      groupBuyingSavings: savingsImpact.totalSaved,
      totalImpact:
        tokenImpact.dollarValue +
        stakingImpact.totalValue * 2.0 +
        savingsImpact.totalSaved,
      breakdown: {
        tokens: tokenImpact,
        staking: stakingImpact,
        savings: savingsImpact,
      },
    };
  }

  /**
   * Compare traditional economy vs token economy
   */
  compareEconomies(traditionalSpending: Record<string, number>): {
    traditional: {
      totalSpending: number;
      noTokens: boolean;
      noStaking: boolean;
      noGroupBuying: boolean;
    };
    tokenEconomy: {
      totalSpending: number;
      tokenValue: number;
      stakingValue: number;
      groupSavings: number;
      totalBenefit: number;
    };
    difference: {
      absolute: number;
      percentage: number;
    };
  } {
    const stats = this.getComprehensiveStats();

    const traditionalTotal = Object.values(traditionalSpending).reduce(
      (sum, v) => sum + v,
      0
    );

    const tokenEconomyTotal = stats.foodUSD.totalSpent;

    const tokenValue = stats.groToken.totalValue;
    const stakingValue = stats.staking.totalLockedValue;
    const groupSavings = stats.groupPurchase.totalSaved;

    const totalBenefit = tokenValue + stakingValue + groupSavings;

    const difference = totalBenefit - (traditionalTotal - tokenEconomyTotal);
    const percentageDiff =
      traditionalTotal > 0 ? (difference / traditionalTotal) * 100 : 0;

    return {
      traditional: {
        totalSpending: traditionalTotal,
        noTokens: true,
        noStaking: true,
        noGroupBuying: true,
      },
      tokenEconomy: {
        totalSpending: tokenEconomyTotal,
        tokenValue,
        stakingValue,
        groupSavings,
        totalBenefit,
      },
      difference: {
        absolute: difference,
        percentage: percentageDiff,
      },
    };
  }

  /**
   * Export all data for analysis
   */
  exportAllData(): WeeklySimulationData {
    return {
      week: this.currentWeek,
      groTokenDistribution: this.groToken.exportData(),
      foodUSDSpending: this.foodUSD.exportData(),
      groupPurchases: this.groupPurchase.exportData(),
      staking: this.groVault.exportData(),
      governance: this.governance.exportData(),
    };
  }

  /**
   * Get individual models (for direct access)
   */
  getModels() {
    return {
      groToken: this.groToken,
      foodUSD: this.foodUSD,
      groupPurchase: this.groupPurchase,
      groVault: this.groVault,
      governance: this.governance,
    };
  }

  /**
   * Get current week
   */
  getCurrentWeek(): number {
    return this.currentWeek;
  }

  // ============================================================
  // CHIT Integration Methods
  // ============================================================

  /**
   * Check if CHIT integration is enabled
   */
  isCHITEnabled(): boolean {
    return this.chitEnabled;
  }

  /**
   * Export current week as CGP document
   *
   * @example
   * ```typescript
   * const cgp = coordinator.exportWeekCGP(12);
   * console.log(cgp.summary); // "ToKenism Economic Simulation - Week 12"
   * ```
   */
  exportWeekCGP(week?: number): CGPDocument | null {
    if (!this.chitEnabled || !this.cgpGenerator || !this.shapeAttribution) {
      console.warn('[ContractCoordinator] CHIT not enabled, cannot export CGP');
      return null;
    }

    const targetWeek = week ?? this.currentWeek;
    const weekData = this.weeklySimulationHistory.find(w => w.week === targetWeek);

    if (!weekData) {
      console.warn(`[ContractCoordinator] No data for week ${targetWeek}`);
      return null;
    }

    return this.cgpGenerator.generateWeeklyCGP(
      weekData,
      this.shapeAttribution,
      this.hyperbolicEncoder
    );
  }

  /**
   * Export full simulation as CGP document
   *
   * @example
   * ```typescript
   * const cgp = coordinator.exportSimulationCGP();
   * console.log(cgp.meta.week_range); // [1, 52]
   * ```
   */
  exportSimulationCGP(): CGPDocument | null {
    if (!this.chitEnabled || !this.cgpGenerator || !this.shapeAttribution) {
      console.warn('[ContractCoordinator] CHIT not enabled, cannot export CGP');
      return null;
    }

    if (this.weeklySimulationHistory.length === 0) {
      console.warn('[ContractCoordinator] No simulation history to export');
      return null;
    }

    return this.cgpGenerator.generateSimulationCGP(
      this.weeklySimulationHistory,
      this.shapeAttribution,
      this.hyperbolicEncoder
    );
  }

  /**
   * Get swarm meta for current week
   *
   * @example
   * ```typescript
   * const meta = coordinator.getSwarmMeta();
   * console.log(meta.best_fitness); // 0.85
   * ```
   */
  getSwarmMeta(week?: number): SwarmMeta | null {
    if (!this.chitEnabled || !this.swarmAttribution) {
      console.warn('[ContractCoordinator] CHIT not enabled, cannot get swarm meta');
      return null;
    }

    const targetWeek = week ?? this.currentWeek;
    const weekData = this.weeklySimulationHistory.find(w => w.week === targetWeek);

    if (!weekData) {
      console.warn(`[ContractCoordinator] No data for week ${targetWeek}`);
      return null;
    }

    return this.swarmAttribution.createSwarmMeta(weekData);
  }

  /**
   * Get attribution records for an address
   */
  getAddressAttribution(address: string): ReturnType<ShapeAttribution['getAddressAttribution']> | null {
    if (!this.chitEnabled || !this.shapeAttribution) {
      return null;
    }
    return this.shapeAttribution.getAddressAttribution(address);
  }

  /**
   * Get attribution records for a week
   */
  getWeekAttribution(week: number): ReturnType<ShapeAttribution['getWeekAttribution']> | null {
    if (!this.chitEnabled || !this.shapeAttribution) {
      return null;
    }
    return this.shapeAttribution.getWeekAttribution(week);
  }

  /**
   * Get expected attribution weights
   */
  getExpectedAttribution(): ReturnType<ShapeAttribution['getExpectedAttribution']> | null {
    if (!this.chitEnabled || !this.shapeAttribution) {
      return null;
    }
    return this.shapeAttribution.getExpectedAttribution();
  }

  /**
   * Get CHIT components for direct access
   */
  getCHITComponents(): {
    shapeAttribution: ShapeAttribution | undefined;
    cgpGenerator: CGPGenerator | undefined;
    swarmAttribution: SwarmAttribution | undefined;
    hyperbolicEncoder: HyperbolicEncoder | undefined;
  } {
    return {
      shapeAttribution: this.shapeAttribution,
      cgpGenerator: this.cgpGenerator,
      swarmAttribution: this.swarmAttribution,
      hyperbolicEncoder: this.hyperbolicEncoder,
    };
  }

  /**
   * Get weekly simulation history for CHIT
   */
  getWeeklySimulationHistory(): CHITWeeklySimulationData[] {
    return [...this.weeklySimulationHistory];
  }

  /**
   * Validate and export CGP with errors
   */
  validateAndExportCGP(week?: number): {
    cgp: CGPDocument | null;
    valid: boolean;
    errors: string[];
  } {
    const cgp = this.exportWeekCGP(week);
    if (!cgp || !this.cgpGenerator) {
      return { cgp: null, valid: false, errors: ['CGP generation failed'] };
    }

    const validation = this.cgpGenerator.validateCGP(cgp);
    return {
      cgp,
      valid: validation.valid,
      errors: validation.errors,
    };
  }
}

export default ContractCoordinator;
