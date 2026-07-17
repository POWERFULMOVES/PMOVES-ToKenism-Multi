/**
 * GroToken Distribution Model
 * Implements token distribution with Gaussian distribution as per simulation requirements
 */

export interface GroTokenConfig {
  // Distribution parameters
  distributionMean: number; // Mean tokens per week (0.5 default)
  distributionStd: number; // Standard deviation (0.2 default)
  tokenValue: number; // USD value per token ($2.00 default)
  participationRate: number; // % of population receiving tokens (0.20 = 20% default)

  // Distribution rules
  minTokensPerDistribution: number;
  maxTokensPerDistribution: number;

  // Treasury
  totalSupply: number;
  treasuryAddress: string;

  // Policy variable (open decision #4): when true, earned GroToken is
  // soul-bound — non-transferable — to satisfy the non-transferable-reputation
  // boundary ($WORK direction). Default false (transferable). Left OPEN to test.
  soulbound: boolean;
}

export interface TokenHolder {
  address: string;
  balance: number;
  totalReceived: number;
  lastDistributionWeek: number;
  participates: boolean;
}

export interface DistributionEvent {
  week: number;
  recipient: string;
  amount: number;
  dollarValue: number;
  totalSupplyAfter: number;
}

export class GroTokenDistribution {
  private config: GroTokenConfig;
  private holders: Map<string, TokenHolder> = new Map();
  private distributionHistory: DistributionEvent[] = [];
  private currentSupply: number = 0;

  constructor(config: Partial<GroTokenConfig> = {}) {
    this.config = {
      distributionMean: 0.5,
      distributionStd: 0.2,
      tokenValue: 2.0,
      participationRate: 0.20,
      minTokensPerDistribution: 0.1,
      maxTokensPerDistribution: 2.0,
      totalSupply: 1000000, // 1M tokens max supply
      treasuryAddress: '0xTREASURY',
      soulbound: false,
      ...config,
    };
  }

  /**
   * Initialize token holders
   */
  initializeHolders(addresses: string[]): void {
    // Randomly select participants based on participation rate
    const numParticipants = Math.floor(
      addresses.length * this.config.participationRate
    );

    // Shuffle and select participants
    const shuffled = [...addresses].sort(() => Math.random() - 0.5);
    const participants = new Set(shuffled.slice(0, numParticipants));

    for (const address of addresses) {
      this.holders.set(address, {
        address,
        balance: 0,
        totalReceived: 0,
        lastDistributionWeek: 0,
        participates: participants.has(address),
      });
    }

    console.log(
      `[GroToken] Initialized ${addresses.length} holders, ${numParticipants} participants`
    );
  }

