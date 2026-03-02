import { formatPercentage, formatCurrency } from '../utils/formatters';
// Import model adjuster functions
import { adjustMathematicalModel, applyModelAdjustments } from './model-adjuster';

// Define interface for analysis results
interface AnalysisResult {
  passRate: number;
  sensitivities: ParameterSensitivity[];
  highErrorScenarios: TestResult[];
  lowErrorScenarios: TestResult[];
  recommendations: {
    focusParameters: string[];
    needsStressAdjustment: boolean;
    suggestedStressMultiplier: number;
  };
}

/**
 * Interface for test result data
 */
export interface TestResult {
  presetId: string;
  presetName: string;
  verification: {
    expectedWealthDiff?: number;
    actualWealthDiff?: number;
    errorPercentage: number;
    acceptableErrorThreshold?: number;
    isWithinErrorRange: boolean;
    validationMetrics?: {
      isDirectionallyCorrect: boolean;
      isInequalityReduced: boolean;
      hasReasonableMagnitude: boolean;
      downturnBenefitConsistency: boolean;
      validationScore: number;
    };
    [key: string]: unknown;
  };
  error?: string;
}

/**
 * Interface for test parameters
 */
interface TestParameters {
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
  WEEKLY_INCOME_STDDEV?: number;
  [key: string]: unknown;
}

/**
 * Interface for parameter sensitivity analysis
 */
interface ParameterSensitivity {
  parameter: string;
  correlation: number;
  passRate: number;
  avgError: number;
}

function formatCurrencyOrNA(value: number | undefined): string {
  return typeof value === 'number' ? formatCurrency(value) : 'N/A';
}

/**
 * Analyze test results to identify patterns and correlations
 */
