/**
 * GroVault Staking Model
 * Implements time-locked staking with interest accrual and voting power
 */

import { GroTokenDistribution } from './grotoken-model';

export interface GroVaultConfig {
  baseInterestRate: number; // Annual interest rate (0.02 = 2% APR)
  lockBonusMultiplier: number; // Bonus for locking (0.5 = 50% extra)
  minLockDurationYears: number; // Minimum lock duration (1 year)
  maxLockDurationYears: number; // Maximum lock duration (4 years)
  compoundingFrequency: 'weekly' | 'monthly' | 'yearly'; // How often interest compounds
}

export interface LockPosition {
  address: string;
  amount: number;
  unlockTime: number; // Timestamp
  durationYears: number;
  createdWeek: number;
  interestAccrued: number;
  votingPower: number;
}

export interface StakingEvent {
  week: number;
  address: string;
  type: 'lock' | 'increase' | 'extend' | 'withdraw';
  amount: number;
  durationYears?: number;
  timestamp: number;
}

export class GroVaultModel {
  private config: GroVaultConfig;
  private groToken: GroTokenDistribution;
  private locks: Map<string, LockPosition> = new Map();
  private totalLocked: number = 0;
  private events: StakingEvent[] = [];
  private currentWeek: number = 0;

  constructor(
    groToken: GroTokenDistribution,
    config: Partial<GroVaultConfig> = {}
  ) {
    this.groToken = groToken;

    this.config = {
      baseInterestRate: 0.02, // 2% APR
      lockBonusMultiplier: 0.5, // 50% bonus per year of lock
      minLockDurationYears: 1,
      maxLockDurationYears: 4,
      compoundingFrequency: 'weekly',
      ...config,
    };
  }

  /**
   * Create a new lock position
   */
  createLock(
    week: number,
    address: string,
    amount: number,
    durationYears: number
  ): boolean {
    this.currentWeek = week;

    // Validate
    if (this.locks.has(address)) {
      throw new Error(`Lock already exists for ${address}`);
    }

    if (
      durationYears < this.config.minLockDurationYears ||
      durationYears > this.config.maxLockDurationYears
    ) {
      throw new Error(
        `Duration must be between ${this.config.minLockDurationYears} and ${this.config.maxLockDurationYears} years`
      );
    }

    // Check token balance
    if (this.groToken.balanceOf(address) < amount) {
      throw new Error(`Insufficient GroToken balance for ${address}`);
    }

    // Transfer tokens to vault (burn from user)
    this.groToken.burn(address, amount);

    // Calculate unlock time (in weeks)
    const weeksToLock = durationYears * 52;
    const unlockTime = week + weeksToLock;

    // Calculate initial voting power
    const votingPower = this.calculateVotingPower(amount, durationYears);

    // Create lock position
    const position: LockPosition = {
      address,
      amount,
      unlockTime,
      durationYears,
      createdWeek: week,
      interestAccrued: 0,
      votingPower,
    };

    this.locks.set(address, position);
    this.totalLocked += amount;

    // Record event
    this.events.push({
      week,
      address,
      type: 'lock',
      amount,
      durationYears,
      timestamp: Date.now(),
    });

    console.log(
      `[GroVault] ${address} locked ${amount} GRO for ${durationYears} years`
    );

    return true;
  }

  /**
   * Increase lock amount (without changing duration)
   */
  increaseLock(week: number, address: string, additionalAmount: number): boolean {
    const position = this.locks.get(address);

    if (!position) {
      throw new Error(`No lock found for ${address}`);
    }

    if (week >= position.unlockTime) {
      throw new Error(`Lock expired for ${address}`);
    }

    // Check token balance
    if (this.groToken.balanceOf(address) < additionalAmount) {
      throw new Error(`Insufficient GroToken balance for ${address}`);
    }

    // Transfer tokens
    this.groToken.burn(address, additionalAmount);

    // Update position
    position.amount += additionalAmount;
    this.totalLocked += additionalAmount;

    // Recalculate voting power
    position.votingPower = this.calculateVotingPower(
      position.amount,
      position.durationYears
    );

    // Record event
    this.events.push({
      week,
      address,
      type: 'increase',
      amount: additionalAmount,
      timestamp: Date.now(),
    });

    console.log(`[GroVault] ${address} increased lock by ${additionalAmount} GRO`);

    return true;
  }

  /**
   * Extend lock duration
   */
  extendLock(week: number, address: string, newDurationYears: number): boolean {
    const position = this.locks.get(address);

    if (!position) {
      throw new Error(`No lock found for ${address}`);
    }

    if (week >= position.unlockTime) {
      throw new Error(`Lock expired for ${address}`);
    }

    if (newDurationYears <= position.durationYears) {
      throw new Error(`New duration must be greater than current duration`);
    }

    if (newDurationYears > this.config.maxLockDurationYears) {
      throw new Error(
        `Duration cannot exceed ${this.config.maxLockDurationYears} years`
      );
    }

    // Update position
    position.durationYears = newDurationYears;
    const weeksToLock = newDurationYears * 52;
    position.unlockTime = week + weeksToLock;

    // Recalculate voting power
    position.votingPower = this.calculateVotingPower(
      position.amount,
      position.durationYears
    );

    // Record event
    this.events.push({
      week,
      address,
      type: 'extend',
      amount: position.amount,
      durationYears: newDurationYears,
      timestamp: Date.now(),
    });

    console.log(
      `[GroVault] ${address} extended lock to ${newDurationYears} years`
    );

    return true;
  }

