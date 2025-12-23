/**
 * LoyaltyPoints Model
 * Time-weighted loyalty rewards system with streaks and decay
 */

export interface LoyaltyConfig {
  /** Points earned per dollar spent (e.g., 0.1 = 1 point per $10) */
  pointsPerDollar: number;
  /** Bonus multiplier per consecutive week of activity */
  streakBonusMultiplier: number;
  /** Maximum streak bonus cap */
  maxStreakBonus: number;
  /** Decay rate per week of inactivity (e.g., 0.05 = 5%) */
  decayRatePerWeek: number;
  /** Redemption rate (points per GRO token) */
  redemptionRate: number;
  /** Minimum points required for redemption */
  minRedemptionPoints: number;
}

export interface LoyaltyAccount {
  address: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityWeek: number;
  totalEarned: number;
  totalRedeemed: number;
  totalDecayed: number;
}

export interface LoyaltyEvent {
  week: number;
  address: string;
  eventType: 'earn' | 'redeem' | 'decay' | 'streak_bonus';
  points: number;
  details?: string;
}

export interface LoyaltyStats {
  totalPointsInCirculation: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  totalPointsDecayed: number;
  totalAccounts: number;
  activeAccounts: number;
  averageStreak: number;
  longestStreak: number;
}

export class LoyaltyPointsModel {
  private config: LoyaltyConfig;
  private accounts: Map<string, LoyaltyAccount> = new Map();
  private events: LoyaltyEvent[] = [];
  private currentWeek: number = 0;

  constructor(config: Partial<LoyaltyConfig> = {}) {
    this.config = {
      pointsPerDollar: 0.1, // 1 point per $10 spent
      streakBonusMultiplier: 0.1, // 10% per week streak
      maxStreakBonus: 1.0, // Max 100% bonus (2x points)
      decayRatePerWeek: 0.05, // 5% decay per inactive week
      redemptionRate: 100, // 100 points = 1 GRO
      minRedemptionPoints: 50, // Minimum 50 points to redeem
      ...config,
    };
  }

  /**
   * Initialize accounts for addresses
   */
  initializeAccounts(addresses: string[]): void {
    for (const address of addresses) {
      if (!this.accounts.has(address)) {
        this.accounts.set(address, {
          address,
          totalPoints: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityWeek: 0,
          totalEarned: 0,
          totalRedeemed: 0,
          totalDecayed: 0,
        });
      }
    }
  }

  /**
   * Earn points from spending
   */
  earnPoints(address: string, spendingAmount: number, week: number): number {
    this.currentWeek = week;

    let account = this.accounts.get(address);
    if (!account) {
      account = {
        address,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityWeek: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        totalDecayed: 0,
      };
      this.accounts.set(address, account);
    }

    // Calculate base points
    const basePoints = spendingAmount * this.config.pointsPerDollar;

    // Calculate streak bonus
    let streakBonus = 1.0;
    if (account.lastActivityWeek > 0 && account.lastActivityWeek === week - 1) {
      // Consecutive week - increment streak
      account.currentStreak++;
      const rawBonus = account.currentStreak * this.config.streakBonusMultiplier;
      streakBonus = 1 + Math.min(rawBonus, this.config.maxStreakBonus);
    } else if (account.lastActivityWeek === 0 || account.lastActivityWeek < week - 1) {
      // First activity or gap in activity - reset/start streak
      account.currentStreak = 1;
    }

    // Update longest streak
    if (account.currentStreak > account.longestStreak) {
      account.longestStreak = account.currentStreak;
    }

    // Calculate final points with bonus
    const pointsEarned = basePoints * streakBonus;

    // Update account
    account.totalPoints += pointsEarned;
    account.totalEarned += pointsEarned;
    account.lastActivityWeek = week;

    // Record event
    this.events.push({
      week,
      address,
      eventType: 'earn',
      points: pointsEarned,
      details: `Base: ${basePoints.toFixed(1)}, Streak bonus: ${((streakBonus - 1) * 100).toFixed(0)}%`,
    });

    // Record streak bonus event if applicable
    if (streakBonus > 1) {
      this.events.push({
        week,
        address,
        eventType: 'streak_bonus',
        points: pointsEarned - basePoints,
        details: `Streak: ${account.currentStreak} weeks`,
      });
    }

    return pointsEarned;
  }

