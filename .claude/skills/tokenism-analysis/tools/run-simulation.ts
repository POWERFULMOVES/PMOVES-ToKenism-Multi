#!/usr/bin/env npx ts-node
/**
 * Tokenism Simulation Orchestrator
 *
 * Runs economic simulations via the Flask backend API.
 * Part of the tokenism-analysis skill toolset.
 *
 * Usage:
 *   npx ts-node run-simulation.ts [--members 50] [--weeks 156] [--output json|csv]
 */

interface SimulationParams {
  NUM_MEMBERS: number;
  SIMULATION_WEEKS: number;
  WEEKLY_INCOME_AVG: number;
  WEEKLY_FOOD_BUDGET_AVG: number;
  PERCENT_SPEND_INTERNAL_AVG: number;
  GROUP_BUY_SAVINGS_PERCENT: number;
  LOCAL_PRODUCTION_SAVINGS_PERCENT: number;
  GROTOKEN_REWARD_PER_WEEK_AVG: number;
  GROTOKEN_USD_VALUE: number;
  INITIAL_WEALTH_SIGMA_LOG: number;
  WEEKLY_COOP_FEE_B: number;
}

interface SimulationResult {
  summary: {
    final_gini: number;
    final_poverty_rate: number;
    total_internal_spending: number;
    total_external_spending: number;
    total_grotokens_earned: number;
  };
  weekly_data: Array<{
    week: number;
    gini: number;
    poverty_rate: number;
    avg_wealth: number;
  }>;
}

const DEFAULT_PARAMS: SimulationParams = {
  NUM_MEMBERS: 50,
  SIMULATION_WEEKS: 156,
  WEEKLY_INCOME_AVG: 120,
  WEEKLY_FOOD_BUDGET_AVG: 80,
  PERCENT_SPEND_INTERNAL_AVG: 0.6,
  GROUP_BUY_SAVINGS_PERCENT: 0.15,
  LOCAL_PRODUCTION_SAVINGS_PERCENT: 0.25,
  GROTOKEN_REWARD_PER_WEEK_AVG: 0.5,
  GROTOKEN_USD_VALUE: 2,
  INITIAL_WEALTH_SIGMA_LOG: 0.6,
  WEEKLY_COOP_FEE_B: 1,
};

async function runSimulation(
  params: Partial<SimulationParams> = {},
  apiUrl = 'http://localhost:5000'
): Promise<SimulationResult> {
  const mergedParams = { ...DEFAULT_PARAMS, ...params };

  console.log('[tokenism] Running simulation with params:', {
    members: mergedParams.NUM_MEMBERS,
    weeks: mergedParams.SIMULATION_WEEKS,
  });

  const response = await fetch(`${apiUrl}/run_simulation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mergedParams),
  });

  if (!response.ok) {
    throw new Error(`Simulation failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('[tokenism] Simulation complete:', {
    final_gini: result.summary?.final_gini?.toFixed(4),
    final_poverty_rate: result.summary?.final_poverty_rate?.toFixed(4),
  });

  return result;
}

function parseArgs(): { params: Partial<SimulationParams>; output: 'json' | 'csv' } {
  const args = process.argv.slice(2);
  const params: Partial<SimulationParams> = {};
  let output: 'json' | 'csv' = 'json';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--members':
        params.NUM_MEMBERS = parseInt(args[++i], 10);
        break;
      case '--weeks':
        params.SIMULATION_WEEKS = parseInt(args[++i], 10);
        break;
      case '--output':
        output = args[++i] as 'json' | 'csv';
        break;
    }
  }

  return { params, output };
}

async function main() {
  const { params, output } = parseArgs();

  try {
    const result = await runSimulation(params);

    if (output === 'csv') {
      console.log('week,gini,poverty_rate,avg_wealth');
      result.weekly_data?.forEach((row) => {
        console.log(`${row.week},${row.gini},${row.poverty_rate},${row.avg_wealth}`);
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('[tokenism] Error:', error);
    process.exit(1);
  }
}

main();

export { runSimulation, SimulationParams, SimulationResult, DEFAULT_PARAMS };
