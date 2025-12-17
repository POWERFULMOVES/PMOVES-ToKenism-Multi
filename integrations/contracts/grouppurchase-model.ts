/**
 * GroupPurchase Model
 * Implements cooperative bulk buying with 15% savings mechanism
 */

import { FoodUSDModel } from './foodusd-model';

export interface GroupPurchaseConfig {
  savingsRate: number; // 0.15 = 15% savings
  minimumParticipants: number; // Minimum members to unlock savings
  orderDeadlineDays: number; // Days to collect contributions
  categories: string[]; // Food categories eligible for group buying
}

export interface GroupOrder {
  orderId: number;
  creator: string;
  supplier: string;
  targetAmount: number;
  totalContributed: number;
  deadline: number; // Timestamp
  executed: boolean;
  status: 'pending' | 'executed' | 'failed';
  participants: Map<string, number>; // address => contribution
  participantCount: number;
  category: string;
  week: number;
}

export interface Contribution {
  orderId: number;
  contributor: string;
  amount: number;
  week: number;
  timestamp: number;
}

export interface SavingsResult {
  orderId: number;
  executed: boolean;
  totalSpent: number;
  totalSaved: number;
  savingsAmount: number;
  finalCost: number;
  savingsRate: number;
  participantCount: number;
  perParticipantSavings: number;
}

export class GroupPurchaseModel {
  private config: GroupPurchaseConfig;
  private foodUSD: FoodUSDModel;
  private orders: Map<number, GroupOrder> = new Map();
  private nextOrderId: number = 1;
  private contributions: Contribution[] = [];
  private savingsHistory: SavingsResult[] = [];
  // private _currentWeek: number = 0;

  constructor(
    foodUSD: FoodUSDModel,
    config: Partial<GroupPurchaseConfig> = {}
  ) {
    this.foodUSD = foodUSD;

    this.config = {
      savingsRate: 0.15, // 15% savings from bulk buying
      minimumParticipants: 5,
      orderDeadlineDays: 7,
      categories: ['groceries', 'prepared_food', 'farmers_market'],
      ...config,
    };
  }

  /**
   * Create a new group purchase order
   */
  createOrder(
    week: number,
    creator: string,
    supplier: string,
    targetAmount: number,
    category: string
  ): number {
    // this._currentWeek = week;

    if (!this.config.categories.includes(category)) {
      throw new Error(
        `Category ${category} not eligible for group purchases`
      );
    }

    const orderId = this.nextOrderId++;
    const deadline = Date.now() + this.config.orderDeadlineDays * 86400000;

    const order: GroupOrder = {
      orderId,
      creator,
      supplier,
      targetAmount,
      totalContributed: 0,
      deadline,
      executed: false,
      status: 'pending',
      participants: new Map(),
      participantCount: 0,
      category,
      week,
    };

    this.orders.set(orderId, order);

    // console.log(
    //   `[GroupPurchase] Created order ${orderId} for ${category}, target: ${targetAmount}`
    // );

    return orderId;
  }

  /**
   * Contribute to a group purchase order
   */
  contribute(
    week: number,
    orderId: number,
    contributor: string,
    amount: number
  ): boolean {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.executed) {
      throw new Error(`Order ${orderId} already executed`);
    }

    if (Date.now() > order.deadline) {
      throw new Error(`Order ${orderId} deadline passed`);
    }

    // Check if contributor has enough FoodUSD
    if (this.foodUSD.balanceOf(contributor) < amount) {
      throw new Error(`Insufficient FoodUSD balance for ${contributor}`);
    }

    // Transfer FoodUSD to contract (simulate holding in escrow)
    this.foodUSD.transfer(contributor, '0xGROUPPURCHASE_CONTRACT', amount);

    // Update order
    const currentContribution = order.participants.get(contributor) || 0;
    order.participants.set(contributor, currentContribution + amount);
    order.totalContributed += amount;
    order.participantCount = order.participants.size;

    // Record contribution
    const contribution: Contribution = {
      orderId,
      contributor,
      amount,
      week,
      timestamp: Date.now(),
    };