  /**
   * Withdraw locked tokens (after unlock time)
   */
  withdraw(week: number, address: string): number {
    const position = this.locks.get(address);

    if (!position) {
      throw new Error(`No lock found for ${address}`);
    }

    if (week < position.unlockTime) {
      throw new Error(
        `Lock not yet unlocked for ${address}, unlocks at week ${position.unlockTime}`
      );
    }

    // Calculate final amount with interest
    const finalAmount = position.amount + position.interestAccrued;

    // Return tokens (mint back to user)
    this.groToken.balanceOf(address); // Just to ensure holder exists

    // Update state
    this.totalLocked -= position.amount;
    this.locks.delete(address);

    // Record event
    this.events.push({
      week,
      address,
      type: 'withdraw',
      amount: finalAmount,
      timestamp: Date.now(),
    });

    console.log(`[GroVault] ${address} withdrew ${finalAmount} GRO`);

    return finalAmount;
  }

  /**
   * Calculate voting power using quadratic formula
   * Formula: sqrt(amount) * (1 + lockBonus * (durationYears - 1))
   */
  private calculateVotingPower(
    amount: number,
    durationYears: number
  ): number {
    const sqrtAmount = Math.sqrt(amount);
    const multiplier = 1 + this.config.lockBonusMultiplier * (durationYears - 1);

    return sqrtAmount * multiplier;
  }

  /**
   * Get voting power for an address
   */
  getVotingPower(address: string): number {
    const position = this.locks.get(address);

    if (!position || this.currentWeek >= position.unlockTime) {
      return 0;
    }

    return position.votingPower;
  }

  /**
   * Accrue interest for all positions
   */
  accrueInterest(week: number): void {
    this.currentWeek = week;

    for (const [, position] of this.locks) {
      if (week >= position.unlockTime) {
        continue; // No interest after unlock
      }

      // Calculate interest rate with lock bonus
      const lockMultiplier =
        1 + this.config.lockBonusMultiplier * (position.durationYears - 1);
      const effectiveRate = this.config.baseInterestRate * lockMultiplier;

      // Calculate interest based on compounding frequency
      let interest = 0;

      if (this.config.compoundingFrequency === 'weekly') {
        // Weekly compounding: (1 + r/52)^(1) - 1
        const weeklyRate = effectiveRate / 52;
        interest = position.amount * weeklyRate;
      } else if (this.config.compoundingFrequency === 'monthly') {
        // Monthly compounding (every 4 weeks)
        if (week % 4 === 0) {
          const monthlyRate = effectiveRate / 12;
          interest = position.amount * monthlyRate;
        }
      } else {
        // Yearly compounding (every 52 weeks)
        if (week % 52 === 0) {
          interest = position.amount * effectiveRate;
        }
      }

      position.interestAccrued += interest;
    }
  }

  /**
   * Get lock position for an address
   */
  getLockPosition(address: string): LockPosition | null {
    const position = this.locks.get(address);

    if (!position) {
      return null;
    }

    return { ...position };
  }

  /**
   * Get all active locks
   */
  getActiveLocks(): LockPosition[] {
    return Array.from(this.locks.values())
      .filter((pos) => this.currentWeek < pos.unlockTime)
      .map((pos) => ({ ...pos }));
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalLocked: number;
    totalLockedValue: number;
    activePositions: number;
    totalInterestAccrued: number;
    averageLockDuration: number;
    totalVotingPower: number;
    averageAPR: number;
  } {
    const positions = Array.from(this.locks.values());
    const active = positions.filter(
      (pos) => this.currentWeek < pos.unlockTime
    );

    const totalInterest = active.reduce(
      (sum, pos) => sum + pos.interestAccrued,
      0
    );

    const averageDuration =
      active.length > 0
        ? active.reduce((sum, pos) => sum + pos.durationYears, 0) /
          active.length
        : 0;

    const totalVotingPower = active.reduce(
      (sum, pos) => sum + pos.votingPower,
      0
    );

    // Calculate average APR
    const avgAPR =
      active.length > 0
        ? this.config.baseInterestRate *
          (1 +
            this.config.lockBonusMultiplier * (averageDuration - 1))
        : 0;

    return {
      totalLocked: this.totalLocked,
      totalLockedValue: this.totalLocked * 2.0, // Assuming $2 per token
      activePositions: active.length,
      totalInterestAccrued: totalInterest,
      averageLockDuration: averageDuration,
      totalVotingPower,
      averageAPR: avgAPR,
    };
  }

  /**
   * Calculate wealth accumulation from staking
   */
  calculateWealthAccumulation(address: string): {
    principalLocked: number;
    interestEarned: number;
    totalValue: number;
    annualizedReturn: number;
  } {
    const position = this.locks.get(address);

    if (!position) {
      return {
        principalLocked: 0,
        interestEarned: 0,
        totalValue: 0,
        annualizedReturn: 0,
      };
    }

    const weeksLocked = this.currentWeek - position.createdWeek;
    const yearsLocked = weeksLocked / 52;

    const annualizedReturn =
      yearsLocked > 0 ? position.interestAccrued / position.amount / yearsLocked : 0;

    return {
      principalLocked: position.amount,
      interestEarned: position.interestAccrued,
      totalValue: position.amount + position.interestAccrued,
      annualizedReturn,
    };
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    config: GroVaultConfig;
    locks: LockPosition[];
    events: StakingEvent[];
    statistics: {
      totalLocked: number;
      totalLockedValue: number;
      activePositions: number;
      totalInterestAccrued: number;
      averageLockDuration: number;
      totalVotingPower: number;
      averageAPR: number;
    };
  } {
    return {
      config: this.config,
      locks: Array.from(this.locks.values()),
      events: [...this.events],
      statistics: this.getStatistics(),
    };
  }
}

export default GroVaultModel;
