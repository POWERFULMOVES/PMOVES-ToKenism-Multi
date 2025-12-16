/**
 * Firefly-iii Data Transformer
 *
 * Transforms Firefly-iii transaction data into format compatible with
 * PMOVES token economy simulations
 */

import { Transaction } from './firefly-client';

export interface CategoryMapping {
  fireflyCategory: string;
  foodUSDCategory: string;
  description: string;
}

export interface WeeklySpending {
  week: number;
  startDate: Date;
  endDate: Date;
  totalSpending: number;
  byCategory: Record<string, number>;
  transactionCount: number;
  participantCount: number;
}

export interface ParticipationMetrics {
  totalParticipants: number;
  activeParticipants: number;
  participationRate: number;
  averageSpendingPerParticipant: number;
  spendingDistribution: {
    p25: number; // 25th percentile
    p50: number; // median
    p75: number; // 75th percentile
    p95: number; // 95th percentile
  };
}

export interface TransformedData {
  periodStart: Date;
  periodEnd: Date;
  weeklySpending: WeeklySpending[];
  participation: ParticipationMetrics;
  categoryDistribution: Record<string, number>;
  totalSpending: number;
}

/**
 * Default category mappings from Firefly-iii to FoodUSD
 */
export const DEFAULT_CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    fireflyCategory: 'Groceries',
    foodUSDCategory: 'groceries',
    description: 'Supermarket and grocery store purchases',
  },
  {
    fireflyCategory: 'Supermarket',
    foodUSDCategory: 'groceries',
    description: 'Supermarket purchases',
  },
  {
    fireflyCategory: 'Food & Drinks',
    foodUSDCategory: 'groceries',
    description: 'General food and beverage purchases',
  },
  {
    fireflyCategory: 'Restaurants',
    foodUSDCategory: 'dining',
    description: 'Restaurant dining',
  },
  {
    fireflyCategory: 'Dining Out',
    foodUSDCategory: 'dining',
    description: 'Eating out at restaurants',
  },
  {
    fireflyCategory: 'Fast Food',
    foodUSDCategory: 'prepared_food',
    description: 'Quick service restaurants',
  },
  {
    fireflyCategory: 'Coffee Shop',
    foodUSDCategory: 'prepared_food',
    description: 'Coffee shops and cafes',
  },
  {
    fireflyCategory: 'Takeaway',
    foodUSDCategory: 'food_delivery',
    description: 'Food delivery and takeout',
  },
  {
    fireflyCategory: 'Food Delivery',
    foodUSDCategory: 'food_delivery',
    description: 'Delivery service orders',
  },
  {
    fireflyCategory: 'Farmers Market',
    foodUSDCategory: 'farmers_market',
    description: 'Farmers market purchases',
  },
  {
    fireflyCategory: 'Local Food',
    foodUSDCategory: 'farmers_market',
    description: 'Local food producers',
  },
];

export class FireflyDataTransformer {
  private categoryMappings: Map<string, string>;

  constructor(customMappings?: CategoryMapping[]) {
    this.categoryMappings = new Map();

    // Load default mappings
    DEFAULT_CATEGORY_MAPPINGS.forEach((mapping) => {
      this.categoryMappings.set(
        mapping.fireflyCategory.toLowerCase(),
        mapping.foodUSDCategory
      );
    });

    // Override with custom mappings if provided
    if (customMappings) {
      customMappings.forEach((mapping) => {
        this.categoryMappings.set(
          mapping.fireflyCategory.toLowerCase(),
          mapping.foodUSDCategory
        );
      });
    }
  }

