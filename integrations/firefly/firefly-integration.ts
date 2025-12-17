/**
 * Firefly-iii Integration Coordinator
 *
 * Orchestrates the complete integration pipeline:
 * 1. Fetch real data from Firefly-iii
 * 2. Transform data for simulation
 * 3. Run baseline simulation
 * 4. Calibrate models based on real data
 * 5. Run calibrated simulation
 * 6. Generate comparison reports
 */

import FireflyClient from './firefly-client';
import FireflyDataTransformer, { TransformedData } from './data-transformer';
import { ProjectionValidator } from '../projections/projection-validator';
import CalibrationEngine, { CalibrationReport } from '../projections/calibration-engine';
import { ProjectionModel, SimulationResults } from '../projections/projection-validator';
import { natsClient, NATSClient } from '../nats/nats-client';
import * as fs from 'fs';
import * as path from 'path';

export interface IntegrationConfig {
  firefly: {
    baseUrl: string;
    apiToken: string;
  };
  analysis: {
    startDate: Date;
    endDate: Date;
    totalPopulation: number;
  };
  output: {
    directory: string;
    generateCSV: boolean;
    generateMarkdown: boolean;
  };
  nats?: {
    enabled: boolean;
    publishResults: boolean;
  };
}

export interface IntegrationResult {
  actual: TransformedData;
  baseline: {
    model: ProjectionModel;
    results: SimulationResults;
  };
  calibrated: {
    model: ProjectionModel;
    results: SimulationResults;
    calibration: CalibrationReport;
  };
}

