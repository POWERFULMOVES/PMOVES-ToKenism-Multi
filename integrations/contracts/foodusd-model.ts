/**
 * FoodUSD Stablecoin Model
 * Tracks food spending through a stablecoin (1:1 with USD)
 */

export interface FoodUSDConfig {
  // Stablecoin properties
  pegValue: number; // 1.0 for 1:1 USD peg
  treasuryAddress: string;

  // Spending categories
  foodCategories: string[];

  // Minting/Burning
  allowUserMinting: boolean;
  requireTreasuryApproval: boolean;

  // Policy variable (open decision #7): when true, FoodUSD is spend-limited —
  // it may only be transferred TO an approved vendor, not peer-to-peer. This
  // narrows FoodUSD toward the vendor-redeemable $CRED model. Default false
  // (free-floating 1:1 utility). Left OPEN to test the utility-vs-speculation line.
  vendorLocked: boolean;
  approvedVendors: string[];
  // Internal plumbing addresses (e.g. the GroupPurchase escrow contract) whose
  // transfers bypass vendor-lock in BOTH directions — so escrow deposits,
  // supplier payouts, and refunds-to-users keep working under a spend-limited
  // policy (otherwise a refund back to a non-vendor user would trap funds).
  internalAddresses: string[];
}

export interface FoodUSDHolder {
  address: string;
  balance: number;
  totalMinted: number;
  totalBurned: number;
  totalSpent: number;
  spendingByCategory: Record<string, number>;
}

export interface SpendingTransaction {
  week: number;
  from: string;
  to: string;
  amount: number;
  category: string;
  description: string;
  timestamp: number;
}

export class FoodUSDModel {
  private config: FoodUSDConfig;
  private holders: Map<string, FoodUSDHolder> = new Map();
  private _totalSupply: number = 0;
  private transactions: SpendingTransaction[] = [];
  private currentWeek: number = 0;

  constructor(config: Partial<FoodUSDConfig> = {}) {
    this.config = {
      pegValue: 1.0,
      treasuryAddress: '0xTREASURY',
      foodCategories: [
        'groceries',
        'prepared_food',
        'dining',
        'farmers_market',
        'food_delivery',
      ],
      allowUserMinting: false,
      requireTreasuryApproval: true,
      vendorLocked: false,
      approvedVendors: [],
      internalAddresses: [],
      ...config,
    };
  }

  /**
   * Initialize holders
   */
  initializeHolders(addresses: string[]): void {
    for (const address of addresses) {
      this.holders.set(address, {
        address,
        balance: 0,
        totalMinted: 0,
        totalBurned: 0,
        totalSpent: 0,
        spendingByCategory: {},
      });
    }

    // Initialize treasury
    this.holders.set(this.config.treasuryAddress, {
      address: this.config.treasuryAddress,
      balance: 0,
      totalMinted: 0,
      totalBurned: 0,
      totalSpent: 0,
      spendingByCategory: {},
    });

    // console.log(`[FoodUSD] Initialized ${addresses.length + 1} holders`);
  }

  /**
   * Mint FoodUSD tokens (treasury only)
   */
  mint(to: string, amount: number): boolean {
    const holder = this.holders.get(to);

    if (!holder) {
      throw new Error('Holder not found');
    }

    // Mint tokens
    holder.balance += amount;
    holder.totalMinted += amount;
    this._totalSupply += amount;

    // console.log(`[FoodUSD] Minted ${amount} FUSD to ${to}`);

    return true;
  }

  /**
   * Burn FoodUSD tokens
   */
  burn(from: string, amount: number): boolean {
    const holder = this.holders.get(from);

    if (!holder) {
      throw new Error('Holder not found');
    }

    if (holder.balance < amount) {
      throw new Error('Insufficient balance');
    }

    holder.balance -= amount;
    holder.totalBurned += amount;
    this._totalSupply -= amount;

    // console.log(`[FoodUSD] Burned ${amount} FUSD from ${from}`);

    return true;
  }