  /**
   * Map Firefly category to FoodUSD category
   */
  mapCategory(fireflyCategory: string): string {
    const normalized = fireflyCategory.toLowerCase();

    // Direct mapping
    if (this.categoryMappings.has(normalized)) {
      return this.categoryMappings.get(normalized)!;
    }

    // Fuzzy matching for common patterns
    if (normalized.includes('grocer') || normalized.includes('supermarket')) {
      return 'groceries';
    }
    if (normalized.includes('restaurant') || normalized.includes('dining')) {
      return 'dining';
    }
    if (normalized.includes('delivery') || normalized.includes('takeout')) {
      return 'food_delivery';
    }
    if (normalized.includes('farmer') || normalized.includes('market')) {
      return 'farmers_market';
    }
    if (
      normalized.includes('coffee') ||
      normalized.includes('cafe') ||
      normalized.includes('fast food')
    ) {
      return 'prepared_food';
    }

    // Default to groceries for unmapped food-related categories
    console.warn(
      `[DataTransformer] Unmapped category: ${fireflyCategory}, defaulting to groceries`
    );
    return 'groceries';
  }

  /**
   * Filter transactions to food-related only
   */
  filterFoodTransactions(transactions: Transaction[]): Transaction[] {
    const foodKeywords = [
      'food',
      'grocer',
      'restaurant',
      'dining',
      'cafe',
      'coffee',
      'supermarket',
      'market',
      'delivery',
      'takeout',
      'takeaway',
      'farmer',
    ];

    return transactions.filter((tx) => {
      const category = tx.category.toLowerCase();
      const description = tx.description.toLowerCase();

      return (
        foodKeywords.some(
          (keyword) => category.includes(keyword) || description.includes(keyword)
        ) || this.categoryMappings.has(category)
      );
    });
  }

  /**
   * Group transactions by week
   */
  groupByWeek(transactions: Transaction[]): WeeklySpending[] {
    if (transactions.length === 0) {
      return [];
    }

    // Sort transactions by date
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);

    // Get Monday of the first week (on or before firstDate to avoid dropping Sunday transactions)
    const startDate = new Date(firstDate);
    const firstDay = startDate.getDay();
    const offset = firstDay === 0 ? -6 : 1 - firstDay; // Move to Monday on or before firstDate
    startDate.setDate(startDate.getDate() + offset);

    const weeks: WeeklySpending[] = [];
    const currentWeekStart = new Date(startDate);
    let weekNumber = 1;

    while (currentWeekStart <= lastDate) {
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

      const weekTransactions = sorted.filter((tx) => {
        const txDate = new Date(tx.date);
        return txDate >= currentWeekStart && txDate <= currentWeekEnd;
      });

      const byCategory: Record<string, number> = {};
      let totalSpending = 0;
      const participants = new Set<string>();

      weekTransactions.forEach((tx) => {
        const category = this.mapCategory(tx.category);
        const amount = Math.abs(tx.amount);

        if (!byCategory[category]) {
          byCategory[category] = 0;
        }
        byCategory[category] += amount;
        totalSpending += amount;

        // Track unique participants (source accounts)
        participants.add(tx.sourceAccount);
      });

      weeks.push({
        week: weekNumber,
        startDate: new Date(currentWeekStart),
        endDate: new Date(currentWeekEnd),
        totalSpending,
        byCategory,
        transactionCount: weekTransactions.length,
        participantCount: participants.size,
      });

      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekNumber++;
    }

