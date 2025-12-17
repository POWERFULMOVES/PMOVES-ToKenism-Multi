/**
 * Projection Validator
 *
 * Validates business projection models against 5-year simulation runs.
 * Compares projected ROI, revenue, and break-even timelines with actual
 * simulation results.
 */

import { ContractCoordinator } from '../contracts/contract-coordinator';

/**
 * Business projection model to validate
 */
export interface ProjectionModel {
  name: string;
  description: string;
  initialInvestment: number;
  projectedYear5Revenue: number;
  projectedRiskAdjustedROI: number; // As decimal (13.66 for 1,366%)
  projectedBreakEvenMonths: number;
  successProbability: number; // As decimal (0.75 for 75%)

  // Simulation parameters
  populationSize: number;
  participationRate: number;
  weeklyRevenuePerParticipant: number;
  growthRatePerWeek: number;

  // Token economy parameters (if applicable)
  tokenDistributionRate?: number;
  groupBuyingSavings?: number;
  stakingParticipation?: number;
}

/**
 * Simulation results for validation
 */
export interface SimulationResults {
  totalWeeks: number;
  finalRevenue: number;
  totalCosts: number;
  netProfit: number;
  actualROI: number;
  breakEvenWeek: number | null;

  // Token economy metrics
  tokenMetrics?: {
    totalDistributed: number;
    totalValue: number;
    activeParticipants: number;
  };

  // Weekly data points
  weeklyRevenue: number[];
  weeklyProfit: number[];
  cumulativeRevenue: number[];
  cumulativeProfit: number[];
}

/**
 * Validation report comparing projections vs simulation
 */
export interface ValidationReport {
  modelName: string;

  // Projection targets
  projections: {
    revenue: number;
    roi: number;
    breakEvenMonths: number;
  };

  // Simulation results
  actual: {
    revenue: number;
    roi: number;
    breakEvenMonths: number | null;
  };

  // Variance analysis
  variance: {
    revenueVariance: number; // Percentage difference
    roiVariance: number;
    breakEvenVariance: number | null;
  };

  // Risk assessment
  riskAssessment: {
    achievedSuccessProbability: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
    riskFactors: string[];
    mitigationRecommendations: string[];
  };

  // Detailed analysis
  analysis: {
    revenueGrowthPattern: 'linear' | 'exponential' | 'plateau' | 'declining';
    profitabilityTrend: 'improving' | 'stable' | 'declining';
    tokenEconomyImpact?: 'positive' | 'neutral' | 'negative';
    marketScenario: 'bull' | 'normal' | 'bear';
  };
}

/**
 * Projection Validator
 */
export class ProjectionValidator {
  private coordinator: ContractCoordinator | null = null;

  /**
   * Create a fresh ContractCoordinator for each simulation run
   * This prevents state pollution between simulation runs
   */
  private createCoordinator(): ContractCoordinator {
    return new ContractCoordinator({
      groToken: {
        distributionMean: 0.5,
        distributionStd: 0.2,
        tokenValue: 2.0,
        participationRate: 0.20,
      },
      foodUSD: {
        pegValue: 1.0,
        foodCategories: ['groceries', 'prepared_food', 'dining'],
      },
      groupPurchase: {
        savingsRate: 0.15,
        minimumParticipants: 5,
      },
      groVault: {
        baseInterestRate: 0.02,
        lockBonusMultiplier: 0.5,
      },
      governance: {
        votingPeriodWeeks: 2,
        proposalThreshold: 100,
      },
    });
  }

  constructor() {
    // Coordinator is created fresh for each simulation run
  }