export class FireflyIntegration {
  private client: FireflyClient;
  private transformer: FireflyDataTransformer;
  private validator: ProjectionValidator;
  private calibrator: CalibrationEngine;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.client = new FireflyClient({
      baseUrl: config.firefly.baseUrl,
      apiToken: config.firefly.apiToken,
    });
    this.transformer = new FireflyDataTransformer();
    this.validator = new ProjectionValidator();
    this.calibrator = new CalibrationEngine();
  }

  /**
   * Fetch real spending data from Firefly-iii
   */
  async fetchRealData(): Promise<TransformedData> {
    console.log('\n📊 Fetching real data from Firefly-iii...');

    const { startDate, endDate } = this.config.analysis;

    // Test connection
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Firefly-iii');
    }

    // Fetch transactions
    console.log(
      `   Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
    );
    const transactions = await this.client.getTransactions(startDate, endDate);

    console.log(`   ✅ Retrieved ${transactions.length} transactions`);

    // Transform data
    const transformed = this.transformer.transform(
      transactions,
      this.config.analysis.totalPopulation
    );

    console.log(
      `   ✅ Transformed into ${transformed.weeklySpending.length} weeks of data`
    );
    console.log(
      `   Total spending: $${transformed.totalSpending.toLocaleString()}`
    );
    console.log(
      `   Participation rate: ${(transformed.participation.participationRate * 100).toFixed(1)}%`
    );

    return transformed;
  }

  /**
   * Run baseline simulation
   */
  async runBaselineSimulation(
    model: ProjectionModel
  ): Promise<SimulationResults> {
    console.log('\n🔬 Running baseline simulation...');

    const results = await this.validator.runSimulation(
      model,
      52 // Default to 52 weeks for baseline comparison
    );

    console.log(`   ✅ Simulated 52 weeks`);
    console.log(
      `   Total revenue: $${results.cumulativeRevenue[results.cumulativeRevenue.length - 1].toLocaleString()}`
    );

    return results;
  }

  /**
   * Calibrate model using real data
   */
  async calibrateModel(
    model: ProjectionModel,
    actualData: TransformedData,
    baselineResults: SimulationResults
  ): Promise<CalibrationReport> {
    console.log('\n🎯 Calibrating model with real data...');

    const calibration = await this.calibrator.calibrate(
      model.name,
      actualData,
      baselineResults,
      this.config.analysis.totalPopulation
    );

    console.log(
      `   ✅ Calibration complete (${calibration.overallAccuracy.confidenceLevel.toUpperCase()} confidence)`
    );
    console.log(
      `   Confidence score: ${calibration.overallAccuracy.confidenceScore.toFixed(1)}/100`
    );
    console.log(
      `   Parameters adjusted: ${calibration.parameterAdjustments.length}`
    );
    console.log(
      `   Recommendations: ${calibration.recommendations.length}`
    );

    return calibration;
  }

  /**
   * Run calibrated simulation
   */
  async runCalibratedSimulation(
    model: ProjectionModel,
    calibration: CalibrationReport
  ): Promise<{ model: ProjectionModel; results: SimulationResults }> {
    console.log('\n🔧 Running calibrated simulation...');

    const calibratedModel = this.calibrator.applyCalibration(model, calibration);

    const results = await this.validator.runSimulation(
      calibratedModel,
      52 // Default to 52 weeks
    );

    console.log(`   ✅ Calibrated simulation complete`);

    return { model: calibratedModel, results };
  }

  /**
   * Generate comparison reports
   */
  async generateReports(result: IntegrationResult): Promise<void> {
    console.log('\n📝 Generating reports...');

    const { directory, generateCSV, generateMarkdown } = this.config.output;

    // Create output directory
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // 1. Calibration report (Markdown)
    if (generateMarkdown) {
      const markdownPath = path.join(directory, 'CALIBRATION_REPORT.md');
      const markdown = this.generateMarkdownReport(result);
      fs.writeFileSync(markdownPath, markdown, 'utf-8');
      console.log(`   ✅ Generated: ${markdownPath}`);
    }

    // 2. Category comparison CSV
    if (generateCSV) {
      const categoryPath = path.join(
        directory,
        'category-comparison.csv'
      );
      const categoryCSV = this.generateCategoryComparisonCSV(result);
      fs.writeFileSync(categoryPath, categoryCSV, 'utf-8');
      console.log(`   ✅ Generated: ${categoryPath}`);
    }

    // 3. Parameter adjustments CSV
    if (generateCSV) {
      const paramPath = path.join(directory, 'parameter-adjustments.csv');
      const paramCSV = this.generateParameterAdjustmentsCSV(result);
      fs.writeFileSync(paramPath, paramCSV, 'utf-8');
      console.log(`   ✅ Generated: ${paramPath}`);
    }

    // 4. Weekly comparison CSV
    if (generateCSV) {
      const weeklyPath = path.join(directory, 'weekly-comparison.csv');
      const weeklyCSV = this.generateWeeklyComparisonCSV(result);
      fs.writeFileSync(weeklyPath, weeklyCSV, 'utf-8');
      console.log(`   ✅ Generated: ${weeklyPath}`);
    }

    console.log(`   ✅ All reports generated in: ${directory}`);
  }

  /**
   * Generate Markdown calibration report
   */
  private generateMarkdownReport(result: IntegrationResult): string {
    const cal = result.calibrated.calibration;
    const lines: string[] = [];

    lines.push('# PMOVES Firefly-iii Calibration Report');
    lines.push('');
    lines.push(`**Model:** ${cal.modelName}`);
    lines.push(`**Calibration Date:** ${cal.calibrationDate.toISOString().split('T')[0]}`);
    lines.push(`**Data Period:** ${cal.dataSource.periodStart.toISOString().split('T')[0]} to ${cal.dataSource.periodEnd.toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Overall Accuracy
    lines.push('## Overall Accuracy');
    lines.push('');
    lines.push(`- **Confidence Level:** ${cal.overallAccuracy.confidenceLevel.toUpperCase()}`);
    lines.push(
      `- **Confidence Score:** ${cal.overallAccuracy.confidenceScore.toFixed(1)}/100`
    );
    lines.push(
      `- **Average Variance:** ${cal.overallAccuracy.averageVariance.toFixed(1)}%`
    );
    lines.push(`- **Weeks Analyzed:** ${cal.dataSource.weeksAnalyzed}`);
    lines.push(
      `- **Total Transactions:** ${cal.dataSource.totalTransactions.toLocaleString()}`
    );
    lines.push('');

    // Parameter Adjustments
    lines.push('## Parameter Adjustments');
    lines.push('');
    lines.push('| Parameter | Baseline | Calibrated | Adjustment | Confidence |');
    lines.push('|-----------|----------|------------|------------|------------|');

    cal.parameterAdjustments.forEach((adj) => {
      const adjustSign = adj.adjustmentPercent > 0 ? '+' : '';
      lines.push(
        `| ${adj.parameter} | ${adj.baseline} | ${adj.calibrated} | ${adjustSign}${adj.adjustmentPercent.toFixed(1)}% | ${adj.confidence.toUpperCase()} |`
      );
    });

    lines.push('');

    // Parameter Details
    lines.push('### Parameter Details');
    lines.push('');

    cal.parameterAdjustments.forEach((adj) => {
      lines.push(`#### ${adj.parameter}`);
      lines.push('');
      lines.push(`- **Baseline:** ${adj.baseline}`);
      lines.push(`- **Calibrated:** ${adj.calibrated}`);
      lines.push(
        `- **Adjustment:** ${adj.adjustment > 0 ? '+' : ''}${adj.adjustment} (${adj.adjustmentPercent > 0 ? '+' : ''}${adj.adjustmentPercent.toFixed(1)}%)`
      );
      lines.push(`- **Confidence:** ${adj.confidence.toUpperCase()}`);
      lines.push(`- **Reasoning:** ${adj.reasoning}`);
      lines.push('');
    });

    // Category Comparison
    lines.push('## Category Spending Comparison');
    lines.push('');
    lines.push('| Category | Actual | Simulated | Variance | Variance % |');
    lines.push('|----------|--------|-----------|----------|------------|');

    cal.categoryComparison.forEach((comp) => {
      const varianceSign = comp.variancePercent > 0 ? '+' : '';
      lines.push(
        `| ${comp.category} | $${comp.actual.toFixed(2)} | $${comp.simulated.toFixed(2)} | $${comp.variance.toFixed(2)} | ${varianceSign}${comp.variancePercent.toFixed(1)}% |`
      );
    });

    lines.push('');

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');

    if (cal.recommendations.length === 0) {
      lines.push('No significant adjustments recommended.');
    } else {
      cal.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1}. ${rec}`);
      });
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('**Report generated by PMOVES Firefly-iii Integration**');

    return lines.join('\n');
  }

  /**
   * Generate category comparison CSV
   */
  private generateCategoryComparisonCSV(result: IntegrationResult): string {
    const headers = [
      'Category',
      'Actual',
      'Simulated',
      'Variance',
      'Variance %',
    ];

    const rows = result.calibrated.calibration.categoryComparison.map((comp) => [
      comp.category,
      comp.actual.toFixed(2),
      comp.simulated.toFixed(2),
      comp.variance.toFixed(2),
      comp.variancePercent.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Generate parameter adjustments CSV
   */
  private generateParameterAdjustmentsCSV(result: IntegrationResult): string {
    const headers = [
      'Parameter',
      'Baseline',
      'Calibrated',
      'Adjustment',
      'Adjustment %',
      'Confidence',
      'Reasoning',
    ];

    const rows = result.calibrated.calibration.parameterAdjustments.map(
      (adj) => [
        adj.parameter,
        adj.baseline.toString(),
        adj.calibrated.toString(),
        adj.adjustment.toString(),
        adj.adjustmentPercent.toFixed(2),
        adj.confidence,
        `"${adj.reasoning}"`, // Quote reasoning to handle commas
      ]
    );

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Generate weekly comparison CSV
   */
  private generateWeeklyComparisonCSV(result: IntegrationResult): string {
    const headers = [
      'Week',
      'Start Date',
      'Actual Spending',
      'Baseline Revenue',
      'Calibrated Revenue',
    ];

    const weeks = Math.min(
      result.actual.weeklySpending.length,
      result.baseline.results.weeklyRevenue.length
    );

    const rows: string[][] = [];

    for (let i = 0; i < weeks; i++) {
      const actualWeek = result.actual.weeklySpending[i];
      const baselineRev = result.baseline.results.weeklyRevenue[i];
      const calibratedRev = result.calibrated.results.weeklyRevenue[i];

      rows.push([
        (i + 1).toString(),
        actualWeek.startDate.toISOString().split('T')[0],
        actualWeek.totalSpending.toFixed(2),
        baselineRev.toFixed(2),
        calibratedRev.toFixed(2),
      ]);
    }

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Publish calibration and simulation results to NATS
   */
  private async publishToNATS(result: IntegrationResult): Promise<void> {
    console.log('\n📡 Publishing results to NATS...');

    try {
      await natsClient.connect();

      // Extract calibrated parameters
      const calibratedParams: Record<string, number> = {};
      result.calibrated.calibration.parameterAdjustments.forEach((adj) => {
        calibratedParams[adj.parameter] = adj.calibrated;
      });

      // 1. Publish calibration result
      await natsClient.publish(NATSClient.SUBJECTS.CALIBRATION_RESULT, {
        calibration: {
          modelName: result.calibrated.calibration.modelName,
          confidenceLevel: result.calibrated.calibration.overallAccuracy.confidenceLevel,
          confidenceScore: result.calibrated.calibration.overallAccuracy.confidenceScore,
          averageVariance: result.calibrated.calibration.overallAccuracy.averageVariance,
          parameterAdjustments: result.calibrated.calibration.parameterAdjustments.map((adj) => ({
            parameter: adj.parameter,
            baseline: adj.baseline,
            calibrated: adj.calibrated,
            adjustmentPercent: adj.adjustmentPercent,
            confidence: adj.confidence,
            reasoning: adj.reasoning,
          })),
          categoryComparison: result.calibrated.calibration.categoryComparison,
          dataSource: {
            periodStart: result.calibrated.calibration.dataSource.periodStart,
            periodEnd: result.calibrated.calibration.dataSource.periodEnd,
            weeksAnalyzed: result.calibrated.calibration.dataSource.weeksAnalyzed,
            totalTransactions: result.calibrated.calibration.dataSource.totalTransactions,
          },
        },
        parameters: calibratedParams,
        timestamp: new Date().toISOString(),
        source: 'firefly-integration',
      });

      console.log('   ✅ Published calibration result');

      // 2. Publish simulation result
      const simulationHistory = result.calibrated.results.weeklyRevenue.map(
        (revenue, index) => ({
          week: index + 1,
          revenue,
          cumulativeRevenue: result.calibrated.results.cumulativeRevenue[index],
          activeParticipants: result.calibrated.results.tokenMetrics?.activeParticipants || 0,
        })
      );

      await natsClient.publishSimulationResult({
        simulationId: `calibrated-${Date.now()}`,
        scenario: 'calibrated-from-firefly',
        weeklyHistory: simulationHistory.map((week) => ({
          week: week.week,
          avgWealth: week.cumulativeRevenue,
          gini: 0, // Not calculated in this simulation
          povertyRate: 0, // Not calculated in this simulation
        })),
        finalMetrics: {
          totalWealth: result.calibrated.results.cumulativeRevenue[
            result.calibrated.results.cumulativeRevenue.length - 1
          ],
          wealthGap: 0, // Not calculated in this simulation
          economicVelocity: result.calibrated.results.weeklyRevenue.reduce((sum, r) => sum + r, 0) /
                           result.calibrated.results.weeklyRevenue.length,
        },
        parameters: calibratedParams,
      });

      console.log('   ✅ Published simulation result');
    } catch (error) {
      console.warn('[NATS] Failed to publish (non-fatal):', error);
      console.warn('[NATS] Integration will continue without NATS publishing');
    }
  }

  /**
   * Run complete integration pipeline
   */
  async run(model: ProjectionModel): Promise<IntegrationResult> {
    console.log('\n' + '='.repeat(80));
    console.log('PMOVES FIREFLY-III INTEGRATION');
    console.log('='.repeat(80));

    try {
      // Step 1: Fetch real data
      const actualData = await this.fetchRealData();

      // Step 2: Run baseline simulation
      const baselineResults = await this.runBaselineSimulation(model);

      // Step 3: Calibrate model
      const calibration = await this.calibrateModel(
        model,
        actualData,
        baselineResults
      );

      // Step 4: Run calibrated simulation
      const calibratedSim = await this.runCalibratedSimulation(
        model,
        calibration
      );

      const result: IntegrationResult = {
        actual: actualData,
        baseline: {
          model,
          results: baselineResults,
        },
        calibrated: {
          model: calibratedSim.model,
          results: calibratedSim.results,
          calibration,
        },
      };

      // Step 4.5: Publish to NATS (if enabled)
      if (this.config.nats?.enabled && this.config.nats?.publishResults) {
        await this.publishToNATS(result);
      }

      // Step 5: Generate reports
      await this.generateReports(result);

      console.log('\n' + '='.repeat(80));
      console.log('✅ INTEGRATION COMPLETE');
      console.log('='.repeat(80));

      return result;
    } catch (error) {
      console.error('\n❌ Integration failed:', error);
      throw error;
    }
  }
}

export default FireflyIntegration;