    return weeks;
  }

  /**
   * Calculate participation metrics
   */
  calculateParticipation(
    weeklySpending: WeeklySpending[],
    totalPopulation: number
  ): ParticipationMetrics {
    // Calculate per-participant spending across all weeks
    const participantSpending = new Map<string, number>();

    weeklySpending.forEach((week) => {
      // For now, we don't have individual participant data in weekly aggregates
      // So we'll estimate based on transaction counts and totals
      const avgSpending = week.participantCount > 0
        ? week.totalSpending / week.participantCount
        : 0;

      // This is a simplification - in reality we'd track individual participants
      for (let i = 0; i < week.participantCount; i++) {
        const participantId = `participant_${i}`;
        if (!participantSpending.has(participantId)) {
          participantSpending.set(participantId, 0);
        }
        participantSpending.set(
          participantId,
          participantSpending.get(participantId)! + avgSpending
        );
      }
    });

    const activeParticipants = participantSpending.size;
    const participationRate = totalPopulation > 0
      ? activeParticipants / totalPopulation
      : 0;

    const totalSpent = Array.from(participantSpending.values()).reduce(
      (sum, amount) => sum + amount,
      0
    );

    const averageSpendingPerParticipant = activeParticipants > 0
      ? totalSpent / activeParticipants
      : 0;

    // Calculate spending distribution percentiles
    const sortedSpending = Array.from(participantSpending.values()).sort(
      (a, b) => a - b
    );

    const getPercentile = (p: number) => {
      if (sortedSpending.length === 0) return 0;
      const index = Math.floor((sortedSpending.length - 1) * p);
      return sortedSpending[index];
    };

    return {
      totalParticipants: totalPopulation,
      activeParticipants,
      participationRate,
      averageSpendingPerParticipant,
      spendingDistribution: {
        p25: getPercentile(0.25),
        p50: getPercentile(0.5), // median
        p75: getPercentile(0.75),
        p95: getPercentile(0.95),
      },
    };
  }

  /**
   * Calculate category distribution percentages
   */
  calculateCategoryDistribution(
    weeklySpending: WeeklySpending[]
  ): Record<string, number> {
    const totalByCategory: Record<string, number> = {};
    let grandTotal = 0;

    weeklySpending.forEach((week) => {
      Object.entries(week.byCategory).forEach(([category, amount]) => {
        if (!totalByCategory[category]) {
          totalByCategory[category] = 0;
        }
        totalByCategory[category] += amount;
        grandTotal += amount;
      });
    });

    // Convert to percentages
    const distribution: Record<string, number> = {};
    Object.entries(totalByCategory).forEach(([category, amount]) => {
      distribution[category] = grandTotal > 0 ? (amount / grandTotal) * 100 : 0;
    });

    return distribution;
  }

  /**
   * Transform Firefly transactions into simulation-ready format
   */
  transform(
    transactions: Transaction[],
    totalPopulation: number = 500
  ): TransformedData {
    console.log(
      `[DataTransformer] Transforming ${transactions.length} transactions`
    );

    // Filter to food-related transactions only
    const foodTransactions = this.filterFoodTransactions(transactions);
    console.log(
      `[DataTransformer] Found ${foodTransactions.length} food transactions`
    );

    if (foodTransactions.length === 0) {
      throw new Error('No food-related transactions found');
    }

    // Group by week
    const weeklySpending = this.groupByWeek(foodTransactions);
    console.log(`[DataTransformer] Grouped into ${weeklySpending.length} weeks`);

    // Calculate metrics
    const participation = this.calculateParticipation(
      weeklySpending,
      totalPopulation
    );
    const categoryDistribution = this.calculateCategoryDistribution(weeklySpending);

    const totalSpending = weeklySpending.reduce(
      (sum, week) => sum + week.totalSpending,
      0
    );

    const periodStart = weeklySpending[0].startDate;
    const periodEnd = weeklySpending[weeklySpending.length - 1].endDate;

    console.log(`[DataTransformer] Transformation complete:`);
    console.log(`  - Period: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
    console.log(`  - Total spending: $${totalSpending.toFixed(2)}`);
    console.log(`  - Participation rate: ${(participation.participationRate * 100).toFixed(1)}%`);
    console.log(`  - Average per participant: $${participation.averageSpendingPerParticipant.toFixed(2)}`);

    return {
      periodStart,
      periodEnd,
      weeklySpending,
      participation,
      categoryDistribution,
      totalSpending,
    };
  }

  /**
   * Export category mappings for reference
   */
  exportCategoryMappings(): CategoryMapping[] {
    const mappings: CategoryMapping[] = [];

    this.categoryMappings.forEach((foodUSDCategory, fireflyCategory) => {
      mappings.push({
        fireflyCategory,
        foodUSDCategory,
        description: `Maps ${fireflyCategory} to ${foodUSDCategory}`,
      });
    });

    return mappings.sort((a, b) =>
      a.fireflyCategory.localeCompare(b.fireflyCategory)
    );
  }
}

export default FireflyDataTransformer;
