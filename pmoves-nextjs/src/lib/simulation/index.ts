import { SimulationParams, SimMember, WeeklyMetrics, KeyEvent, SimulationResults } from './types';
import { DEFAULT_PARAMS, calculateGini, randomNormal, randomLogNormal, percentile, mean, median, stdDev, generateNarrativeSummary } from './utils';

// Create a new member
function createMember(member_id: string, initial_wealth: number, params: SimulationParams): SimMember {
  // Calculate relative wealth position more accurately using log-normal distribution properties
  // This gives us a better estimate of where this member falls in the wealth distribution
  const wealthMean = Math.exp(params.INITIAL_WEALTH_MEAN_LOG + params.INITIAL_WEALTH_SIGMA_LOG * params.INITIAL_WEALTH_SIGMA_LOG / 2);
  const wealthPercentile = Math.min(0.99, Math.max(0.01, initial_wealth / (wealthMean * 3)));

  // Determine inequality level (0-1 scale)
  const inequalityLevel = Math.min(1, params.INITIAL_WEALTH_SIGMA_LOG / 1.5);

  // Adjust spending behavior based on wealth
  // Wealthier members have more discretionary spending and can participate more in cooperative
  // Poorer members need to be more careful with spending and may participate less
  const wealthFactor = Math.min(1, Math.max(0.5, wealthPercentile * 2));

  // Calculate wealth quintile (0-4, where 0 is poorest 20% and 4 is richest 20%)
  const wealthQuintile = Math.floor(wealthPercentile * 5);

  // Adjust internal spending propensity based on wealth and inequality
  let internalSpendingAdjustment = 0;

  if (inequalityLevel > 0.5) { // Significant inequality
    if (wealthQuintile <= 1) { // Bottom 40%
      // In high inequality, poorest members have less capacity to participate
      // but may benefit more from cooperation if they can participate
      internalSpendingAdjustment = -0.1 * inequalityLevel;

      // However, if extremely high inequality, the poorest may be more motivated
      // to participate in alternative economic systems
      if (inequalityLevel > 0.8 && params.PERCENT_SPEND_INTERNAL_AVG > 0.4) {
        internalSpendingAdjustment = 0.05; // Slight increase in participation
      }
    } else if (wealthQuintile >= 3) { // Top 40%
      // Wealthier members in high inequality scenarios may participate less
      // unless there are strong incentives (high token value or savings)
      const incentiveStrength = (params.GROUP_BUY_SAVINGS_PERCENT + params.GROTOKEN_USD_VALUE/5) / 0.3;
      internalSpendingAdjustment = (incentiveStrength - 1) * 0.1;
    }
  }

  return {
    id: member_id,
    wealth_scenario_A: Math.max(0, initial_wealth),
    wealth_scenario_B: Math.max(0, initial_wealth),
    food_usd_balance: Math.max(0, initial_wealth),
    grotoken_balance: 0.0,
    weekly_food_budget: Math.max(
      params.MIN_WEEKLY_BUDGET,
      randomNormal(params.WEEKLY_FOOD_BUDGET_AVG, params.WEEKLY_FOOD_BUDGET_STDDEV)
    ),
    propensity_to_spend_internal: Math.max(
      0.0,
      Math.min(
        1.0,
        randomNormal(params.PERCENT_SPEND_INTERNAL_AVG, params.PERCENT_SPEND_INTERNAL_STDDEV) + internalSpendingAdjustment
      )
    ),
    weekly_income: Math.max(
      params.MIN_WEEKLY_INCOME,
      randomNormal(params.WEEKLY_INCOME_AVG, params.WEEKLY_INCOME_STDDEV)
    ),
    internal_transaction_count: 0,
    grotoken_usage_rate: Math.random() * 0.1 * wealthFactor
  };
}

// Economic Metrics Class
class EconomicMetrics {
  members: SimMember[];
  params: SimulationParams;
  previous_metrics: WeeklyMetrics | null;
  current_week: number;

  constructor(members: SimMember[], params: SimulationParams) {
    this.members = members;
    this.params = params;
    this.previous_metrics = null;
    this.current_week = 0;
  }