  /**
   * Transfer FoodUSD between holders
   */
  transfer(from: string, to: string, amount: number): boolean {
    // Policy variable: under vendor-lock, FoodUSD is spend-limited — a user may
    // only send to an approved vendor (toward the $CRED model). Internal plumbing
    // (escrow deposits, payouts, refunds) is exempt in both directions so funds
    // are never trapped.
    if (this.config.vendorLocked) {
      const vendors = this.config.approvedVendors ?? [];
      const internal = this.config.internalAddresses ?? [];
      const exempt =
        vendors.includes(to) || internal.includes(to) || internal.includes(from);
      if (!exempt) {
        throw new Error(
          `FoodUSD is vendor-locked: ${to} is not an approved vendor (spend-limited under current policy)`
        );
      }
    }

    const fromHolder = this.holders.get(from);
    const toHolder = this.holders.get(to);

    if (!fromHolder || !toHolder) {
      throw new Error('Holder not found');
    }

    if (fromHolder.balance < amount) {
      throw new Error('Insufficient balance');
    }

    fromHolder.balance -= amount;
    toHolder.balance += amount;

    return true;
  }

  /**
   * Record a food spending transaction
   */
  recordSpending(
    week: number,
    from: string,
    category: string,
    amount: number,
    description: string = ''
  ): SpendingTransaction {
    this.currentWeek = week;

    // Validate category
    if (!this.config.foodCategories.includes(category)) {
      throw new Error(`Invalid food category: ${category}`);
    }

    const holder = this.holders.get(from);

    if (!holder) {
      throw new Error('Holder not found');
    }

    // Use small epsilon for floating point comparison to avoid accumulation errors
    // After many transactions, floating point errors can cause balance to be
    // 149.9999999 instead of 150, causing spurious "insufficient balance" errors
    const EPSILON = 0.01; // 1 cent tolerance
    if (holder.balance + EPSILON < amount) {
      throw new Error('Insufficient balance');
    }

    // Clamp spending to available balance to handle floating point edge cases
    const actualAmount = Math.min(amount, holder.balance);

    // Update spending stats (use requested amount for accounting accuracy)
    holder.totalSpent += amount;

    if (!holder.spendingByCategory[category]) {
      holder.spendingByCategory[category] = 0;
    }
    holder.spendingByCategory[category] += amount;

    // Burn tokens (spending removes from circulation)
    // Use actualAmount for the balance deduction to prevent negative balance
    this.burn(from, actualAmount);

    // Record transaction
    const transaction: SpendingTransaction = {
      week,
      from,
      to: 'food_vendor',
      amount,
      category,
      description,
      timestamp: Date.now(),
    };

    this.transactions.push(transaction);

    return transaction;
  }

  /**
   * Fund a holder's account for food spending
   */
  fundAccount(address: string, weeklyFoodBudget: number): void {
    this.mint(address, weeklyFoodBudget);
  }

  /**
   * Process weekly food spending for a holder
   */
  processWeeklySpending(
    week: number,
    address: string,
    spendingByCategory: Record<string, number>
  ): SpendingTransaction[] {
    const transactions: SpendingTransaction[] = [];

    for (const [category, amount] of Object.entries(spendingByCategory)) {
      if (amount > 0 && this.config.foodCategories.includes(category)) {
        const tx = this.recordSpending(
          week,
          address,
          category,
          amount,
          `Weekly ${category} spending`
        );

        transactions.push(tx);
      }
    }

    return transactions;
  }

  /**
   * Get total supply of FoodUSD tokens
   */
  totalSupply(): number {
    return this._totalSupply;
  }

  /**
   * Get balance for a holder
   */
  balanceOf(address: string): number {
    return this.holders.get(address)?.balance || 0;
  }

  /**
   * Get spending statistics for a holder
   */
  getHolderStats(address: string): {
    balance: number;
    totalSpent: number;
    spendingByCategory: Record<string, number>;
    averageWeeklySpending: number;
  } | null {
    const holder = this.holders.get(address);

    if (!holder) {
      return null;
    }

    // const _weeklyTransactions = this.transactions.filter(
    //   (tx) => tx.from === address
    // );

    const averageWeeklySpending =
      this.currentWeek > 0
        ? holder.totalSpent / this.currentWeek
        : holder.totalSpent;

    return {
      balance: holder.balance,
      totalSpent: holder.totalSpent,
      spendingByCategory: { ...holder.spendingByCategory },
      averageWeeklySpending,
    };
  }