  /**
   * Run 5-year simulation for a projection model
   */
  async runSimulation(
    model: ProjectionModel,
    weeks: number = 260 // 5 years
  ): Promise<SimulationResults> {
    // Create a fresh coordinator for this simulation run
    // This ensures no state pollution between simulation runs
    this.coordinator = this.createCoordinator();

    // Initialize population
    const addresses = Array.from(
      { length: model.populationSize },
      (_, i) => `0xMEMBER${i}`
    );

    const initialWealth = addresses.map(() => 5000); // Default starting wealth

    this.coordinator.initialize({
      addresses,
      initialWealth,
    });

    // Track simulation metrics
    const weeklyRevenue: number[] = [];
    const weeklyProfit: number[] = [];
    const cumulativeRevenue: number[] = [];
    const cumulativeProfit: number[] = [];

    let totalRevenue = 0;
    let totalCosts = model.initialInvestment;
    let breakEvenWeek: number | null = null;

    // Run weekly simulation
    for (let week = 1; week <= weeks; week++) {
      // Calculate weekly revenue based on growth rate
      const baseRevenue = model.weeklyRevenuePerParticipant *
                         model.populationSize *
                         model.participationRate;

      const growthMultiplier = Math.pow(
        1 + model.growthRatePerWeek,
        week - 1
      );

      const weekRevenue = baseRevenue * growthMultiplier;

      // Process week in contract coordinator
      const householdBudgets = new Map<string, { foodBudget: number; totalIncome: number }>();

      for (let i = 0; i < model.populationSize; i++) {
        householdBudgets.set(`0xMEMBER${i}`, {
          foodBudget: 150 + (weekRevenue / model.populationSize * 0.3), // 30% to food
          totalIncome: weekRevenue / model.populationSize,
        });
      }

      await this.coordinator.processWeek(week, householdBudgets);

      // Track metrics
      totalRevenue += weekRevenue;

      const weekCost = model.initialInvestment * 0.001; // 0.1% weekly operating cost
      totalCosts += weekCost;

      const weekProfit = weekRevenue - weekCost;
      const cumulativeProf = totalRevenue - totalCosts;

      weeklyRevenue.push(weekRevenue);
      weeklyProfit.push(weekProfit);
      cumulativeRevenue.push(totalRevenue);
      cumulativeProfit.push(cumulativeProf);

      // Check for break-even
      if (breakEvenWeek === null && cumulativeProf >= 0) {
        breakEvenWeek = week;
      }
    }

    const finalRevenue = totalRevenue;
    const netProfit = totalRevenue - totalCosts;
    const actualROI = (netProfit / model.initialInvestment) * 100;

    // Get token metrics if applicable
    const stats = this.coordinator.getComprehensiveStats();

    return {
      totalWeeks: weeks,
      finalRevenue,
      totalCosts,
      netProfit,
      actualROI,
      breakEvenWeek,
      tokenMetrics: {
        totalDistributed: stats.groToken.totalDistributed,
        totalValue: stats.groToken.totalValue,
        activeParticipants: stats.groToken.activeParticipants,
      },
      weeklyRevenue,
      weeklyProfit,
      cumulativeRevenue,
      cumulativeProfit,
    };
  }

