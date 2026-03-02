// Browser-compatible version - no direct file system access
// We'll use localStorage for browser environment
import type { TestResult } from './test-analysis';

interface TestHistoryEntry {
  timestamp: string;
  passRate: number;
  results: {
    presetId: string;
    presetName: string;
    errorPercentage: number;
    isWithinErrorRange: boolean;
  }[];
  recommendations?: string[];
}

/**
 * Save test results to history file
 */
export function saveTestResults(results: TestResult[], analysis: Record<string, any>) {
  try {
    // Browser environment check
    if (typeof window === 'undefined') {
      console.log('Not in browser environment, skipping test history storage');
      return false;
    }

    // Create history entry
    const passCount = results.filter(r =>
      r.verification?.isWithinErrorRange
    ).length;
    const passRate = passCount / results.length;

    const entry: TestHistoryEntry = {
      timestamp: new Date().toISOString(),
      passRate,
      results: results.map(r => ({
        presetId: r.presetId,
        presetName: r.presetName,
        errorPercentage: r.verification ? r.verification.errorPercentage : 1,
        isWithinErrorRange: r.verification ? r.verification.isWithinErrorRange : false
      })),
      recommendations: analysis?.recommendations?.focusParameters || []
    };

    // Save to localStorage
    let history: TestHistoryEntry[] = [];
    const storedHistory = localStorage.getItem('test-history');

    if (storedHistory) {
      history = JSON.parse(storedHistory);
    }

    history.push(entry);
    localStorage.setItem('test-history', JSON.stringify(history));

    console.log('Test results saved to localStorage');

    // Generate comparison with previous run
    if (history.length > 1) {
      const current = history[history.length - 1];
      const previous = history[history.length - 2];

      console.log('\n=== COMPARISON WITH PREVIOUS RUN ===');
      console.log(`Previous pass rate: ${(previous.passRate * 100).toFixed(1)}%`);
      console.log(`Current pass rate: ${(current.passRate * 100).toFixed(1)}%`);
      console.log(`Change: ${((current.passRate - previous.passRate) * 100).toFixed(1)}%`);

      // Compare individual scenarios
      console.log('\nScenario changes:');
      for (const currentResult of current.results) {
        const previousResult = previous.results.find(r => r.presetId === currentResult.presetId);
        if (previousResult) {
          const errorChange = currentResult.errorPercentage - previousResult.errorPercentage;
          const statusChange = currentResult.isWithinErrorRange !== previousResult.isWithinErrorRange
            ? (currentResult.isWithinErrorRange ? 'FIXED' : 'BROKEN')
            : '';

          if (Math.abs(errorChange) > 0.01 || statusChange) {
            const changeSymbol = errorChange > 0 ? '↑' : errorChange < 0 ? '↓' : '→';
            console.log(`  ${currentResult.presetName}: ${(previousResult.errorPercentage * 100).toFixed(1)}% → ${(currentResult.errorPercentage * 100).toFixed(1)}% (${changeSymbol} ${Math.abs(errorChange * 100).toFixed(1)}%) ${statusChange}`);
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving test results:', error);
    return false;
  }
}

/**
 * Get test history
 */
export function getTestHistory(): TestHistoryEntry[] {
  try {
    // Browser environment check
    if (typeof window === 'undefined') {
      console.log('Not in browser environment, cannot access test history');
      return [];
    }

    const storedHistory = localStorage.getItem('test-history');
    if (storedHistory) {
      return JSON.parse(storedHistory);
    }
    return [];
  } catch (error) {
    console.error('Error reading test history:', error);
    return [];
  }
}

/**
 * Generate test history report
 */
export function generateTestReport() {
  try {
    // Browser environment check
    if (typeof window === 'undefined') {
      console.log('Not in browser environment, cannot generate test report');
      return false;
    }

    const history = getTestHistory();
    if (history.length === 0) {
      console.log('No test history found.');
      return false;
    }

    console.log('\n=== TEST HISTORY REPORT ===');
    console.log(`Total runs: ${history.length}`);

    // Pass rate trend
    console.log('\nPass rate trend:');
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      console.log(`  Run ${i + 1} (${new Date(entry.timestamp).toLocaleDateString()}): ${(entry.passRate * 100).toFixed(1)}%`);
    }

    // Most problematic scenarios
    console.log('\nMost problematic scenarios:');
    const scenarioCounts: Record<string, { failures: number, runs: number }> = {};

    for (const entry of history) {
      for (const result of entry.results) {
        if (!scenarioCounts[result.presetId]) {
          scenarioCounts[result.presetId] = { failures: 0, runs: 0 };
        }

        scenarioCounts[result.presetId].runs++;
        if (!result.isWithinErrorRange) {
          scenarioCounts[result.presetId].failures++;
        }
      }
    }

    const problemScenarios = Object.entries(scenarioCounts)
      .map(([presetId, counts]) => ({
        presetId,
        presetName: history[0].results.find(r => r.presetId === presetId)?.presetName || presetId,
        failRate: counts.failures / counts.runs
      }))
      .sort((a, b) => b.failRate - a.failRate)
      .slice(0, 5);

    for (const scenario of problemScenarios) {
      console.log(`  ${scenario.presetName}: ${(scenario.failRate * 100).toFixed(1)}% failure rate`);
    }

    // Most common recommendations
    if (history.some(h => (h.recommendations?.length ?? 0) > 0)) {
      console.log('\nMost common recommendations:');
      const recommendationCounts: Record<string, number> = {};

      for (const entry of history) {
        if (entry.recommendations) {
          for (const recommendation of entry.recommendations) {
            recommendationCounts[recommendation] = (recommendationCounts[recommendation] || 0) + 1;
          }
        }
      }

      const topRecommendations = Object.entries(recommendationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      for (const [recommendation, count] of topRecommendations) {
        console.log(`  ${recommendation}: ${count} occurrences (${(count / history.length * 100).toFixed(1)}% of runs)`);
      }
    }

    return true;
  } catch (error) {
    console.error('Error generating test report:', error);
    return false;
  }
}