  /**
   * Get spending for a holder (alias for getHolderStats for backward compatibility)
   */
  getHolderSpending(address: string): {
    total: number;
    byCategory: Record<string, number>;
  } {
    const holder = this.holders.get(address);

    if (!holder) {
      return {
        total: 0,
        byCategory: {},
      };
    }

    return {
      total: holder.totalSpent,
      byCategory: { ...holder.spendingByCategory },
    };
  }

  /**
   * Get overall statistics
   */
  getStatistics(): {
    totalSupply: number;
    totalMinted: number;
    totalBurned: number;
    totalSpent: number;
    holders: number;
    totalHolders: number;
    transactions: number;
    spendingByCategory: Record<string, number>;
    averageSpendingPerHolder: number;
  } {
    const holders = Array.from(this.holders.values()).filter(
      (h) => h.address !== this.config.treasuryAddress
    );

    const totalMinted = holders.reduce((sum, h) => sum + h.totalMinted, 0);
    const totalBurned = holders.reduce((sum, h) => sum + h.totalBurned, 0);
    const totalSpent = holders.reduce((sum, h) => sum + h.totalSpent, 0);

    // Aggregate spending by category
    const spendingByCategory: Record<string, number> = {};

    for (const holder of holders) {
      for (const [category, amount] of Object.entries(
        holder.spendingByCategory
      )) {
        if (!spendingByCategory[category]) {
          spendingByCategory[category] = 0;
        }
        spendingByCategory[category] += amount;
      }
    }

    return {
      totalSupply: this._totalSupply,
      totalMinted,
      totalBurned,
      totalSpent,
      holders: holders.length,
      totalHolders: holders.length,
      transactions: this.transactions.length,
      spendingByCategory,
      averageSpendingPerHolder: totalSpent / holders.length,
    };
  }

  /**
   * Get all transactions
   */
  getTransactions(filter?: {
    week?: number;
    from?: string;
    category?: string;
  }): SpendingTransaction[] {
    let filtered = [...this.transactions];

    if (filter) {
      if (filter.week !== undefined) {
        filtered = filtered.filter((tx) => tx.week === filter.week);
      }

      if (filter.from) {
        filtered = filtered.filter((tx) => tx.from === filter.from);
      }

      if (filter.category) {
        filtered = filtered.filter((tx) => tx.category === filter.category);
      }
    }

    return filtered;
  }

  /**
   * Compare traditional spending vs FoodUSD spending
   */
  compareSpending(
    traditionalSpending: Record<string, number>
  ): {
    traditional: number;
    foodUSD: number;
    difference: number;
    percentageDifference: number;
    categoryComparison: Record<
      string,
      { traditional: number; foodUSD: number; difference: number }
    >;
  } {
    const stats = this.getStatistics();

    const traditionalTotal = Object.values(traditionalSpending).reduce(
      (sum, amount) => sum + amount,
      0
    );

    const difference = stats.totalSpent - traditionalTotal;
    const percentageDifference =
      traditionalTotal > 0 ? (difference / traditionalTotal) * 100 : 0;

    // Category-level comparison
    const categoryComparison: Record<
      string,
      { traditional: number; foodUSD: number; difference: number }
    > = {};

    for (const category of this.config.foodCategories) {
      const trad = traditionalSpending[category] || 0;
      const fusd = stats.spendingByCategory[category] || 0;

      categoryComparison[category] = {
        traditional: trad,
        foodUSD: fusd,
        difference: fusd - trad,
      };
    }

    return {
      traditional: traditionalTotal,
      foodUSD: stats.totalSpent,
      difference,
      percentageDifference,
      categoryComparison,
    };
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    config: FoodUSDConfig;
    totalSupply: number;
    holders: FoodUSDHolder[];
    transactions: SpendingTransaction[];
    statistics: {
      totalSupply: number;
      totalMinted: number;
      totalBurned: number;
      totalSpent: number;
      holders: number;
      totalHolders: number;
      transactions: number;
      spendingByCategory: Record<string, number>;
      averageSpendingPerHolder: number;
    };
  } {
    return {
      config: this.config,
      totalSupply: this._totalSupply,
      holders: Array.from(this.holders.values()),
      transactions: [...this.transactions],
      statistics: this.getStatistics(),
    };
  }
}

export default FoodUSDModel;
