#!/usr/bin/env npx ts-node
/**
 * Tokenism Parameter Validator
 *
 * Validates simulation parameters against business rules and constraints.
 * Part of the tokenism-analysis skill toolset.
 *
 * Usage:
 *   npx ts-node validate-params.ts < params.json
 *   npx ts-node validate-params.ts --members 50 --weeks 156
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SimulationParams {
  NUM_MEMBERS?: number;
  SIMULATION_WEEKS?: number;
  WEEKLY_INCOME_AVG?: number;
  WEEKLY_FOOD_BUDGET_AVG?: number;
  PERCENT_SPEND_INTERNAL_AVG?: number;
  GROUP_BUY_SAVINGS_PERCENT?: number;
  LOCAL_PRODUCTION_SAVINGS_PERCENT?: number;
  GROTOKEN_REWARD_PER_WEEK_AVG?: number;
  GROTOKEN_USD_VALUE?: number;
  INITIAL_WEALTH_SIGMA_LOG?: number;
  WEEKLY_COOP_FEE_B?: number;
}

const CONSTRAINTS = {
  NUM_MEMBERS: { min: 5, max: 10000 },
  SIMULATION_WEEKS: { min: 1, max: 520 }, // 10 years max
  WEEKLY_INCOME_AVG: { min: 10, max: 10000 },
  WEEKLY_FOOD_BUDGET_AVG: { min: 5, max: 5000 },
  PERCENT_SPEND_INTERNAL_AVG: { min: 0, max: 1 },
  GROUP_BUY_SAVINGS_PERCENT: { min: 0, max: 0.5 },
  LOCAL_PRODUCTION_SAVINGS_PERCENT: { min: 0, max: 0.5 },
  GROTOKEN_REWARD_PER_WEEK_AVG: { min: 0, max: 10 },
  GROTOKEN_USD_VALUE: { min: 0.01, max: 100 },
  INITIAL_WEALTH_SIGMA_LOG: { min: 0.1, max: 2.0 },
  WEEKLY_COOP_FEE_B: { min: 0, max: 50 },
};

function validateParams(params: SimulationParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required parameters
  if (params.NUM_MEMBERS === undefined) {
    errors.push('NUM_MEMBERS is required');
  }
  if (params.SIMULATION_WEEKS === undefined) {
    errors.push('SIMULATION_WEEKS is required');
  }

  // Validate ranges
  for (const [key, constraint] of Object.entries(CONSTRAINTS)) {
    const value = params[key as keyof SimulationParams];
    if (value !== undefined) {
      if (value < constraint.min) {
        errors.push(`${key} (${value}) is below minimum (${constraint.min})`);
      }
      if (value > constraint.max) {
        errors.push(`${key} (${value}) exceeds maximum (${constraint.max})`);
      }
    }
  }

  // Business logic validations
  if (params.WEEKLY_FOOD_BUDGET_AVG && params.WEEKLY_INCOME_AVG) {
    if (params.WEEKLY_FOOD_BUDGET_AVG > params.WEEKLY_INCOME_AVG) {
      warnings.push('Food budget exceeds income - members will accumulate debt');
    }
  }

  if (params.PERCENT_SPEND_INTERNAL_AVG && params.PERCENT_SPEND_INTERNAL_AVG < 0.3) {
    warnings.push('Low internal spending (<30%) may limit cooperative benefits');
  }

  if (params.NUM_MEMBERS && params.NUM_MEMBERS < 20) {
    warnings.push('Small community size (<20) may produce volatile results');
  }

  if (params.SIMULATION_WEEKS && params.SIMULATION_WEEKS < 52) {
    warnings.push('Short simulation (<1 year) may not show long-term trends');
  }

  // Combined savings check
  const totalSavings =
    (params.GROUP_BUY_SAVINGS_PERCENT || 0) +
    (params.LOCAL_PRODUCTION_SAVINGS_PERCENT || 0);
  if (totalSavings > 0.6) {
    warnings.push(`Combined savings (${(totalSavings * 100).toFixed(0)}%) is unusually high`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function parseArgsToParams(): SimulationParams {
  const args = process.argv.slice(2);
  const params: SimulationParams = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--members':
        params.NUM_MEMBERS = parseInt(value, 10);
        i++;
        break;
      case '--weeks':
        params.SIMULATION_WEEKS = parseInt(value, 10);
        i++;
        break;
      case '--income':
        params.WEEKLY_INCOME_AVG = parseFloat(value);
        i++;
        break;
      case '--budget':
        params.WEEKLY_FOOD_BUDGET_AVG = parseFloat(value);
        i++;
        break;
      case '--internal':
        params.PERCENT_SPEND_INTERNAL_AVG = parseFloat(value);
        i++;
        break;
    }
  }

  return params;
}

async function main() {
  let params: SimulationParams;

  // Check if input is piped
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    params = JSON.parse(input);
  } else {
    params = parseArgsToParams();
  }

  const result = validateParams(params);

  console.log('[tokenism] Validation result:', result.valid ? 'VALID' : 'INVALID');

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }

  process.exit(result.valid ? 0 : 1);
}

main();

export { validateParams, ValidationResult, CONSTRAINTS };
