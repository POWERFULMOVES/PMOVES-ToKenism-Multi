import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PARAMS, runSimulation } from '@/lib/simulation';

export async function GET(request: NextRequest) {
  try {
    // Run a short simulation with default parameters to get current metrics
    const simParams = { ...DEFAULT_PARAMS };
    // Use a shorter simulation for performance
    simParams.SIMULATION_WEEKS = 52; // 1 year

    console.log('Running simulation to get current metrics');
    const simulationResults = await runSimulation(simParams);

    // Get the latest metrics from the simulation
    const latestMetrics = simulationResults.history[simulationResults.history.length - 1];

    // Calculate trends by comparing with earlier periods
    const midPoint = Math.floor(simulationResults.history.length / 2);
    const earlierMetrics = simulationResults.history[midPoint];

    // Calculate health score based on multiple factors
    const healthScore = (
      (1 - (latestMetrics.PovertyRate_B as number || 0)) * 0.4 + // Lower poverty = higher health
      (latestMetrics.SocialSafetyNet as number || 0) * 0.3 + // Better safety net = higher health
      (latestMetrics.CommunityResilience as number || 0) * 0.3 // Higher resilience = higher health
    );

    // Calculate market efficiency
    const marketEfficiency = (
      (latestMetrics.EconomicVelocity as number || 0) * 0.5 + // Higher velocity = more efficient
      (latestMetrics.MarketEfficiency as number || 0) * 0.3 + // Direct efficiency measure
      (1 - Math.min(0.5, latestMetrics.Gini_B as number || 0)) * 0.2 // Lower inequality = more efficient, capped
    );

    // Calculate resilience score
    const resilienceScore = (
      (latestMetrics.RiskResilience as number || 0) * 0.4 + // Direct resilience measure
      (latestMetrics.CommunityResilience as number || 0) * 0.3 + // Community resilience
      (latestMetrics.SocialSafetyNet as number || 0) * 0.3 // Safety net contributes to resilience
    );

    // Calculate growth rate
    const growthRate = (earlierMetrics.AvgWealth_B as number || 0) > 0 ?
      ((latestMetrics.AvgWealth_B as number || 0) - (earlierMetrics.AvgWealth_B as number || 0)) / (earlierMetrics.AvgWealth_B as number || 1) / (simulationResults.history.length - midPoint) * 52 : // Annualized
      0;

    // Calculate trends
    const healthTrend = (earlierMetrics.CommunityResilience as number || 0) > 0 ?
      ((latestMetrics.CommunityResilience as number || 0) - (earlierMetrics.CommunityResilience as number || 0)) / (earlierMetrics.CommunityResilience as number || 1) :
      0;

    const efficiencyTrend = (earlierMetrics.EconomicVelocity as number || 0) > 0 ?
      ((latestMetrics.EconomicVelocity as number || 0) - (earlierMetrics.EconomicVelocity as number || 0)) / (earlierMetrics.EconomicVelocity as number || 1) :
      0;

    const resilienceTrend = (earlierMetrics.RiskResilience as number || 0) > 0 ?
      ((latestMetrics.RiskResilience as number || 0) - (earlierMetrics.RiskResilience as number || 0)) / (earlierMetrics.RiskResilience as number || 1) :
      0;

    // Generate warnings based on actual metrics
    const warnings = [];

    if ((latestMetrics.Gini_B as number || 0) > 0.4) {
      warnings.push('Moderate inequality detected');
    }

    if ((latestMetrics.PovertyRate_B as number || 0) > 0.15) {
      warnings.push('Elevated poverty rate');
    }

    if (growthRate < 0.01) {
      warnings.push('Low economic growth');
    }

    // Generate recommendations based on actual metrics
    const recommendations = [];

    // Check if internal spending (LocalEconomyStrength) is low
    if ((latestMetrics.LocalEconomyStrength as number || 0) < 0.5) {
      recommendations.push('Consider increasing internal spending');
    }

    if ((latestMetrics.Gini_B as number || 0) > 0.35) {
      recommendations.push('Implement wealth redistribution mechanisms');
    }

    if ((latestMetrics.RiskResilience as number || 0) < 0.7) {
      recommendations.push('Build emergency reserves');
    }

    // If no specific recommendations, add a general one
    if (recommendations.length === 0) {
      recommendations.push('Monitor GroToken value');
    }

    return NextResponse.json({
      health_score: healthScore,
      market_efficiency: marketEfficiency,
      resilience_score: resilienceScore,
      detailed_metrics: {
        velocity: latestMetrics.EconomicVelocity,
        inequality: latestMetrics.Gini_B,
        growth_rate: growthRate,
        innovation_score: latestMetrics.InnovationIndex
      },
      trends: {
        health_trend: healthTrend,
        efficiency_trend: efficiencyTrend,
        resilience_trend: resilienceTrend
      },
      warnings: warnings,
      recommendations: recommendations
    });
  } catch (error) {
    console.error('Error getting current metrics:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while getting current metrics.' },
      { status: 500 }
    );
  }
}
