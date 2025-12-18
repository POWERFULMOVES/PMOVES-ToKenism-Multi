/**
 * RewardsPool Model
 * Distributes ecosystem fees back to active participants based on staking
 */

import { GroVaultModel } from './grovault-model';

export interface RewardsPoolConfig {
  /** Fee percentage collected from transactions (0.001 = 0.1%) */
  feePercentage: number;
  /** Number of weeks between reward distributions */
  distributionFrequency: number;
  /** Bonus multiplier for stakers (e.g., 1.5 = 50% boost) */
  stakingBoostMultiplier: number;
  /** Minimum stake required to receive rewards */
  minStakeForRewards: number;
  /** Treasury address for unclaimed rewards */
  treasuryAddress: string;
}

export interface RewardsClaim {
  address: string;
  epoch: number;
  amount: number;
  boostApplied: number;
  stakeAmount: number;
  timestamp: number;
}

export interface RewardsPoolStats {
  totalFeesCollected: number;
  totalDistributed: number;
  totalClaimants: number;
  currentEpoch: number;
  pendingDistribution: number;
  averageRewardPerClaimant: number;
  treasuryBalance: number;
}

export interface RewardsEvent {
  week: number;
  eventType: 'fee_collected' | 'distribution' | 'claim';
  amount: number;
  address?: string;
  epoch?: number;
}

export class RewardsPoolModel {
  private config: RewardsPoolConfig;
  private feeBalance: number = 0;
  private totalFeesCollected: number = 0;
  private totalDistributed: number = 0;
  private treasuryBalance: number = 0;
  private claims: RewardsClaim[] = [];
  private events: RewardsEvent[] = [];
  private currentEpoch: number = 0;
  private currentWeek: number = 0;
  private claimants: Set<string> = new Set();

  constructor(
    private groVault: GroVaultModel,
    config: Partial<RewardsPoolConfig> = {}
  ) {
    this.config = {
      feePercentage: 0.001, // 0.1%
      distributionFrequency: 4, // Every 4 weeks
      stakingBoostMultiplier: 1.5, // 50% boost for stakers
      minStakeForRewards: 1.0, // Minimum 1 GRO staked
      treasuryAddress: '0xREWARDS_TREASURY',
      ...config,
    };
  }

  /**
   * Collect fee from a transaction
   */
  collectFee(transactionAmount: number, week: number): number {
    this.currentWeek = week;
    const fee = transactionAmount * this.config.feePercentage;

    this.feeBalance += fee;
    this.totalFeesCollected += fee;

    this.events.push({
      week,
      eventType: 'fee_collected',
      amount: fee,
    });

    return fee;
  }

  /**
   * Distribute rewards to eligible stakers
   * Called periodically based on distributionFrequency
   */
  distributeRewards(week: number): RewardsClaim[] {
    this.currentWeek = week;

    // Check if it's distribution time
    if (week % this.config.distributionFrequency !== 0) {
      return [];
    }

    // Get all active locks from GroVault
    const activeLocks = this.groVault.getActiveLocks();

    // Filter eligible stakers (minimum stake requirement)
    const eligibleStakers = activeLocks.filter(
      lock => lock.amount >= this.config.minStakeForRewards
    );

    if (eligibleStakers.length === 0) {
      // No eligible stakers - move to treasury
      this.treasuryBalance += this.feeBalance;
      this.feeBalance = 0;
      return [];
    }

    // Calculate total stake and weighted shares
    const totalStake = eligibleStakers.reduce((sum, lock) => sum + lock.amount, 0);

    // Distribute proportionally based on stake
    const distributionAmount = this.feeBalance;
    const claims: RewardsClaim[] = [];

    this.currentEpoch++;

    for (const lock of eligibleStakers) {
      const stakeShare = lock.amount / totalStake;
      const votingPower = this.groVault.getVotingPower(lock.address);

      // Apply staking boost based on voting power
      const baseReward = distributionAmount * stakeShare;
      const boost = votingPower > 0
        ? Math.min(this.config.stakingBoostMultiplier, 1 + (votingPower / 10))
        : 1.0;
      const finalReward = baseReward * boost;

      const claim: RewardsClaim = {
        address: lock.address,
        epoch: this.currentEpoch,
        amount: finalReward,
        boostApplied: boost,
        stakeAmount: lock.amount,
        timestamp: Date.now(),
      };

      claims.push(claim);
      this.claims.push(claim);
      this.claimants.add(lock.address);
    }

    // Update totals
    const actualDistributed = claims.reduce((sum, c) => sum + c.amount, 0);
    this.totalDistributed += actualDistributed;
    this.feeBalance = 0; // Reset for next epoch

    this.events.push({
      week,
      eventType: 'distribution',
      amount: actualDistributed,
      epoch: this.currentEpoch,
    });

    console.log(
      `[RewardsPool] Epoch ${this.currentEpoch}: Distributed $${actualDistributed.toFixed(2)} to ${claims.length} stakers`
    );

    return claims;
  }

  /**
   * Get rewards claimed by a specific address
   */
  getClaimsForAddress(address: string): RewardsClaim[] {
    return this.claims.filter(c => c.address === address);
  }

  /**
   * Get total rewards earned by an address
   */
  getTotalRewardsForAddress(address: string): number {
    return this.getClaimsForAddress(address)
      .reduce((sum, c) => sum + c.amount, 0);
  }

  /**
   * Get pending distribution amount
   */
  getPendingDistribution(): number {
    return this.feeBalance;
  }

  /**
   * Get current epoch number
   */
  getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Get current week number
   */
  getCurrentWeek(): number {
    return this.currentWeek;
  }

  /**
   * Get statistics for the rewards pool
   */
  getStatistics(): RewardsPoolStats {
    return {
      totalFeesCollected: this.totalFeesCollected,
      totalDistributed: this.totalDistributed,
      totalClaimants: this.claimants.size,
      currentEpoch: this.currentEpoch,
      pendingDistribution: this.feeBalance,
      averageRewardPerClaimant: this.claimants.size > 0
        ? this.totalDistributed / this.claimants.size
        : 0,
      treasuryBalance: this.treasuryBalance,
    };
  }

  /**
   * Get all events history
   */
  getEvents(): RewardsEvent[] {
    return [...this.events];
  }

  /**
   * Get all claims history
   */
  getClaims(): RewardsClaim[] {
    return [...this.claims];
  }

  /**
   * Export pool data for analysis
   */
  exportData(): {
    config: RewardsPoolConfig;
    statistics: RewardsPoolStats;
    claims: RewardsClaim[];
    events: RewardsEvent[];
  } {
    return {
      config: { ...this.config },
      statistics: this.getStatistics(),
      claims: this.getClaims(),
      events: this.getEvents(),
    };
  }
}