  /**
   * Generate random token amount using Gaussian distribution
   */
  private generateTokenAmount(): number {
    // Box-Muller transform for Gaussian distribution
    const u1 = Math.random();
    const u2 = Math.random();

    const z0 =
      Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Scale and shift
    let amount =
      z0 * this.config.distributionStd + this.config.distributionMean;

    // Clamp to min/max
    amount = Math.max(this.config.minTokensPerDistribution, amount);
    amount = Math.min(this.config.maxTokensPerDistribution, amount);

    return Math.round(amount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Distribute tokens for a given week
   */
  distributeWeekly(week: number): DistributionEvent[] {
    const events: DistributionEvent[] = [];

    for (const [address, holder] of this.holders) {
      if (!holder.participates) continue;

      // Generate token amount
      const amount = this.generateTokenAmount();

      // Check supply constraint
      if (this.currentSupply + amount > this.config.totalSupply) {
        console.warn(
          `[GroToken] Max supply reached, skipping distribution for ${address}`
        );
        continue;
      }

      // Mint tokens (simulate contract mint)
      holder.balance += amount;
      holder.totalReceived += amount;
      holder.lastDistributionWeek = week;
      this.currentSupply += amount;

      const event: DistributionEvent = {
        week,
        recipient: address,
        amount,
        dollarValue: amount * this.config.tokenValue,
        totalSupplyAfter: this.currentSupply,
      };

      events.push(event);
      this.distributionHistory.push(event);
    }

    return events;
  }

  /**
   * Distribute a weekly token pool proportionally to Dirichlet attribution
   * weight (token-structure refresh). Tokens track real recorded contribution
   * rather than a Gaussian random draw, so distribution is deterministic and
   * auditable. See docs/architecture/TOKEN_STRUCTURE_REFRESH.md §4.3.
   */
  distributeByAttribution(
    attribution: Array<{ address: string; weight: number }>,
    weeklyPool: number,
    week: number
  ): DistributionEvent[] {
    // Contract: `attribution` is a SINGLE normalized distribution (Σweight ≈ 1),
    // e.g. DirichletWeights.getExpectedAttribution(category) for ONE category.
    // A concatenation of N categories (each summing to 1) would mint N× the pool,
    // so reject anything that is not normalized rather than over-mint silently.
    const totalWeight = attribution.reduce((sum, a) => sum + a.weight, 0);
    if (Math.abs(totalWeight - 1) > 1e-6) {
      throw new Error(
        `distributeByAttribution expects a single normalized attribution ` +
          `(Σweight ≈ 1); got ${totalWeight}. Pass one category's weights.`
      );
    }

    const events: DistributionEvent[] = [];
    for (const { address, weight } of attribution) {
      const holder = this.holders.get(address);
      if (!holder) {
        // Only initialized holders can be credited. Never inflate supply for an
        // unknown address — that would mint tokens no balance ever receives and
        // break the currentSupply === Σ(holder.balance) invariant.
        console.warn(
          `[GroToken] attribution address ${address} is not a holder — skipping`
        );
        continue;
      }

      const amount = weight * weeklyPool;

      // Respect max supply (same constraint as distributeWeekly).
      if (this.currentSupply + amount > this.config.totalSupply) {
        console.warn(
          `[GroToken] Max supply reached, skipping attribution mint for ${address}`
        );
        continue;
      }

      holder.balance += amount;
      holder.totalReceived += amount;
      holder.lastDistributionWeek = week;
      this.currentSupply += amount;

      const event: DistributionEvent = {
        week,
        recipient: address,
        amount,
        dollarValue: amount * this.config.tokenValue,
        totalSupplyAfter: this.currentSupply,
      };
      events.push(event);
      this.distributionHistory.push(event);
    }
    return events;
  }

  /**
   * Transfer tokens between holders
   */
  transfer(from: string, to: string, amount: number): boolean {
    // Policy variable: under a soul-bound policy GroToken is non-transferable
    // (earned reputation, not a tradeable asset — the $WORK direction).
    if (this.config.soulbound) {
      throw new Error('GroToken is soulbound (non-transferable) under current policy');
    }

    const fromHolder = this.holders.get(from);
    const toHolder = this.holders.get(to);

    if (!fromHolder || !toHolder) {
      throw new Error('Invalid holder address');
    }

    if (fromHolder.balance < amount) {
      throw new Error('Insufficient balance');
    }

    fromHolder.balance -= amount;
    toHolder.balance += amount;

    return true;
  }

  /**
   * Burn tokens (reduce supply)
   */
  burn(holder: string, amount: number): boolean {
    const holderData = this.holders.get(holder);

    if (!holderData || holderData.balance < amount) {
      return false;
    }

    holderData.balance -= amount;
    this.currentSupply -= amount;

    return true;
  }

  /**
   * Get total supply of tokens
   */
  totalSupply(): number {
    return this.currentSupply;
  }

  /**
   * Get token balance for a holder
   */
  balanceOf(holder: string): number {
    return this.holders.get(holder)?.balance || 0;
  }

  /**
   * Get all token holders
   */
  getHolders(): TokenHolder[] {
    return Array.from(this.holders.values());
  }

  /**
   * Get distribution statistics
   */
  getStatistics(): {
    totalSupply: number;
    totalDistributed: number;
    totalHolders: number;
    activeParticipants: number;
    averageBalance: number;
    totalValue: number;
    distributionEvents: number;
  } {
    const holders = Array.from(this.holders.values());
    const participants = holders.filter((h) => h.participates);
    const totalBalances = holders.reduce((sum, h) => sum + h.balance, 0);

    return {
      totalSupply: this.currentSupply,
      totalDistributed: this.distributionHistory.reduce(
        (sum, e) => sum + e.amount,
        0
      ),
      totalHolders: holders.length,
      activeParticipants: participants.length,
      averageBalance: totalBalances / holders.length,
      totalValue: totalBalances * this.config.tokenValue,
      distributionEvents: this.distributionHistory.length,
    };
  }

  /**
   * Get distribution history
   */
  getDistributionHistory(): DistributionEvent[] {
    return [...this.distributionHistory];
  }

  /**
   * Calculate wealth impact of token distribution
   */
  calculateWealthImpact(holderAddress: string): {
    tokenBalance: number;
    balance: number;
    dollarValue: number;
    totalReceived: number;
    totalReceivedValue: number;
    weeksParticipated: number;
  } {
    const holder = this.holders.get(holderAddress);

    if (!holder) {
      throw new Error('Holder not found');
    }

    return {
      tokenBalance: holder.balance,
      balance: holder.balance,
      dollarValue: holder.balance * this.config.tokenValue,
      totalReceived: holder.totalReceived,
      totalReceivedValue: holder.totalReceived * this.config.tokenValue,
      weeksParticipated: holder.lastDistributionWeek,
    };
  }

  /**
   * Export distribution data for analysis
   */
  exportData(): {
    config: GroTokenConfig;
    totalSupply: number;
    holders: TokenHolder[];
    history: DistributionEvent[];
    statistics: {
      totalSupply: number;
      totalDistributed: number;
      totalHolders: number;
      activeParticipants: number;
      averageBalance: number;
      totalValue: number;
      distributionEvents: number;
    };
  } {
    return {
      config: this.config,
      totalSupply: this.currentSupply,
      holders: this.getHolders(),
      history: this.getDistributionHistory(),
      statistics: this.getStatistics(),
    };
  }
}

export default GroTokenDistribution;