  /**
   * Apply decay to inactive accounts
   * Should be called at the end of each week
   */
  applyDecay(week: number): void {
    this.currentWeek = week;

    for (const [address, account] of this.accounts) {
      // Skip if active this week
      if (account.lastActivityWeek === week) {
        continue;
      }

      // Calculate weeks inactive
      const weeksInactive = week - account.lastActivityWeek;

      if (weeksInactive > 0 && account.totalPoints > 0) {
        // Apply compound decay
        const decayMultiplier = Math.pow(1 - this.config.decayRatePerWeek, weeksInactive);
        const pointsBeforeDecay = account.totalPoints;
        account.totalPoints *= decayMultiplier;
        const pointsDecayed = pointsBeforeDecay - account.totalPoints;

        if (pointsDecayed > 0.01) { // Only record significant decay
          account.totalDecayed += pointsDecayed;

          this.events.push({
            week,
            address,
            eventType: 'decay',
            points: -pointsDecayed,
            details: `${weeksInactive} weeks inactive, ${(this.config.decayRatePerWeek * 100).toFixed(1)}% decay/week`,
          });
        }
      }

      // Reset streak if inactive for more than 1 week
      if (weeksInactive > 1) {
        account.currentStreak = 0;
      }
    }
  }

  /**
   * Redeem points for rewards (returns GRO amount)
   */
  redeemPoints(address: string, pointsToRedeem: number, week: number): number {
    this.currentWeek = week;

    const account = this.accounts.get(address);
    if (!account) {
      throw new Error(`Account not found: ${address}`);
    }

    if (pointsToRedeem < this.config.minRedemptionPoints) {
      throw new Error(`Minimum redemption is ${this.config.minRedemptionPoints} points`);
    }

    if (pointsToRedeem > account.totalPoints) {
      throw new Error(`Insufficient points: ${account.totalPoints.toFixed(2)} available`);
    }

    // Calculate GRO reward
    const groReward = pointsToRedeem / this.config.redemptionRate;

    // Update account
    account.totalPoints -= pointsToRedeem;
    account.totalRedeemed += pointsToRedeem;

    // Record event
    this.events.push({
      week,
      address,
      eventType: 'redeem',
      points: -pointsToRedeem,
      details: `Redeemed for ${groReward.toFixed(4)} GRO`,
    });

    console.log(
      `[Loyalty] ${address} redeemed ${pointsToRedeem} points for ${groReward.toFixed(4)} GRO`
    );

    return groReward;
  }

  /**
   * Get account details
   */
  getAccount(address: string): LoyaltyAccount | null {
    return this.accounts.get(address) || null;
  }

  /**
   * Get points balance for an address
   */
  getPointsBalance(address: string): number {
    return this.accounts.get(address)?.totalPoints || 0;
  }

  /**
   * Get current streak for an address
   */
  getCurrentStreak(address: string): number {
    return this.accounts.get(address)?.currentStreak || 0;
  }

  /**
   * Get current week number
   */
  getCurrentWeek(): number {
    return this.currentWeek;
  }

  /**
   * Get statistics
   */
  getStatistics(): LoyaltyStats {
    let totalPoints = 0;
    let totalEarned = 0;
    let totalRedeemed = 0;
    let totalDecayed = 0;
    let activeAccounts = 0;
    let totalStreak = 0;
    let longestStreak = 0;

    for (const account of this.accounts.values()) {
      totalPoints += account.totalPoints;
      totalEarned += account.totalEarned;
      totalRedeemed += account.totalRedeemed;
      totalDecayed += account.totalDecayed;

      if (account.currentStreak > 0) {
        activeAccounts++;
        totalStreak += account.currentStreak;
      }

      if (account.longestStreak > longestStreak) {
        longestStreak = account.longestStreak;
      }
    }

    return {
      totalPointsInCirculation: totalPoints,
      totalPointsEarned: totalEarned,
      totalPointsRedeemed: totalRedeemed,
      totalPointsDecayed: totalDecayed,
      totalAccounts: this.accounts.size,
      activeAccounts,
      averageStreak: activeAccounts > 0 ? totalStreak / activeAccounts : 0,
      longestStreak,
    };
  }

  /**
   * Get events for an address
   */
  getEventsForAddress(address: string): LoyaltyEvent[] {
    return this.events.filter(e => e.address === address);
  }

  /**
   * Get all events
   */
  getEvents(): LoyaltyEvent[] {
    return [...this.events];
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    config: LoyaltyConfig;
    statistics: LoyaltyStats;
    accounts: LoyaltyAccount[];
    events: LoyaltyEvent[];
  } {
    return {
      config: { ...this.config },
      statistics: this.getStatistics(),
      accounts: Array.from(this.accounts.values()),
      events: this.getEvents(),
    };
  }
}