export function analyzeTestResults(results: TestResult[], parameters: Record<string, TestParameters>) {
  console.log('\n=== TEST ANALYSIS ===');

  // 1. Basic statistics
  const passCount = results.filter(r => r.verification.isWithinErrorRange).length;
  const failCount = results.length - passCount;
  const passRate = passCount / results.length;

  console.log(`\nPass rate: ${formatPercentage(passRate)}`);
  console.log(`Average error: ${formatPercentage(results.reduce((sum, r) => sum + r.verification.errorPercentage, 0) / results.length)}`);

  // 2. Group results by error ranges
  const errorRanges = [
    { name: '0-5%', min: 0, max: 0.05, count: 0 },
    { name: '5-10%', min: 0.05, max: 0.1, count: 0 },
    { name: '10-20%', min: 0.1, max: 0.2, count: 0 },
    { name: '20-50%', min: 0.2, max: 0.5, count: 0 },
    { name: '50-100%', min: 0.5, max: 1, count: 0 },
    { name: '>100%', min: 1, max: Number.POSITIVE_INFINITY, count: 0 },
  ];

  for (const result of results) {
    if ('verification' in result && typeof result.verification.errorPercentage === 'number') {
      const error = result.verification.errorPercentage;
      const range = errorRanges.find(r => error >= r.min && error < r.max);
      if (range) range.count++;
    }
  }

  console.log('\nError distribution:');
  for (const range of errorRanges) {
    console.log(`  ${range.name}: ${range.count} scenarios (${formatPercentage(range.count / results.length)})`);
  }

  // 3. Parameter sensitivity analysis
  console.log('\nParameter sensitivity analysis:');

  // Get all parameter names
  const paramNames = new Set<string>();
  for (const params of Object.values(parameters)) {
    for (const key of Object.keys(params)) {
      paramNames.add(key);
    }
  }

  // Calculate sensitivity for each parameter
  const sensitivities: ParameterSensitivity[] = [];

  for (const param of paramNames) {
    // Skip parameters that don't vary
    const values = results.map(r => parameters[r.presetId]?.[param]).filter(v => v !== undefined);
    const uniqueValues = new Set(values);
    if (uniqueValues.size <= 1) continue;

    // Calculate correlation between parameter value and error
    const pairedValues = results.flatMap((r) => {
      const rawValue = parameters[r.presetId]?.[param];
      return typeof rawValue === 'number'
        ? [{ x: rawValue, y: r.verification.errorPercentage }]
        : [];
    });
    if (pairedValues.length < 2) continue;
    const paramValues = pairedValues.map((v) => v.x);
    const errorValues = pairedValues.map((v) => v.y);
    const correlation = calculateCorrelation(paramValues, errorValues);

    // Calculate pass rate for different parameter values
    const paramGroups = groupBy(results, r => parameters[r.presetId]?.[param]);
    const passRates = Object.entries(paramGroups).map(([value, group]) => {
      const groupPassCount = group.filter(r => r.verification.isWithinErrorRange).length;
      return { value, passRate: groupPassCount / group.length };
    });

    // Calculate average error for different parameter values
    const errorRates = Object.entries(paramGroups).map(([value, group]) => {
      const avgError = group.reduce((sum, r) => sum + r.verification.errorPercentage, 0) / group.length;
      return { value, avgError };
    });

    // Calculate overall pass rate for this parameter
    const overallPassRate = results
      .filter(r => parameters[r.presetId]?.[param] !== undefined)
      .filter(r => r.verification.isWithinErrorRange).length /
      results.filter(r => parameters[r.presetId]?.[param] !== undefined).length;

    // Calculate overall average error for this parameter
    const overallAvgError = results
      .filter(r => parameters[r.presetId]?.[param] !== undefined)
      .reduce((sum, r) => sum + r.verification.errorPercentage, 0) /
      results.filter(r => parameters[r.presetId]?.[param] !== undefined).length;

    sensitivities.push({
      parameter: param,
      correlation,
      passRate: overallPassRate,
      avgError: overallAvgError
    });

    console.log(`\n  ${param}:`);
    console.log(`    Correlation with error: ${correlation.toFixed(2)}`);
    console.log(`    Pass rates by value:`);
    for (const pr of passRates) {
      console.log(`      ${pr.value}: ${formatPercentage(pr.passRate)}`);
    }
    console.log('    Average errors by value:');
    for (const er of errorRates) {
      console.log(`      ${er.value}: ${formatPercentage(er.avgError)}`);
    }
  }

  // 4. Sort parameters by sensitivity
  sensitivities.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  console.log('\nParameters ranked by sensitivity:');
  for (const s of sensitivities) {
    console.log(`  ${s.parameter}: correlation=${s.correlation.toFixed(2)}, pass rate=${formatPercentage(s.passRate)}, avg error=${formatPercentage(s.avgError)}`);
  }

  // 5. Analyze specific scenarios
  console.log('\nScenario analysis:');

  // Find scenarios with highest errors
  const highErrorScenarios = [...results].sort((a, b) => b.verification.errorPercentage - a.verification.errorPercentage).slice(0, 3);
  console.log('\n  Highest error scenarios:');
  for (const s of highErrorScenarios) {
    const expectedWealthDiff = s.verification.expectedWealthDiff;
    const actualWealthDiff = s.verification.actualWealthDiff;
    console.log(`    ${s.presetName}: ${formatPercentage(s.verification.errorPercentage)} error`);
    console.log(`      Expected: ${formatCurrencyOrNA(expectedWealthDiff)}`);
    console.log(`      Actual: ${formatCurrencyOrNA(actualWealthDiff)}`);
    if (typeof expectedWealthDiff === 'number' && typeof actualWealthDiff === 'number') {
      console.log(`      Difference: ${formatCurrency(actualWealthDiff - expectedWealthDiff)}`);
    } else {
      console.log('      Difference: N/A');
    }

    // List key parameters
    const params = parameters[s.presetId];
    if (params) {
      console.log('      Key parameters:');
      for (const [key, value] of Object.entries(params)) {
        // Only show parameters that differ from defaults or are particularly relevant
        const isRelevant = ['WEEKLY_INCOME_AVG', 'WEEKLY_FOOD_BUDGET_AVG', 'PERCENT_SPEND_INTERNAL_AVG',
                           'INITIAL_WEALTH_SIGMA_LOG', 'NUM_MEMBERS'].includes(key);
        if (isRelevant) {
          console.log(`        ${key}: ${value}`);
        }
      }
    }
  }

  // Find scenarios with lowest errors
  const lowErrorScenarios = [...results].sort((a, b) => a.verification.errorPercentage - b.verification.errorPercentage).slice(0, 3);
  console.log('\n  Lowest error scenarios:');
  for (const s of lowErrorScenarios) {
    const expectedWealthDiff = s.verification.expectedWealthDiff;
    const actualWealthDiff = s.verification.actualWealthDiff;
    console.log(`    ${s.presetName}: ${formatPercentage(s.verification.errorPercentage)} error`);
    console.log(`      Expected: ${formatCurrencyOrNA(expectedWealthDiff)}`);
    console.log(`      Actual: ${formatCurrencyOrNA(actualWealthDiff)}`);

    // List key parameters
    const params = parameters[s.presetId];
    if (params) {
      console.log('      Key parameters:');
      for (const [key, value] of Object.entries(params)) {
        // Only show parameters that differ from defaults or are particularly relevant
        const isRelevant = ['WEEKLY_INCOME_AVG', 'WEEKLY_FOOD_BUDGET_AVG', 'PERCENT_SPEND_INTERNAL_AVG',
                           'INITIAL_WEALTH_SIGMA_LOG', 'NUM_MEMBERS'].includes(key);
        if (isRelevant) {
          console.log(`        ${key}: ${value}`);
        }
      }
    }
  }

  // 6. Identify patterns in economic stress scenarios
  const stressScenarios = results.filter(r =>
    r.presetName.includes('Economic Downturn') ||
    r.presetName.includes('Severe Economic')
  );
  let suggestedMultiplier = 1;

  if (stressScenarios.length > 0) {
    console.log('\n  Economic stress scenario analysis:');
    const avgStressError = stressScenarios.reduce((sum, r) => sum + r.verification.errorPercentage, 0) / stressScenarios.length;
    console.log(`    Average error: ${formatPercentage(avgStressError)}`);

    // Calculate average income-to-expense ratio
    const avgRatio = stressScenarios.reduce((sum, r) => {
      const params = parameters[r.presetId];
      return sum + (params ? params.WEEKLY_INCOME_AVG / params.WEEKLY_FOOD_BUDGET_AVG : 0);
    }, 0) / stressScenarios.length;

    console.log(`    Average income-to-expense ratio: ${avgRatio.toFixed(2)}`);

    // Calculate correlation between ratio and error
    const ratios = stressScenarios.map(r => {
      const params = parameters[r.presetId];
      return params ? params.WEEKLY_INCOME_AVG / params.WEEKLY_FOOD_BUDGET_AVG : 0;
    });

    const stressErrors = stressScenarios.map(r => r.verification.errorPercentage);
    const ratioErrorCorrelation = calculateCorrelation(ratios, stressErrors);

    console.log(`    Correlation between income-to-expense ratio and error: ${ratioErrorCorrelation.toFixed(2)}`);

    // Suggest adjustment factor
    const stressPairs = stressScenarios.flatMap((r) => {
      const expected = r.verification.expectedWealthDiff;
      const actual = r.verification.actualWealthDiff;
      return typeof expected === 'number' && typeof actual === 'number' && expected !== 0
        ? [{ expected, actual }]
        : [];
    });
    if (stressPairs.length > 0) {
      const avgExpectedDiff = stressPairs.reduce((sum, pair) => sum + pair.expected, 0) / stressPairs.length;
      const avgActualDiff = stressPairs.reduce((sum, pair) => sum + pair.actual, 0) / stressPairs.length;
      suggestedMultiplier = avgExpectedDiff !== 0 ? (avgActualDiff / avgExpectedDiff) : 1;

      console.log(`    Suggested stress factor multiplier: ${suggestedMultiplier.toFixed(2)}x`);
      console.log('    This would adjust the current stress factor to account for the observed non-linear benefits.');
    } else {
      console.log('    Suggested stress factor multiplier: N/A (missing expected/actual wealth deltas)');
    }
  }

  // 7. Provide recommendations
  console.log('\nRecommendations:');

  // Identify parameters with highest correlation to errors
  const highCorrelationParams = sensitivities
    .filter(s => Math.abs(s.correlation) > 0.3)
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  if (highCorrelationParams.length > 0) {
    console.log('\n  Parameters to focus on:');
    for (const p of highCorrelationParams) {
      const direction = p.correlation > 0 ? 'increases' : 'decreases';
      console.log(`    - ${p.parameter}: Higher values ${direction} error (correlation: ${p.correlation.toFixed(2)})`);
    }
  }

  // Check if economic stress is a major factor
  const hasStressIssues = stressScenarios.length > 0 &&
    stressScenarios.every(s => s.verification.errorPercentage > 0.5);

  if (hasStressIssues) {
    console.log('\n  Economic stress adjustment:');
    console.log('    - Increase the stress factor multiplier in the mathematical model');
    console.log('    - Consider using a non-linear function for stress benefits');
    console.log(`    - Suggested multiplier: ${suggestedMultiplier.toFixed(2)}x current value`);
  }

  // Check if community size is a factor
  const sizeParam = sensitivities.find(s => s.parameter === 'NUM_MEMBERS');
  if (sizeParam && Math.abs(sizeParam.correlation) > 0.3) {
    console.log('\n  Community size adjustment:');
    console.log('    - Refine the size factor calculation in the mathematical model');
    console.log('    - Consider using a non-linear function for community size benefits');
  }

  return {
    passRate,
    sensitivities,
    highErrorScenarios,
    lowErrorScenarios,
    recommendations: {
      focusParameters: highCorrelationParams.map(p => p.parameter),
      needsStressAdjustment: hasStressIssues,
      suggestedStressMultiplier: suggestedMultiplier
    }
  };
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;

  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  // Calculate covariance and variances
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = x[i] - xMean;
    const yDiff = y[i] - yMean;
    covariance += xDiff * yDiff;
    xVariance += xDiff * xDiff;
    yVariance += yDiff * yDiff;
  }

  // Calculate correlation
  if (xVariance === 0 || yVariance === 0) return 0;
  return covariance / Math.sqrt(xVariance * yVariance);
}

/**
 * Group array elements by a key function
 */
function groupBy<T>(array: T[], keyFn: (item: T) => unknown): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = String(keyFn(item));
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Run the test analysis and apply the recommended adjustments to the model
 */
export function applyTestAnalysisRecommendations(
  results: TestResult[],
  parameters: Record<string, TestParameters>,
  applyChanges = false
) {
  const analysis = analyzeTestResults(results, parameters);

  if (!applyChanges) {
    console.log('\nTo apply these recommendations, call this function with applyChanges=true');
    return analysis;
  }

  console.log('\n=== APPLYING RECOMMENDATIONS ===');

  // Generate model adjustments
  const adjustments = adjustMathematicalModel(analysis);

  // Apply the adjustments
  if (adjustments.length > 0) {
    applyModelAdjustments(adjustments);
  } else {
    console.log('\nNo model adjustments needed.');
  }

  return analysis;
}
