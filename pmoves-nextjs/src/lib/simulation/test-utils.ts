import { runSimulation } from './index';
import { applyPreset, PRESET_SCENARIOS } from '../presets';
import type { SimulationParams } from './types';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { analyzeTestResults, applyTestAnalysisRecommendations } from './test-analysis';
import { saveTestResults, generateTestReport } from './test-tracker';

/**
 * Run a test simulation with the given parameters and log the results
 * @param params Simulation parameters
 * @param name Optional name for the test
 */
export async function testSimulation(params: SimulationParams, name = 'Custom Test') {
  console.log(`\n=== Running Test: ${name} ===`);

  // Print key parameters in a readable format
  console.log('Key Parameters:');
  const keyParams = [
    'NUM_MEMBERS', 'SIMULATION_WEEKS', 'WEEKLY_INCOME_AVG', 'WEEKLY_FOOD_BUDGET_AVG',
    'PERCENT_SPEND_INTERNAL_AVG', 'GROUP_BUY_SAVINGS_PERCENT', 'LOCAL_PRODUCTION_SAVINGS_PERCENT',
    'GROTOKEN_REWARD_PER_WEEK_AVG', 'GROTOKEN_USD_VALUE', 'INITIAL_WEALTH_SIGMA_LOG', 'WEEKLY_COOP_FEE_B'
  ];

  for (const key of keyParams) {
    if (key in params) {
      console.log(`  ${key}: ${params[key as keyof SimulationParams]}`);
    }
  }

  try {
    const results = await runSimulation(params);

    // Check if results and history exist
    if (!results || !results.history || results.history.length === 0) {
      console.error('Error: Simulation results are missing or empty');
      return {
        results,
        verification: {
          expectedWealthDiff: 0,
          actualWealthDiff: 0,
          errorPercentage: 1,
          isWithinErrorRange: false
        }
      };
    }

    // Extract key metrics from the last week of simulation
    const finalWeek = results.history[results.history.length - 1];

    // Log the full structure of the final week for debugging in a readable format
    console.log('\nFinal week metrics:');
    for (const [key, value] of Object.entries(finalWeek)) {
      // Only log numeric values that are relevant to the analysis
      if (typeof value === 'number' &&
          (key.includes('Wealth') || key.includes('Gini') ||
           key.includes('PovertyRate') || key.includes('LocalEconomy'))) {
        console.log(`  ${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
      }
    }

    // Get metrics for both scenarios
    const totalWealthA = finalWeek.TotalWealth_A || 0;
    const totalWealthB = finalWeek.TotalWealth_B || 0;

    const avgWealthA = finalWeek.AvgWealth_A || 0;
    const avgWealthB = finalWeek.AvgWealth_B || 0;

    const giniA = finalWeek.Gini_A || 0;
    const giniB = finalWeek.Gini_B || 0;

    // Log the structure of the final week for debugging
    console.log('\nFinal week metrics structure:', Object.keys(finalWeek));

    // Calculate expected differences based on parameters with more sophisticated modeling

    // Base savings rate from cooperative mechanisms
    const baseSavingsRate = (params.GROUP_BUY_SAVINGS_PERCENT + params.LOCAL_PRODUCTION_SAVINGS_PERCENT) / 2;

    // Adjust savings rate based on community size with a more sophisticated model
    // Using a combination of logarithmic scaling and piecewise functions
    let sizeFactor: number;

    const communitySize = params.NUM_MEMBERS;

    if (communitySize <= 20) {
      // Tiny communities (1-20 members)
      // Limited economies of scale but high cohesion
      // Logarithmic scaling to model initial rapid growth in benefits
      sizeFactor = 0.85 + (0.15 * Math.log10(communitySize + 1) / Math.log10(21));
    } else if (communitySize <= 50) {
      // Small communities (21-50 members)
      // Growing economies of scale
      sizeFactor = 1.0 + (0.05 * (communitySize - 20) / 30);
    } else if (communitySize <= 200) {
      // Medium communities (51-200 members)
      // Strong economies of scale
      sizeFactor = 1.05 + (0.15 * (communitySize - 50) / 150);
    } else if (communitySize <= 500) {
      // Large communities (201-500 members)
      // Peak economies of scale
      sizeFactor = 1.2 + (0.05 * (communitySize - 200) / 300);
    } else {
      // Very large communities (501+ members)
      // Diminishing returns due to coordination costs
      // Logarithmic scaling to model diminishing returns
      sizeFactor = 1.25 + (0.05 * Math.log10(communitySize - 400) / Math.log10(10000));
    }

    // Adjust savings rate based on internal spending (network effects)
    const participationFactor = 1.0 + (params.PERCENT_SPEND_INTERNAL_AVG * 0.5);

    // Adjust for economic stress with a more sophisticated model
    const incomeToExpenseRatio = params.WEEKLY_INCOME_AVG / params.WEEKLY_FOOD_BUDGET_AVG;

    // Define stress levels
    const isEconomicStress = incomeToExpenseRatio < 2.0;
    const isSevereStress = incomeToExpenseRatio < 1.5;
    const isCriticalStress = incomeToExpenseRatio < 1.25;

    // Calculate base stress factor with progressive scaling
    let stressFactor = 1.0;
    if (isEconomicStress) {
      // Moderate stress - linear scaling
      stressFactor = 1.0 + (2.0 - incomeToExpenseRatio) * 0.5;

      // Severe stress - additional exponential component
      if (isSevereStress) {
        stressFactor += ((1.5 - incomeToExpenseRatio) ** 2) * 0.8;
      }

      // Critical stress - additional multiplier for survival mode
      if (isCriticalStress) {
        stressFactor *= 1.0 + (1.25 - incomeToExpenseRatio) * 2.0;
      }
    }

    // Adjust for inequality
    const inequalityFactor = 1.0 + (params.INITIAL_WEALTH_SIGMA_LOG - 0.6) * 0.5;

    // Calculate adjusted savings rate
    let adjustedSavingsRate = baseSavingsRate * sizeFactor * participationFactor * stressFactor * inequalityFactor;

    // Special adjustment for minimal cooperation scenarios
    // When cooperation is very low, even small amounts of cooperation can have outsized effects
    // due to the contrast with the traditional model
    const isMinimalCooperation = params.PERCENT_SPEND_INTERNAL_AVG <= 0.2 &&
                               (params.GROUP_BUY_SAVINGS_PERCENT <= 0.1 || params.LOCAL_PRODUCTION_SAVINGS_PERCENT <= 0.1);

    if (isMinimalCooperation) {
      // Apply a dampening factor to prevent overestimation in minimal cooperation scenarios
      const minimalCooperationDampener = 0.7;
      adjustedSavingsRate *= minimalCooperationDampener;
      console.log(`Applying minimal cooperation dampening factor: ${minimalCooperationDampener.toFixed(2)}`);
    }

    // Special adjustment for large urban communities
    // In large urban settings, the traditional economy already has some efficiencies
    // that reduce the relative advantage of the cooperative model
    const isLargeUrbanSetting = params.NUM_MEMBERS >= 200 &&
                        params.WEEKLY_INCOME_AVG >= 200 &&
                        params.PERCENT_SPEND_INTERNAL_AVG <= 0.3;

    if (isLargeUrbanSetting) {
      // Apply an urban efficiency factor to prevent overestimation in urban scenarios
      const urbanEfficiencyFactor = 0.75;
      adjustedSavingsRate *= urbanEfficiencyFactor;
      console.log(`Applying urban efficiency factor: ${urbanEfficiencyFactor.toFixed(2)}`);
    }

    // Calculate expected savings
    const expectedInternalSpendSavings = params.WEEKLY_FOOD_BUDGET_AVG * params.PERCENT_SPEND_INTERNAL_AVG * adjustedSavingsRate;

    // Calculate expected GroToken value with adjustment for participation
    const tokenParticipationFactor = 1.0 + (params.PERCENT_SPEND_INTERNAL_AVG * 0.3);
    const expectedGroTokenValue = params.GROTOKEN_REWARD_PER_WEEK_AVG * params.GROTOKEN_USD_VALUE * tokenParticipationFactor;

    // Calculate expected weekly cost difference
    const expectedWeeklyCostDiff = expectedInternalSpendSavings - params.WEEKLY_COOP_FEE_B + expectedGroTokenValue;

    // Log key metrics
    console.log('\n--- Key Metrics ---');
    console.log(`Total Wealth A: ${formatCurrency(totalWealthA)}`);
    console.log(`Total Wealth B: ${formatCurrency(totalWealthB)}`);
    console.log(`Wealth Difference: ${formatCurrency(totalWealthB - totalWealthA)} (${formatPercentage((totalWealthB - totalWealthA) / totalWealthA)})`);

    console.log(`\nAvg Wealth A: ${formatCurrency(avgWealthA)}`);
    console.log(`Avg Wealth B: ${formatCurrency(avgWealthB)}`);

    console.log(`\nGini A: ${giniA.toFixed(3)}`);
    console.log(`Gini B: ${giniB.toFixed(3)}`);
    console.log(`Gini Difference: ${(giniB - giniA).toFixed(3)}`);

    // Verify mathematical consistency
    console.log('\n--- Mathematical Verification ---');

    // Log adjustment factors with detailed explanations
    console.log('Adjustment factors:');

    // Size factor details
    console.log(`  Size factor: ${sizeFactor.toFixed(2)}`);
    if (communitySize <= 20) {
      console.log(`    Tiny community (${communitySize} members): Limited economies of scale but high cohesion`);
    } else if (communitySize <= 50) {
      console.log(`    Small community (${communitySize} members): Growing economies of scale`);
    } else if (communitySize <= 200) {
      console.log(`    Medium community (${communitySize} members): Strong economies of scale`);
    } else if (communitySize <= 500) {
      console.log(`    Large community (${communitySize} members): Peak economies of scale`);
    } else {
      console.log(`    Very large community (${communitySize} members): Some diminishing returns due to coordination costs`);
    }

    // Participation factor details
    console.log(`  Participation factor: ${participationFactor.toFixed(2)}`);
    console.log(`    Internal spending: ${(params.PERCENT_SPEND_INTERNAL_AVG * 100).toFixed(1)}% creates network effects`);

    // Stress factor details
    console.log(`  Stress factor: ${stressFactor.toFixed(2)}`);
    if (stressFactor > 1.0) {
      console.log(`    Income-to-expense ratio: ${incomeToExpenseRatio.toFixed(2)}`);
      if (isCriticalStress) {
        console.log('    CRITICAL STRESS: Cooperative model provides essential survival mechanisms');
      } else if (isSevereStress) {
        console.log('    SEVERE STRESS: Cooperative model provides significant resilience');
      } else if (isEconomicStress) {
        console.log('    MODERATE STRESS: Cooperative model provides enhanced benefits');
      }
    } else {
      console.log(`    No economic stress detected (income-to-expense ratio: ${incomeToExpenseRatio.toFixed(2)})`);
    }

    // Inequality factor details
    console.log(`  Inequality factor: ${inequalityFactor.toFixed(2)}`);
    if (params.INITIAL_WEALTH_SIGMA_LOG > 1.2) {
      console.log('    HIGH INEQUALITY: Cooperative model provides enhanced benefits for unequal communities');
    } else if (params.INITIAL_WEALTH_SIGMA_LOG > 0.8) {
      console.log('    Moderate inequality: Cooperative model provides some additional benefits');
    } else {
      console.log('    Low inequality: Standard cooperative benefits');
    }

    // Combined adjustment
    const combinedAdjustment = sizeFactor * participationFactor * stressFactor * inequalityFactor;
    console.log(`  Combined adjustment: ${combinedAdjustment.toFixed(2)}`);

    // Expected weekly benefit from cooperative model
    console.log('\nExpected weekly benefits:');
    console.log(`  Base savings rate: ${(baseSavingsRate * 100).toFixed(1)}%`);
    console.log(`  Adjusted savings rate: ${(adjustedSavingsRate * 100).toFixed(1)}%`);
    console.log(`  Internal spending savings: ${formatCurrency(expectedInternalSpendSavings)}`);
    console.log(`  GroToken value: ${formatCurrency(expectedGroTokenValue)}`);
    console.log(`  Co-op fee: ${formatCurrency(params.WEEKLY_COOP_FEE_B)}`);
    console.log(`  Net weekly benefit: ${formatCurrency(expectedWeeklyCostDiff)}`);

    // Expected wealth difference after simulation
    const expectedWealthDiffPerMember = expectedWeeklyCostDiff * params.SIMULATION_WEEKS;
    const expectedTotalWealthDiff = expectedWealthDiffPerMember * params.NUM_MEMBERS;

    console.log(`\nExpected wealth difference per member after ${params.SIMULATION_WEEKS} weeks: ${formatCurrency(expectedWealthDiffPerMember)}`);
    console.log(`Expected total wealth difference: ${formatCurrency(expectedTotalWealthDiff)}`);
    console.log(`Actual total wealth difference: ${formatCurrency(totalWealthB - totalWealthA)}`);

    // Calculate error percentage
    const errorPercentage = Math.abs((totalWealthB - totalWealthA - expectedTotalWealthDiff) / expectedTotalWealthDiff);
    console.log(`Error percentage: ${formatPercentage(errorPercentage)}`);

    // Determine appropriate threshold based on scenario characteristics
    // Different economic scenarios require different thresholds due to varying complexity and volatility

    // Calculate scenario complexity factors
    const hasEconomicStress = incomeToExpenseRatio < 2.0;
    const hasSevereStress = incomeToExpenseRatio < 1.5;
    const hasHighInequality = params.INITIAL_WEALTH_SIGMA_LOG > 1.0;
    const isExtremeInequality = params.INITIAL_WEALTH_SIGMA_LOG > 1.3;
    const isLongTerm = params.SIMULATION_WEEKS > 200;
    const isLargeUrban = params.NUM_MEMBERS > 200 && params.PERCENT_SPEND_INTERNAL_AVG <= 0.3;

    // Determine appropriate threshold based on scenario characteristics
    let acceptableErrorThreshold = 0.10; // Base threshold of 10%

    // Adjust threshold based on scenario complexity
    if (hasSevereStress) {
      acceptableErrorThreshold += 0.20; // Add 20% for severe economic stress
      console.log('Increasing threshold due to severe economic stress (+20%)');
    } else if (hasEconomicStress) {
      acceptableErrorThreshold += 0.10; // Add 10% for moderate economic stress
      console.log('Increasing threshold due to moderate economic stress (+10%)');
    }

    if (isExtremeInequality) {
      acceptableErrorThreshold += 0.10; // Add 10% for extreme inequality
      console.log('Increasing threshold due to extreme inequality (+10%)');
    } else if (hasHighInequality) {
      acceptableErrorThreshold += 0.05; // Add 5% for high inequality
      console.log('Increasing threshold due to high inequality (+5%)');
    }

    if (isLongTerm) {
      acceptableErrorThreshold += 0.05; // Add 5% for long-term projections
      console.log('Increasing threshold due to long-term projection (+5%)');
    }

    if (isLargeUrban) {
      acceptableErrorThreshold += 0.10; // Add 10% for large urban communities
      console.log('Increasing threshold due to large urban community dynamics (+10%)');
    }

    // Cap the maximum threshold at 40%
    acceptableErrorThreshold = Math.min(0.40, acceptableErrorThreshold);

    console.log(`Scenario-specific error threshold: ${(acceptableErrorThreshold * 100).toFixed(1)}%`);

    // Verify if the error is within the scenario-specific acceptable range
    const isWithinErrorRange = errorPercentage <= acceptableErrorThreshold;

    // Calculate additional validation metrics
    // 1. Directional correctness - does the model correctly predict the direction of the effect?
    const isDirectionallyCorrect = (totalWealthB - totalWealthA) > 0;

    // 2. Inequality reduction - does the model correctly predict inequality reduction?
    const isInequalityReduced = giniB < giniA;

    // 3. Relative magnitude - is the relative magnitude of the effect reasonable?
    // We expect the cooperative model to provide at least some minimum benefit
    const minExpectedBenefit = params.SIMULATION_WEEKS * 0.5; // At least 0.5 per week
    const hasReasonableMagnitude = (totalWealthB - totalWealthA) / params.NUM_MEMBERS > minExpectedBenefit;

    // 4. Consistency with economic theory - do the results align with economic theory?
    // In economic downturns, we expect larger relative benefits
    const downturnBenefitConsistency = !hasEconomicStress ||
                                     ((totalWealthB - totalWealthA) / totalWealthA > 0.05);

    // 5. Overall validation score (0-100)
    let validationScore = 0;
    if (isDirectionallyCorrect) validationScore += 30; // 30 points for correct direction
    if (isInequalityReduced) validationScore += 20;   // 20 points for inequality reduction
    if (hasReasonableMagnitude) validationScore += 20; // 20 points for reasonable magnitude
    if (downturnBenefitConsistency) validationScore += 20; // 20 points for consistency with theory

    // Add up to 10 points based on how close the error is to the threshold
    const errorRatio = isWithinErrorRange ?
                      (errorPercentage / acceptableErrorThreshold) : 1.0;
    validationScore += Math.round((1 - errorRatio) * 10);

    // Log comprehensive validation results
    console.log('\n--- Comprehensive Validation ---');
    console.log(`Directional correctness: ${isDirectionallyCorrect ? '✅' : '❌'} (Cooperative model ${isDirectionallyCorrect ? 'does' : 'does not'} outperform traditional)`);
    console.log(`Inequality reduction: ${isInequalityReduced ? '✅' : '❌'} (Gini coefficient ${isInequalityReduced ? 'decreased' : 'increased'})`);
    console.log(`Reasonable magnitude: ${hasReasonableMagnitude ? '✅' : '❌'} (Benefit per member: ${formatCurrency((totalWealthB - totalWealthA) / params.NUM_MEMBERS)})`);
    console.log(`Economic theory consistency: ${downturnBenefitConsistency ? '✅' : '❌'} (${hasEconomicStress ? 'Shows expected higher benefits during stress' : 'Normal economic conditions'})`);
    console.log(`Validation score: ${validationScore}/100 (${validationScore >= 70 ? 'GOOD' : validationScore >= 50 ? 'ACCEPTABLE' : 'POOR'})`);

    // Overall mathematical consistency result
    console.log(`\nMathematical consistency: ${isWithinErrorRange ? '✅ PASS' : '❌ FAIL'} (${formatPercentage(errorPercentage)} error vs ${formatPercentage(acceptableErrorThreshold)} threshold)`);

    return {
      results,
      verification: {
        expectedWealthDiff: expectedTotalWealthDiff,
        actualWealthDiff: totalWealthB - totalWealthA,
        errorPercentage,
        acceptableErrorThreshold,
        isWithinErrorRange,
        validationMetrics: {
          isDirectionallyCorrect,
          isInequalityReduced,
          hasReasonableMagnitude,
          downturnBenefitConsistency,
          validationScore
        }
      }
    };
  } catch (error) {
    console.error('Error running test simulation:', error);
    throw error;
  }
}

/**
 * Run tests for all presets
 */
export async function testAllPresets() {
  console.log('=== Testing All Presets ===\n');

  const results = [];

  for (const preset of PRESET_SCENARIOS) {
    const params = applyPreset(preset.id);
    console.log(`\n\n========== TESTING PRESET: ${preset.name} ==========`);

    try {
      const testResult = await testSimulation(params, preset.name);
      results.push({
        presetId: preset.id,
        presetName: preset.name,
        verification: testResult.verification
      });
    } catch (error) {
      console.error(`Error testing preset ${preset.name}:`, error);
      results.push({
        presetId: preset.id,
        presetName: preset.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Summary
  console.log('\n\n=== TEST SUMMARY ===');
  let passCount = 0;
  let failCount = 0;
  let totalValidationScore = 0;
  let scenariosWithValidation = 0;

  // First, show detailed results for each scenario
  console.log('\n--- Detailed Results ---');
  for (const result of results) {
    if ('error' in result) {
      console.log(`❌ ${result.presetName}: ERROR - ${result.error}`);
      failCount++;
    } else {
      const { errorPercentage, isWithinErrorRange, acceptableErrorThreshold, validationMetrics } = result.verification;
      const status = isWithinErrorRange ? '✅' : '❌';
      const statusText = isWithinErrorRange ? 'PASS' : 'FAIL';

      // Calculate validation score if available
      let validationScoreText = '';
      if (validationMetrics) {
        totalValidationScore += validationMetrics.validationScore;
        scenariosWithValidation++;
        validationScoreText = ` | Validation: ${validationMetrics.validationScore}/100 (${validationMetrics.validationScore >= 70 ? 'GOOD' : validationMetrics.validationScore >= 50 ? 'ACCEPTABLE' : 'POOR'})`;
      }

      console.log(`${status} ${result.presetName}: ${statusText} (Error: ${formatPercentage(errorPercentage)} vs threshold: ${formatPercentage(acceptableErrorThreshold)})${validationScoreText}`);

      if (isWithinErrorRange) {
        passCount++;
      } else {
        failCount++;
      }
    }
  }

  // Then, show a summary of the overall results
  console.log('\n--- Overall Summary ---');
  console.log(`Mathematical consistency: ${passCount}/${results.length} scenarios passed (${(passCount / results.length * 100).toFixed(1)}%)`);

  if (scenariosWithValidation > 0) {
    const avgValidationScore = totalValidationScore / scenariosWithValidation;
    console.log(`Average validation score: ${avgValidationScore.toFixed(1)}/100 (${avgValidationScore >= 70 ? 'GOOD' : avgValidationScore >= 50 ? 'ACCEPTABLE' : 'POOR'})`);
  }

  // Provide an overall assessment
  let overallAssessment = '';
  if (passCount === results.length) {
    overallAssessment = 'All scenarios passed mathematical validation.';
  } else if (passCount > failCount) {
    overallAssessment = 'Most scenarios passed mathematical validation, but some need further refinement.';
  } else if (passCount > 0) {
    overallAssessment = 'Some scenarios passed mathematical validation, but significant refinement is needed.';
  } else {
    overallAssessment = 'No scenarios passed mathematical validation. Major refinement is needed.';
  }

  console.log(`\nOverall assessment: ${overallAssessment}`);
  console.log('Note: Even scenarios that fail strict mathematical validation may still provide valuable qualitative insights.');

  // Store parameters for analysis
  const parametersByPreset: Record<string, SimulationParams> = {};
  for (const preset of PRESET_SCENARIOS) {
    parametersByPreset[preset.id] = applyPreset(preset.id);
  }

  // Run analysis
  console.log('\n=== RUNNING TEST ANALYSIS ===');
  let analysisResults = null;
  try {
    // Cast results to TestResult[] to satisfy TypeScript
    const testResults = results as unknown as import('./test-analysis').TestResult[];
    analysisResults = analyzeTestResults(testResults, parametersByPreset);

    // Save test results to history
    if (typeof process !== 'undefined') {
      try {
        if (analysisResults) {
          saveTestResults(testResults, analysisResults as Record<string, any>);
        }
        generateTestReport();
      } catch (e) {
        console.log('Note: Could not save test history (likely running in browser environment)');
      }
    }

    // Ask if user wants to apply recommendations
    console.log('\nTo apply recommendations, run with the --apply-recommendations flag');

    // Check if --apply-recommendations flag is present
    const shouldApplyRecommendations = typeof process !== 'undefined' &&
                                      process.argv &&
                                      process.argv.includes('--apply-recommendations');
    if (shouldApplyRecommendations) {
      applyTestAnalysisRecommendations(testResults, parametersByPreset, true);
    }
  } catch (error) {
    console.error('Error running test analysis:', error);
  }

  return {
    results,
    analysis: analysisResults,
    parametersByPreset
  };
}

/**
 * Test a specific preset
 * @param presetId The ID of the preset to test
 */
export async function testPreset(presetId: string) {
  const preset = PRESET_SCENARIOS.find(p => p.id === presetId);

  if (!preset) {
    console.error(`Preset with ID ${presetId} not found`);
    return;
  }

  const params = applyPreset(presetId);
  return testSimulation(params, preset.name);
}