  calculate_metrics(wealth_A_list: number[], wealth_B_list: number[], week: number): WeeklyMetrics {
    this.current_week = week;

    // Basic wealth distribution analysis
    const wealth_quintiles_A = wealth_A_list.length
      ? [20, 40, 60, 80].map(p => percentile(wealth_A_list, p))
      : [];

    const wealth_quintiles_B = wealth_B_list.length
      ? [20, 40, 60, 80].map(p => percentile(wealth_B_list, p))
      : [];

    const metrics: WeeklyMetrics = {
      Week: week,
      Year: Math.floor(week / 52) + 1,
      Quarter: Math.floor((week % 52) / 13) + 1,

      // Core Wealth Metrics
      AvgWealth_A: wealth_A_list.length ? mean(wealth_A_list) : 0,
      AvgWealth_B: wealth_B_list.length ? mean(wealth_B_list) : 0,
      MedianWealth_A: wealth_A_list.length ? median(wealth_A_list) : 0,
      MedianWealth_B: wealth_B_list.length ? median(wealth_B_list) : 0,
      TotalWealth_A: wealth_A_list.reduce((sum, val) => sum + val, 0),
      TotalWealth_B: wealth_B_list.reduce((sum, val) => sum + val, 0),

      // Wealth Distribution Metrics
      WealthQuintiles_A: wealth_quintiles_A,
      WealthQuintiles_B: wealth_quintiles_B,
      Top10Percent_A: wealth_A_list.length ? percentile(wealth_A_list, 90) : 0,
      Top10Percent_B: wealth_B_list.length ? percentile(wealth_B_list, 90) : 0,
      Bottom10Percent_A: wealth_A_list.length ? percentile(wealth_A_list, 10) : 0,
      Bottom10Percent_B: wealth_B_list.length ? percentile(wealth_B_list, 10) : 0,

      // Inequality Metrics
      Gini_A: calculateGini(wealth_A_list),
      Gini_B: calculateGini(wealth_B_list),
      WealthGap_A: this.calculate_wealth_gap(wealth_A_list),
      WealthGap_B: this.calculate_wealth_gap(wealth_B_list),
      Bottom20PctShare: this.calculate_bottom_20_pct_share(wealth_B_list),

      // Economic Health Indicators
      PovertyRate_A: this.calculate_poverty_rate(wealth_A_list),
      PovertyRate_B: this.calculate_poverty_rate(wealth_B_list),
      WealthMobility: this.calculate_wealth_mobility(),
      LocalEconomyStrength: this.calculate_local_economy_strength(),
      CommunityResilience: this.calculate_community_resilience(),

      // Advanced Metrics
      EconomicVelocity: this.calculate_economic_velocity(),
      SocialSafetyNet: this.calculate_social_safety_net(),
      InnovationIndex: this.calculate_innovation_index(),
      SustainabilityScore: this.calculate_sustainability_score(),
      CommunityEngagement: this.calculate_community_engagement(),

      // Additional metrics from calculate_advanced_metrics
      ...this.calculate_advanced_metrics()
    };

    // Calculate trends if we have previous metrics
    if (this.previous_metrics) {
      Object.assign(metrics, this.calculate_trends(metrics));
    }

    this.previous_metrics = { ...metrics };
    return metrics;
  }

  calculate_poverty_rate(wealth_list: number[]): number {
    const poverty_line = this.params.WEEKLY_FOOD_BUDGET_AVG * 4;
    if (!wealth_list.length) return 0.0;
    return wealth_list.filter(w => w < poverty_line).length / wealth_list.length;
  }

  calculate_wealth_mobility(): number {
    if (!this.members.length) return 0.0;
    return mean(this.members.map(m => m.grotoken_balance * this.params.GROTOKEN_USD_VALUE));
  }

  calculate_local_economy_strength(): number {
    if (!this.members.length) return 0.0;
    return mean(this.members.map(m => m.propensity_to_spend_internal));
  }

  calculate_community_resilience(): number {
    const safety_net = this.calculate_social_safety_net();
    return safety_net;
  }