    this.contributions.push(contribution);

    // console.log(
    //   `[GroupPurchase] ${contributor} contributed ${amount} to order ${orderId}`
    // );

    // Auto-execute if target met
    if (order.totalContributed >= order.targetAmount) {
      this.executeOrder(orderId);
    }

    return true;
  }

  /**
   * Execute a group purchase order
   */
  executeOrder(orderId: number): SavingsResult | null {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.executed) {
      throw new Error(`Order ${orderId} already executed`);
    }

    if (order.totalContributed < order.targetAmount) {
      throw new Error(`Order ${orderId} target not met`);
    }

    if (order.participants.size < this.config.minimumParticipants) {
      throw new Error(
        `Order ${orderId} needs ${this.config.minimumParticipants} participants, has ${order.participants.size}`
      );
    }

    // Mark as executed
    order.executed = true;
    order.status = 'executed';

    // Calculate savings
    const totalBeforeSavings = order.totalContributed;
    const savingsAmount = totalBeforeSavings * this.config.savingsRate;
    const totalAfterSavings = totalBeforeSavings - savingsAmount;

    // Transfer to supplier (after savings applied)
    this.foodUSD.transfer(
      '0xGROUPPURCHASE_CONTRACT',
      order.supplier,
      totalAfterSavings
    );

    // Return savings to participants proportionally
    for (const [participant, contribution] of order.participants) {
      const participantShare = contribution / order.totalContributed;
      const participantSavings = savingsAmount * participantShare;

      // Refund savings in FoodUSD
      this.foodUSD.mint(participant, participantSavings);
    }

    // Record savings result
    const savingsResult: SavingsResult = {
      orderId,
      executed: true,
      totalSpent: totalAfterSavings,
      totalSaved: savingsAmount,
      savingsAmount,
      finalCost: totalAfterSavings,
      savingsRate: this.config.savingsRate,
      participantCount: order.participants.size,
      perParticipantSavings: savingsAmount / order.participants.size,
    };

    this.savingsHistory.push(savingsResult);

    // console.log(
    //   `[GroupPurchase] Executed order ${orderId}, saved ${savingsAmount} (${
    //     this.config.savingsRate * 100
    //   }%)`
    // );

    return savingsResult;
  }

  /**
   * Claim refund if order failed (deadline passed, target not met)
   */
  claimRefund(orderId: number, participant: string): number {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.executed) {
      throw new Error(`Order ${orderId} already executed, cannot refund`);
    }

    if (Date.now() <= order.deadline) {
      throw new Error(`Order ${orderId} deadline not passed`);
    }

    const contribution = order.participants.get(participant);

    if (!contribution) {
      throw new Error(`No contribution found for ${participant}`);
    }

    // Refund FoodUSD
    this.foodUSD.transfer(
      '0xGROUPPURCHASE_CONTRACT',
      participant,
      contribution
    );

    // Remove participant
    order.participants.delete(participant);
    order.totalContributed -= contribution;

    // console.log(
    //   `[GroupPurchase] Refunded ${contribution} to ${participant} for order ${orderId}`
    // );

    return contribution;
  }

  /**
   * Get order details
   */
  getOrder(orderId: number): GroupOrder | null {
    const order = this.orders.get(orderId);

    if (!order) {
      return null;
    }

    return {
      ...order,
      participants: new Map(order.participants),
    };
  }

  /**
   * Get all active orders
   */
  getActiveOrders(): GroupOrder[] {
    return Array.from(this.orders.values())
      .filter((order) => !order.executed && Date.now() <= order.deadline)
      .map((order) => ({
        ...order,
        participants: new Map(order.participants),
      }));
  }

  /**
   * Get total savings for a participant
   */
  getParticipantSavings(participant: string): {
    totalContributed: number;
    totalSaved: number;
    ordersParticipated: number;
    averageSavingsRate: number;
  } {
    let totalContributed = 0;
    let totalSaved = 0;
    let ordersParticipated = 0;

    for (const order of this.orders.values()) {
      if (!order.executed) continue;

      const contribution = order.participants.get(participant);

      if (contribution) {
        ordersParticipated++;
        totalContributed += contribution;

        // Calculate this participant's share of savings
        const savingsResult = this.savingsHistory.find(
          (s) => s.orderId === order.orderId
        );

        if (savingsResult) {
          const participantShare = contribution / order.totalContributed;
          const participantSavings =
            savingsResult.totalSaved * participantShare;
          totalSaved += participantSavings;
        }
      }
    }

    return {
      totalContributed,
      totalSaved,
      ordersParticipated,
      averageSavingsRate:
        totalContributed > 0 ? totalSaved / totalContributed : 0,
    };
  }

  /**
   * Get overall savings statistics
   */
  getStatistics(): {
    totalOrders: number;
    executedOrders: number;
    failedOrders: number;
    activeOrders: number;
    pendingOrders: number;
    totalSaved: number;
    totalSpent: number;
    totalVolume: number;
    averageSavingsRate: number;
    totalParticipants: number;
    averageParticipantsPerOrder: number;
  } {
    const allOrders = Array.from(this.orders.values());
    const executed = allOrders.filter((o) => o.executed);
    const active = allOrders.filter(
      (o) => !o.executed && Date.now() <= o.deadline
    );
    const pending = allOrders.filter((o) => !o.executed);
    const failed = allOrders.filter(
      (o) => !o.executed && Date.now() > o.deadline
    );

    const totalSaved = this.savingsHistory.reduce(
      (sum, s) => sum + s.totalSaved,
      0
    );
    const totalSpent = this.savingsHistory.reduce(
      (sum, s) => sum + s.totalSpent,
      0
    );
    const totalVolume = allOrders.reduce(
      (sum, o) => sum + o.totalContributed,
      0
    );

    // Count unique participants
    const uniqueParticipants = new Set<string>();

    for (const order of allOrders) {
      for (const participant of order.participants.keys()) {
        uniqueParticipants.add(participant);
      }
    }

    const totalParticipations = executed.reduce(
      (sum, o) => sum + o.participants.size,
      0
    );

    return {
      totalOrders: allOrders.length,
      executedOrders: executed.length,
      failedOrders: failed.length,
      activeOrders: active.length,
      pendingOrders: pending.length,
      totalSaved,
      totalSpent,
      totalVolume,
      averageSavingsRate: totalSpent > 0 ? totalSaved / (totalSpent + totalSaved) : 0,
      totalParticipants: uniqueParticipants.size,
      averageParticipantsPerOrder:
        executed.length > 0 ? totalParticipations / executed.length : 0,
    };
  }

  /**
   * Validate 15% savings assumption
   */
  validateSavingsAssumption(): {
    assumedRate: number;
    actualRate: number;
    difference: number;
    withinTolerance: boolean;
    tolerance: number;
  } {
    const stats = this.getStatistics();
    const assumedRate = this.config.savingsRate;
    const actualRate = stats.averageSavingsRate;
    const difference = Math.abs(actualRate - assumedRate);
    const tolerance = 0.02; // 2% tolerance

    return {
      assumedRate,
      actualRate,
      difference,
      withinTolerance: difference <= tolerance,
      tolerance,
    };
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    config: GroupPurchaseConfig;
    totalOrders: number;
    executedOrders: number;
    orders: GroupOrder[];
    contributions: Contribution[];
    savings: SavingsResult[];
    statistics: {
      totalOrders: number;
      executedOrders: number;
      failedOrders: number;
      activeOrders: number;
      pendingOrders: number;
      totalSaved: number;
      totalSpent: number;
      totalVolume: number;
      averageSavingsRate: number;
      totalParticipants: number;
      averageParticipantsPerOrder: number;
    };
  } {
    const stats = this.getStatistics();
    return {
      config: this.config,
      totalOrders: stats.totalOrders,
      executedOrders: stats.executedOrders,
      orders: Array.from(this.orders.values()).map((order) => ({
        ...order,
        participants: new Map(order.participants),
      })),
      contributions: [...this.contributions],
      savings: [...this.savingsHistory],
      statistics: stats,
    };
  }
}

export default GroupPurchaseModel;