  /**
   * Validate projection model against simulation
   */
  async validate(model: ProjectionModel): Promise<ValidationReport> {
    // Run simulation
    const results = await this.runSimulation(model);

    // Calculate variances
    const revenueVariance = ((results.finalRevenue - model.projectedYear5Revenue) /
                            model.projectedYear5Revenue) * 100;

    // Convert projected ROI from decimal to percentage for comparison
    const projectedROIPercent = model.projectedRiskAdjustedROI * 100;
    const roiVariance = ((results.actualROI - projectedROIPercent) /
                        projectedROIPercent) * 100;

    const breakEvenMonths = results.breakEvenWeek ? results.breakEvenWeek / 4.33 : null;
    const breakEvenVariance = breakEvenMonths ?
      ((breakEvenMonths - model.projectedBreakEvenMonths) /
       model.projectedBreakEvenMonths) * 100 : null;

    // Assess success
    const achievedROI = results.actualROI >= (projectedROIPercent * 0.8); // Within 20%
    const achievedBreakEven = breakEvenMonths ?
      breakEvenMonths <= (model.projectedBreakEvenMonths * 1.2) : false;

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low';
    if (Math.abs(revenueVariance) < 10 && Math.abs(roiVariance) < 15) {
      confidenceLevel = 'high';
    } else if (Math.abs(revenueVariance) < 25 && Math.abs(roiVariance) < 30) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    // Identify risk factors
    const riskFactors: string[] = [];
    if (!achievedROI) riskFactors.push('ROI below target');
    if (!achievedBreakEven) riskFactors.push('Break-even delayed');
    if (results.weeklyRevenue.slice(-10).some((r, i, arr) => i > 0 && r < arr[i-1])) {
      riskFactors.push('Revenue decline in final weeks');
    }
    if (model.participationRate < 0.5) {
      riskFactors.push('Low participation rate');
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (!achievedROI) {
      recommendations.push('Increase participation rate or revenue per participant');
    }
    if (!achievedBreakEven) {
      recommendations.push('Reduce initial investment or operating costs');
    }
    if (riskFactors.includes('Revenue decline in final weeks')) {
      recommendations.push('Implement retention strategies and market expansion');
    }
    if (model.participationRate < 0.5) {
      recommendations.push('Focus on community engagement and adoption incentives');
    }

    // Analyze growth pattern
    const revenueGrowth = results.weeklyRevenue.map((r, i) =>
      i > 0 ? (r - results.weeklyRevenue[i-1]) / results.weeklyRevenue[i-1] : 0
    );

    const avgGrowth = revenueGrowth.reduce((a, b) => a + b, 0) / revenueGrowth.length;

    let growthPattern: 'linear' | 'exponential' | 'plateau' | 'declining';
    if (avgGrowth > 0.02) growthPattern = 'exponential';
    else if (avgGrowth > 0.005) growthPattern = 'linear';
    else if (avgGrowth > -0.005) growthPattern = 'plateau';
    else growthPattern = 'declining';

    // Analyze profitability trend
    const recentProfit = results.weeklyProfit.slice(-52); // Last year
    const earlyProfit = results.weeklyProfit.slice(52, 104); // Year 2

    const recentAvg = recentProfit.reduce((a, b) => a + b, 0) / recentProfit.length;
    const earlyAvg = earlyProfit.reduce((a, b) => a + b, 0) / earlyProfit.length;

    let profitabilityTrend: 'improving' | 'stable' | 'declining';
    if (recentAvg > earlyAvg * 1.1) profitabilityTrend = 'improving';
    else if (recentAvg > earlyAvg * 0.9) profitabilityTrend = 'stable';
    else profitabilityTrend = 'declining';

    // Determine market scenario based on actual vs projected
    let marketScenario: 'bull' | 'normal' | 'bear';
    if (results.actualROI > model.projectedRiskAdjustedROI * 1.2) marketScenario = 'bull';
    else if (results.actualROI > model.projectedRiskAdjustedROI * 0.8) marketScenario = 'normal';
    else marketScenario = 'bear';

    return {
      modelName: model.name,
      projections: {
        revenue: model.projectedYear5Revenue,
        roi: model.projectedRiskAdjustedROI,
        breakEvenMonths: model.projectedBreakEvenMonths,
      },
      actual: {
        revenue: results.finalRevenue,
        roi: results.actualROI,
        breakEvenMonths,
      },
      variance: {
        revenueVariance,
        roiVariance,
        breakEvenVariance,
      },
      riskAssessment: {
        achievedSuccessProbability: achievedROI && achievedBreakEven,
        confidenceLevel,
        riskFactors,
        mitigationRecommendations: recommendations,
      },
      analysis: {
        revenueGrowthPattern: growthPattern,
        profitabilityTrend,
        tokenEconomyImpact: results.tokenMetrics && results.tokenMetrics.totalValue > 0 ?
          'positive' : undefined,
        marketScenario,
      },
    };
  }

  /**
   * Compare multiple projection models
   */
  async compareModels(models: ProjectionModel[]): Promise<{
    models: ValidationReport[];
    ranking: { name: string; score: number }[];
    recommendations: string[];
  }> {
    // Validate all models sequentially to avoid shared coordinator state pollution
    const reports: ValidationReport[] = [];
    for (const model of models) {
      reports.push(await this.validate(model));
    }

    // Score each model (0-100 scale)
    const rankings = reports.map(report => {
      let score = 50; // Base score

      // ROI achievement (+/-30 points)
      const roiAchievement = Math.min(
        30,
        Math.max(-30, (report.variance.roiVariance / 100) * 30)
      );
      score += roiAchievement;

      // Revenue achievement (+/-20 points)
      const revenueAchievement = Math.min(
        20,
        Math.max(-20, (report.variance.revenueVariance / 100) * 20)
      );
      score += revenueAchievement;

      // Confidence level (+/-15 points)
      if (report.riskAssessment.confidenceLevel === 'high') score += 15;
      else if (report.riskAssessment.confidenceLevel === 'low') score -= 15;

      // Growth pattern (+/-10 points)
      if (report.analysis.revenueGrowthPattern === 'exponential') score += 10;
      else if (report.analysis.revenueGrowthPattern === 'declining') score -= 10;

      // Profitability trend (+/-10 points)
      if (report.analysis.profitabilityTrend === 'improving') score += 10;
      else if (report.analysis.profitabilityTrend === 'declining') score -= 10;

      return {
        name: report.modelName,
        score: Math.max(0, Math.min(100, score)),
      };
    });

    // Sort by score
    rankings.sort((a, b) => b.score - a.score);

    // Generate recommendations
    const recommendations: string[] = [];

    const bestModel = rankings[0];
    recommendations.push(
      `Primary recommendation: ${bestModel.name} (Score: ${bestModel.score.toFixed(1)})`
    );

    const highConfidence = reports.filter(
      r => r.riskAssessment.confidenceLevel === 'high'
    );

    if (highConfidence.length > 0) {
      recommendations.push(
        `High confidence models: ${highConfidence.map(r => r.modelName).join(', ')}`
      );
    }

    const tokenModels = reports.filter(
      r => r.analysis.tokenEconomyImpact === 'positive'
    );

    if (tokenModels.length > 0) {
      recommendations.push(
        `Token economy shows positive impact in: ${tokenModels.map(r => r.modelName).join(', ')}`
      );
    }

    return {
      models: reports,
      ranking: rankings,
      recommendations,
    };
  }
}