  calculate_wealth_gap(wealth_list: number[]): number {
    if (wealth_list.length < 5) return Number.POSITIVE_INFINITY;
    try {
      const top_20_idx = Math.floor(wealth_list.length * 0.8);
      const bottom_20_idx = Math.floor(wealth_list.length * 0.2);
      const sorted_wealth = [...wealth_list].map(w => Math.max(0, w)).sort((a, b) => a - b);
      const top_20_mean = mean(sorted_wealth.slice(top_20_idx));
      const bottom_20_mean = mean(sorted_wealth.slice(0, bottom_20_idx));
      return bottom_20_mean > 1e-6 ? top_20_mean / bottom_20_mean : Number.POSITIVE_INFINITY;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  calculate_bottom_20_pct_share(wealth_list: number[]): number {
    if (wealth_list.length < 5) return 0.0;
    try {
      const total_wealth = wealth_list.reduce((sum, w) => sum + Math.max(0, w), 0);
      if (total_wealth <= 1e-6) return 0.0;
      const sorted_wealth = [...wealth_list].map(w => Math.max(0, w)).sort((a, b) => a - b);
      const bottom_20_idx = Math.floor(wealth_list.length * 0.2);
      const bottom_20_wealth = sorted_wealth.slice(0, bottom_20_idx).reduce((sum, w) => sum + w, 0);
      return bottom_20_wealth / total_wealth;
    } catch {
      return 0.0;
    }
  }

  calculate_economic_velocity(): number {
    if (!this.members.length) return 0.0;
    const avg_internal_spend_propensity = mean(this.members.map(m => m.propensity_to_spend_internal));
    return avg_internal_spend_propensity;
  }

  calculate_social_safety_net(): number {
    const poverty_line = this.params.WEEKLY_FOOD_BUDGET_AVG * 4;
    if (!this.members.length) return 0.0;
    const below_poverty = this.members.filter(m => m.wealth_scenario_B < poverty_line).length;
    return 1.0 - (below_poverty / this.members.length);
  }

  calculate_innovation_index(): number {
    if (!this.members.length) return 0.0;
    const grotoken_adoption = this.members.filter(m => m.grotoken_balance > 0).length / this.members.length;
    const local_prod_strength = this.calculate_local_economy_strength();
    return (grotoken_adoption + local_prod_strength) / 2;
  }

  calculate_sustainability_score(): number {
    const resilience = this.calculate_community_resilience();
    return resilience;
  }

  calculate_community_engagement(): number {
    if (!this.members.length) return 0.0;
    return mean(this.members.map(m => m.propensity_to_spend_internal));
  }

  calculate_trends(current_metrics: WeeklyMetrics): Record<string, number> {
    const trends: Record<string, number> = {};
    const trend_keys = [
      'AvgWealth_B', 'Gini_B', 'PovertyRate_B', 'LocalEconomyStrength',
      'CommunityResilience', 'EconomicVelocity', 'SocialSafetyNet',
      'InnovationIndex', 'SustainabilityScore', 'CommunityEngagement'
    ];

    for (const key of trend_keys) {
      if (this.previous_metrics &&
          key in this.previous_metrics &&
          key in current_metrics) {
        const prev_value = this.previous_metrics[key] as number;
        const current_value = current_metrics[key] as number;
        try {
          if (Math.abs(prev_value) > 1e-6) {
            trends[`${key}_Trend`] = (current_value - prev_value) / Math.abs(prev_value);
          } else if (current_value > prev_value) {
            trends[`${key}_Trend`] = 1.0;
          } else if (current_value < prev_value) {
            trends[`${key}_Trend`] = -1.0;
          } else {
            trends[`${key}_Trend`] = 0.0;
          }
        } catch {
          trends[`${key}_Trend`] = 0.0;
        }
      } else {
        trends[`${key}_Trend`] = 0.0;
      }
    }
    return trends;
  }

  calculate_market_efficiency(): number {
    const avg_internal_tx = mean(this.members.map(m => m.internal_transaction_count));
    return (avg_internal_tx / Math.max(1, this.current_week)) * 10;
  }

  calculate_innovation_adoption(): number {
    return mean(this.members.map(m => m.grotoken_usage_rate));
  }

  calculate_wealth_mobility_score(): number {
    if (!this.members.length || !this.previous_metrics) return 0.0;

    // Calculate wealth mobility by analyzing changes in wealth rankings
    // Higher score means more movement between wealth quintiles

    // Get current wealth values
    const currentWealth = this.members.map(m => m.wealth_scenario_B);

    // Calculate wealth quintiles
    const quintileSize = Math.ceil(this.members.length / 5);
    const sortedWealth = [...currentWealth].sort((a, b) => a - b);

    // Define quintile boundaries
    const quintileBoundaries: number[] = [];
    for (let i = 1; i < 5; i++) {
      const idx = Math.min(i * quintileSize, sortedWealth.length - 1);
      quintileBoundaries.push(sortedWealth[idx]);
    }

    // Assign current quintiles to members
    const currentQuintiles = currentWealth.map(w => {
      for (let i = 0; i < quintileBoundaries.length; i++) {
        if (w <= quintileBoundaries[i]) return i;
      }
      return 4; // Top quintile
    });

    // Calculate mobility score based on week-to-week changes
    // Higher score means more movement between quintiles
    const mobilityScore = this.current_week > 10 ? 0.5 : 0.1; // Base mobility

    // Adjust based on Gini coefficient trend
    const giniTrend = this.previous_metrics.Gini_B_Trend || 0;
    const mobilityAdjustment = -giniTrend * 0.5; // Decreasing inequality = higher mobility

    return Math.max(0.1, Math.min(0.9, mobilityScore + mobilityAdjustment));
  }

  // Helper function to calculate standard deviation
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  // Helper function to calculate mean
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Helper function to calculate Gini coefficient
  private calculateGini(values: number[]): number {
    if (values.length === 0) return 0;
    const sortedValues = [...values].sort((a, b) => a - b);
    let sumOfDifferences = 0;
    for (let i = 0; i < sortedValues.length; i++) {
      for (let j = 0; j < sortedValues.length; j++) {
        sumOfDifferences += Math.abs(sortedValues[i] - sortedValues[j]);
      }
    }
    const meanValue = this.calculateMean(values);
    return sumOfDifferences / (2 * values.length * values.length * meanValue || 1);
  }

  calculate_economic_diversity(): number {
    if (!this.members.length) return 0.5; // Default mid-range value

    // Calculate economic diversity based on multiple factors:
    // 1. Variation in internal spending rates (more variation = more diverse economy)
    // 2. Balance between internal and external spending (more balanced = more diverse)
    // 3. Distribution of GroToken usage (more even distribution = more diverse)

    // Calculate standard deviation of internal spending propensity
    const internalSpendingRates = this.members.map(m => m.propensity_to_spend_internal);
    const internalSpendingStdDev = this.calculateStdDev(internalSpendingRates);

    // Calculate balance between internal and external spending
    const avgInternalSpending = this.calculateMean(internalSpendingRates);
    const balanceFactor = 1.0 - Math.abs(0.5 - avgInternalSpending) * 2; // 1.0 at 50/50 split, lower as it gets unbalanced

    // Calculate distribution of GroToken usage
    const grotokenUsage = this.members.map(m => m.grotoken_usage_rate);
    const grotokenUsageGini = this.calculateGini(grotokenUsage);
    const grotokenDistributionFactor = 1.0 - grotokenUsageGini; // Lower Gini = more even distribution

    // Combine factors with appropriate weights
    const diversityScore = (
      (internalSpendingStdDev / (this.params.PERCENT_SPEND_INTERNAL_STDDEV || 0.1)) * 0.3 + // Higher variation = more diversity
      balanceFactor * 0.4 + // More balanced = more diversity
      grotokenDistributionFactor * 0.3 // More even distribution = more diversity
    );

    // Normalize to 0-1 range
    return Math.max(0.1, Math.min(0.9, diversityScore));
  }

  calculate_risk_resilience(): number {
    const safety_net = this.calculate_social_safety_net();
    const wealth_B = this.members.map(m => m.wealth_scenario_B);
    const mean_wealth = mean(wealth_B);
    const std_dev_wealth = stdDev(wealth_B);
    const stability = mean_wealth > 1e-6 ? 1.0 - (std_dev_wealth / mean_wealth) : 0;
    return (safety_net + stability) / 2.0;
  }

  calculate_advanced_metrics(): Record<string, number> {
    return {
      MarketEfficiency: this.calculate_market_efficiency(),
      InnovationAdoption: this.calculate_innovation_adoption(),
      WealthMobilityScore: this.calculate_wealth_mobility_score(),
      EconomicDiversity: this.calculate_economic_diversity(),
      RiskResilience: this.calculate_risk_resilience()
    };
  }
}

// Main simulation function
export async function runSimulation(params: Partial<SimulationParams>): Promise<SimulationResults> {
  console.log(`--- Running Simulation with params: ${params.description || 'Custom Params'} ---`);

  const sim_params: SimulationParams = { ...DEFAULT_PARAMS, ...params };

  try {
    // Generate initial wealth distribution using lognormal distribution
    const initial_wealths = Array.from(
      { length: sim_params.NUM_MEMBERS },
      () => randomLogNormal(sim_params.INITIAL_WEALTH_MEAN_LOG, sim_params.INITIAL_WEALTH_SIGMA_LOG)
    );

    // Create members
    const members = initial_wealths.map((wealth, i) =>
      createMember(`M_${i}`, wealth, sim_params)
    );

    const metrics_calculator = new EconomicMetrics(members, sim_params);
    const simulation_history: WeeklyMetrics[] = [];
    const key_events: KeyEvent[] = [];

    console.log(`Initialized ${members.length} members.`);

    // Simulation Loop
    for (let week = 0; week < sim_params.SIMULATION_WEEKS; week++) {
      const current_wealth_A_list: number[] = [];
      const current_wealth_B_list: number[] = [];

      // Calculate inequality metrics for this simulation
      const initialWealths = members.map(m => m.wealth_scenario_A);
      const initialGini = calculateGini(initialWealths);
      const isHighInequality = initialGini > 0.4;
      const isExtremeInequality = initialGini > 0.5;

      // Member processing loop
      for (const member of members) {
        try {
          // Scenario A (Traditional)
          // Completely revised economic downturn detection and classification
          // Use income-to-expense ratio as the primary indicator of economic stress
          const incomeToExpenseRatio = sim_params.WEEKLY_INCOME_AVG / sim_params.WEEKLY_FOOD_BUDGET_AVG;

          // Calculate economic stress level (0-1 scale) based on income-to-expense ratio
          // Lower ratio = higher stress
          let economicStressLevel = 0;

          if (incomeToExpenseRatio < 2.0) {
            // Start applying stress when income is less than 2x expenses
            economicStressLevel = Math.max(0, Math.min(1, (2.0 - incomeToExpenseRatio) / 1.5));
          }

          // Classify downturn severity
          const isEconomicDownturn = economicStressLevel >= 0.3;
          const isSevereDownturn = economicStressLevel >= 0.6;

          // Additional factors that affect economic stress
          if (sim_params.WEEKLY_INCOME_AVG < 120) {
            // Low absolute income increases stress regardless of ratio
            const lowIncomeStress = (120 - sim_params.WEEKLY_INCOME_AVG) / 100;
            economicStressLevel = Math.min(1, economicStressLevel + lowIncomeStress * 0.3);
          }

          // Adjust stress level based on inequality
          if (sim_params.INITIAL_WEALTH_SIGMA_LOG > 0.8) {
            // High inequality makes downturns more stressful
            const inequalityFactor = (sim_params.INITIAL_WEALTH_SIGMA_LOG - 0.8) / 0.7;
            economicStressLevel = Math.min(1, economicStressLevel + inequalityFactor * 0.2);
          }

          // Completely revised approach to spending during economic downturns
          // In traditional model, people have limited options to adapt
          let adjustedFoodBudget = member.weekly_food_budget;

          if (economicStressLevel > 0) {
            // Calculate base stress impact on food costs
            // In traditional economy, costs often increase during downturns due to:
            // - Supply chain disruptions
            // - Reduced competition
            // - Price gouging
            // - Inability to bulk purchase
            const baseCostIncrease = economicStressLevel * 0.25; // Up to 25% higher costs

            // Calculate individual vulnerability factor
            // Lower income individuals are more vulnerable to price increases
            const incomeRatio = member.weekly_income / sim_params.WEEKLY_INCOME_AVG;
            const vulnerabilityFactor = Math.max(0.8, 1.2 - (incomeRatio * 0.2)); // 0.8 to 1.2 range

            // Calculate final cost adjustment factor
            const costAdjustmentFactor = 1.0 + (baseCostIncrease * vulnerabilityFactor);

            // Apply cost adjustment, but cap it based on available wealth
            const maxSpendingFromWealth = member.wealth_scenario_A * (isSevereDownturn ? 0.25 : 0.15);
            const maxSpending = Math.min(
              member.weekly_food_budget * costAdjustmentFactor,
              member.weekly_income + maxSpendingFromWealth
            );

            adjustedFoodBudget = Math.min(maxSpending, member.wealth_scenario_A * 0.9);

            // In severe downturns, some expenses become unavoidable
            if (isSevereDownturn) {
              // Minimum necessary spending - people will go into debt if necessary
              const minimumNecessarySpending = member.weekly_food_budget * 0.8;
              adjustedFoodBudget = Math.max(minimumNecessarySpending, adjustedFoodBudget);
            }
          }

          member.wealth_scenario_A += member.weekly_income;
          const actual_spending_A = Math.min(adjustedFoodBudget, member.wealth_scenario_A);
          member.wealth_scenario_A = Math.max(0, member.wealth_scenario_A - actual_spending_A);

          // Scenario B (Cooperative)
          member.food_usd_balance += member.weekly_income;

          // Completely revised approach to cooperative model during economic downturns
          let budget_to_spend = member.weekly_food_budget;

          if (economicStressLevel > 0) {
            // Cooperative model provides significant resilience during economic stress
            // through multiple mechanisms:

            // 1. Community size effect - larger communities have more resources and options
            const communitySize = sim_params.NUM_MEMBERS;
            // Sigmoid function to model diminishing returns of scale
            const sizeFactor = 1.0 + (0.3 * (communitySize / (communitySize + 50)));

            // 2. Cooperation level effect - higher internal spending means more resilience
            const avgCooperation = sim_params.PERCENT_SPEND_INTERNAL_AVG;
            const cooperationFactor = 1.0 + (avgCooperation * 0.5); // 1.0 to 1.5 range

            // 3. Individual participation effect - more engaged members get more benefits
            const participationRatio = member.propensity_to_spend_internal / Math.max(0.1, avgCooperation);
            const participationFactor = 0.8 + (0.4 * Math.min(1.5, participationRatio)); // 0.8 to 1.4 range

            // 4. Stress response factor - cooperative benefits increase during stress
            // This models how communities often come together during crises
            const stressResponseFactor = 1.0 + (economicStressLevel * 0.5); // 1.0 to 1.5 range

            // Calculate base cost reduction from cooperative model
            // Higher stress = more cost reduction (up to 40% in severe downturns)
            const baseCostReduction = economicStressLevel * 0.4;

            // Apply all factors to calculate final cost reduction
            const totalCostReduction = baseCostReduction * sizeFactor * cooperationFactor * participationFactor * stressResponseFactor;

            // Calculate final cost factor (lower means more savings)
            const cooperativeCostFactor = Math.max(0.5, 1.0 - totalCostReduction);

            // Apply cost factor to food budget
            budget_to_spend = member.weekly_food_budget * cooperativeCostFactor;

            // In severe downturns, add mutual aid mechanisms
            if (isSevereDownturn) {
              // Calculate vulnerability (lower wealth = higher vulnerability)
              const wealthRatio = member.food_usd_balance / (member.weekly_food_budget * 8);
              const vulnerabilityScore = Math.max(0, 1.0 - Math.min(1.0, wealthRatio));

              // Mutual aid provides more support to more vulnerable members
              // This creates a progressive support system within the cooperative
              const mutualAidSupport = vulnerabilityScore * 0.2 * avgCooperation;

              // Apply mutual aid support (further reduces costs for vulnerable members)
              budget_to_spend *= (1.0 - mutualAidSupport);

              // Ensure minimum viable spending level
              const minimumSpending = member.weekly_food_budget * 0.6;
              budget_to_spend = Math.max(minimumSpending, budget_to_spend);
            }
          }
          const intended_spend_internal = budget_to_spend * member.propensity_to_spend_internal;
          const intended_spend_external = budget_to_spend * (1.0 - member.propensity_to_spend_internal);

          // Completely revised community size scaling model
          // Using more sophisticated mathematical models for economies of scale

          const communitySize = sim_params.NUM_MEMBERS;

          // Define community size categories for reference
          const isTinyCommunity = communitySize <= 20;
          const isSmallCommunity = communitySize > 20 && communitySize <= 50;
          const isMediumCommunity = communitySize > 50 && communitySize <= 200;
          const isLargeCommunity = communitySize > 200;
          const isVeryLargeCommunity = communitySize > 500;

          // General size factor using a logistic growth function
          // This creates an S-curve that better models real-world economies of scale
          // Formula: f(x) = L / (1 + e^(-k(x-x0)))
          // Where:
          // L = maximum value (asymptote)
          // k = steepness of the curve
          // x0 = midpoint of the curve

          // Parameters for the logistic function
          const maxSizeFactor = 1.3;  // Maximum benefit from scale
          const midpoint = 100;       // Size at which we reach 50% of max benefit
          const steepness = 0.015;    // How quickly benefits increase with size

          // Calculate the general size factor using the logistic function
          const sizeFactor = maxSizeFactor / (1 + Math.exp(-steepness * (communitySize - midpoint)));

          // Group buying scale effects
          // Group buying benefits from larger scale but with diminishing returns
          // and potential coordination costs at very large scales

          // Base group buying factor from logistic growth
          let groupBuyScaleFactor = 0.6 + (0.8 / (1 + Math.exp(-0.02 * (communitySize - 75))));

          // Apply coordination penalty for very large communities
          if (isVeryLargeCommunity) {
            // Slight decrease in efficiency for very large groups due to coordination costs
            const coordinationPenalty = 0.05 * (1 - Math.exp(-(communitySize - 500) / 1000));
            groupBuyScaleFactor = Math.max(1.0, groupBuyScaleFactor - coordinationPenalty);
          }

          // Local production scale effects
          // Local production has a different scaling pattern with an optimal mid-range
          // Small communities lack resources, very large ones face coordination issues

          // Bell curve for local production efficiency
          // Formula: f(x) = a * exp(-(x-b)²/(2c²))
          // Where:
          // a = peak height
          // b = position of peak
          // c = width of bell curve

          const peakHeight = 1.2;     // Maximum efficiency
          const peakPosition = 150;   // Optimal community size
          const curveWidth = 200;     // How quickly efficiency drops off

          // Calculate bell curve value and normalize to reasonable range
          const bellCurveValue = peakHeight * Math.exp(-((communitySize - peakPosition) ** 2) / (2 * (curveWidth ** 2)));

          // Calculate local production scale factor with minimum efficiency for tiny communities
          let localProdScaleFactor: number;

          if (isTinyCommunity) {
            // Tiny communities still get some benefits from local production
            const tinyCommBoost = 0.1 * (communitySize / 20);
            const minEfficiency = 0.8 + tinyCommBoost;
            const standardValue = 0.9 + (bellCurveValue - 0.7);
            localProdScaleFactor = Math.max(minEfficiency, standardValue);
          } else {
            // Normal calculation for larger communities
            localProdScaleFactor = 0.9 + (bellCurveValue - 0.7);
          }

          // Apply scale factors to savings rates
          const groupBuySavingsAdjusted = sim_params.GROUP_BUY_SAVINGS_PERCENT * groupBuyScaleFactor;
          const localProductionSavingsAdjusted = sim_params.LOCAL_PRODUCTION_SAVINGS_PERCENT * localProdScaleFactor;

          const avg_internal_savings_rate = (
            groupBuySavingsAdjusted +
            localProductionSavingsAdjusted
          ) / 2;

          // Adjust savings effectiveness based on participation level and inequality
          // When internal spending is low, the benefits are reduced due to lack of critical mass
          let effectiveInternalSavingsRate = avg_internal_savings_rate;

          // Calculate participation factor with more nuanced approach
          // This models network effects in cooperation - benefits increase non-linearly with participation
          let participationFactor: number;

          // Get community-wide average participation
          const avgParticipation = sim_params.PERCENT_SPEND_INTERNAL_AVG;

          // Calculate individual participation relative to community average
          const relativeParticipation = member.propensity_to_spend_internal / Math.max(0.1, avgParticipation);

          if (avgParticipation >= 0.6) {
            // High cooperation scenario - strong network effects
            // In high cooperation scenarios, even moderate participants get good benefits
            // due to the strong overall system
            participationFactor = Math.min(1.2, 0.8 + (relativeParticipation * 0.4));

            // Bonus for very high community participation (over 70%)
            if (avgParticipation > 0.7) {
              participationFactor *= 1.0 + ((avgParticipation - 0.7) * 0.5);
            }
          } else if (avgParticipation >= 0.3) {
            // Moderate cooperation scenario - moderate network effects
            participationFactor = Math.min(1.1, 0.7 + (relativeParticipation * 0.4));
          } else {
            // Low cooperation scenario - weak network effects
            // In low cooperation scenarios, benefits are reduced due to lack of critical mass
            // The curve is steeper - low participants get much less benefit
            if (member.propensity_to_spend_internal < 0.2) {
              participationFactor = Math.max(0.4, member.propensity_to_spend_internal * 3);
            } else {
              participationFactor = Math.min(1.0, 0.6 + (relativeParticipation * 0.4));
            }
          }

          // Adjust for inequality effects
          if (isHighInequality) {
            // In high inequality scenarios, the effectiveness of cooperation is reduced
            // unless there's very high participation
            const inequalityPenalty = isExtremeInequality ? 0.2 : 0.1;

            // The penalty is reduced if there's high overall participation
            const avgParticipation = sim_params.PERCENT_SPEND_INTERNAL_AVG;
            const participationBonus = Math.max(0, avgParticipation - 0.3) * 0.5;

            participationFactor *= (1.0 - inequalityPenalty + participationBonus);
          }

          // Apply the participation factor to the savings rate
          effectiveInternalSavingsRate = avg_internal_savings_rate * participationFactor;

          const effective_cost_internal = intended_spend_internal * (1.0 - effectiveInternalSavingsRate);
          const effective_cost_external = intended_spend_external;
          const total_effective_cost = effective_cost_internal + effective_cost_external;

          const actual_total_spending_B = Math.min(total_effective_cost, member.food_usd_balance);
          member.food_usd_balance = Math.max(0, member.food_usd_balance - actual_total_spending_B);

          const actual_coop_fee = Math.min(sim_params.WEEKLY_COOP_FEE_B, member.food_usd_balance);
          member.food_usd_balance = Math.max(0, member.food_usd_balance - actual_coop_fee);

          // Calculate GroToken rewards with adjustments for participation and cooperation level
          const baseReward = Math.max(
            0,
            randomNormal(
              sim_params.GROTOKEN_REWARD_PER_WEEK_AVG,
              sim_params.GROTOKEN_REWARD_STDDEV
            )
          );

          // Adjust rewards based on individual participation
          // Higher internal spending means more contribution to the cooperative economy
          // which results in more rewards
          const participationMultiplier = 0.7 + (member.propensity_to_spend_internal * 0.6); // 0.7 to 1.3 range

          // Adjust rewards based on community-wide cooperation level
          let cooperationMultiplier = 1.0;
          if (avgParticipation >= 0.6) {
            // High cooperation scenarios generate more rewards due to network effects
            cooperationMultiplier = 1.0 + ((avgParticipation - 0.6) * 0.5); // 1.0 to 1.2 range
          } else if (avgParticipation < 0.3) {
            // Low cooperation scenarios generate fewer rewards
            cooperationMultiplier = 0.8 + ((avgParticipation / 0.3) * 0.2); // 0.8 to 1.0 range
          }

          // Apply multipliers to base reward
          const adjustedReward = baseReward * participationMultiplier * cooperationMultiplier;

          // Add rewards to balance
          member.grotoken_balance += adjustedReward;

          const current_wealth_B = member.food_usd_balance +
            (member.grotoken_balance * sim_params.GROTOKEN_USD_VALUE);

          member.wealth_scenario_B = current_wealth_B;

          current_wealth_A_list.push(member.wealth_scenario_A);
          current_wealth_B_list.push(current_wealth_B);
        } catch (e) {
          console.error(`Error processing member ${member.id} in week ${week + 1}:`, e);
          current_wealth_A_list.push(member.wealth_scenario_A);
          current_wealth_B_list.push(member.wealth_scenario_B);
        }
      }

      // Record Weekly Metrics
      try {
        const weekly_metrics = metrics_calculator.calculate_metrics(
          current_wealth_A_list,
          current_wealth_B_list,
          week + 1
        );

        simulation_history.push(weekly_metrics);

        // Event Tracking
        if (week > 0) {
          const prev_metrics = simulation_history[simulation_history.length - 2];

          if ((weekly_metrics.Gini_B || 1) < (prev_metrics.Gini_B || 1) * 0.95) {
            key_events.push({
              week: week + 1,
              type: 'equality_improvement',
              description: `Significant reduction in wealth inequality (Gini B < ${(prev_metrics.Gini_B || 1) * 0.95})`
            });
          }

          if ((weekly_metrics.PovertyRate_B || 1) < (prev_metrics.PovertyRate_B || 1) * 0.9) {
            key_events.push({
              week: week + 1,
              type: 'poverty_reduction',
              description: `Significant poverty reduction (Rate B < ${(prev_metrics.PovertyRate_B || 1) * 0.9 * 100}%)`
            });
          }
        }
      } catch (e) {
        console.error(`Error calculating metrics for week ${week + 1}:`, e);
      }
    }

    console.log("--- Simulation Loop Finished ---");

    // Prepare Results
    try {
      const final_member_data = members.map(m => ({
        id: m.id,
        wealth_scenario_A: m.wealth_scenario_A,
        wealth_scenario_B: m.wealth_scenario_B,
        food_usd_balance: m.food_usd_balance,
        grotoken_balance: m.grotoken_balance,
        weekly_food_budget: m.weekly_food_budget,
        propensity_to_spend_internal: m.propensity_to_spend_internal,
        weekly_income: m.weekly_income,
        internal_transaction_count: m.internal_transaction_count,
        grotoken_usage_rate: m.grotoken_usage_rate,
        ID: m.id,
        Income: m.weekly_income,
        Budget: m.weekly_food_budget,
        Wealth_A: m.wealth_scenario_A,
        Wealth_B: m.wealth_scenario_B,
        FoodUSD_B: m.food_usd_balance,
        GroToken_B: m.grotoken_balance
      } as SimMember));

      const summary_narrative = generateNarrativeSummary(simulation_history, key_events);

      const results: SimulationResults = {
        history: simulation_history,
        final_members: final_member_data,
        key_events: key_events,
        summary: summary_narrative,
        params: sim_params // Include the parameters used for the simulation
      };

      return results;
    } catch (e) {
      console.error("Error preparing results:", e);
      throw new Error(`Error preparing results: ${e}`);
    }
  } catch (e) {
    console.error("Error during simulation setup:", e);
    throw new Error(`Error during simulation setup: ${e}`);
  }
}

// Export utility functions
export { calculateGini, DEFAULT_PARAMS };
