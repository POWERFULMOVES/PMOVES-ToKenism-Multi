#!/usr/bin/env npx ts-node
/**
 * Tokenism Metrics Exporter
 *
 * Exports simulation results to CSV or JSON formats.
 * Part of the tokenism-analysis skill toolset.
 *
 * Usage:
 *   npx ts-node export-metrics.ts --format csv --output results.csv
 *   npx ts-node export-metrics.ts --format json --output results.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface WeeklyMetric {
  week: number;
  gini: number;
  poverty_rate: number;
  avg_wealth: number;
  total_internal: number;
  total_external: number;
  grotokens_earned: number;
}

interface SimulationResult {
  summary: {
    final_gini: number;
    final_poverty_rate: number;
    total_internal_spending: number;
    total_external_spending: number;
    total_grotokens_earned: number;
  };
  weekly_data: WeeklyMetric[];
  params?: Record<string, unknown>;
}

function exportToCSV(data: SimulationResult): string {
  const headers = [
    'week',
    'gini',
    'poverty_rate',
    'avg_wealth',
    'total_internal',
    'total_external',
    'grotokens_earned',
  ];

  const rows = data.weekly_data.map((row) =>
    headers.map((h) => row[h as keyof WeeklyMetric] ?? '').join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function exportToJSON(data: SimulationResult, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

function exportSummaryMarkdown(data: SimulationResult): string {
  const { summary } = data;
  const weeks = data.weekly_data.length;

  return `# Tokenism Simulation Results

## Summary Metrics

| Metric | Value |
|--------|-------|
| Simulation Duration | ${weeks} weeks |
| Final Gini Coefficient | ${summary.final_gini.toFixed(4)} |
| Final Poverty Rate | ${(summary.final_poverty_rate * 100).toFixed(2)}% |
| Total Internal Spending | $${summary.total_internal_spending.toLocaleString()} |
| Total External Spending | $${summary.total_external_spending.toLocaleString()} |
| Total GroTokens Earned | ${summary.total_grotokens_earned.toLocaleString()} |

## Trend Analysis

- **Gini Change**: ${data.weekly_data[0]?.gini.toFixed(4)} → ${summary.final_gini.toFixed(4)}
- **Poverty Change**: ${(data.weekly_data[0]?.poverty_rate * 100).toFixed(2)}% → ${(summary.final_poverty_rate * 100).toFixed(2)}%

## Data Export

Weekly data available in CSV format with ${data.weekly_data.length} records.
`;
}

async function main() {
  const args = process.argv.slice(2);
  let format = 'json';
  let outputPath = '';
  let inputPath = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
        format = args[++i];
        break;
      case '--output':
        outputPath = args[++i];
        break;
      case '--input':
        inputPath = args[++i];
        break;
    }
  }

  // Read input data
  let data: SimulationResult;

  if (inputPath) {
    const content = fs.readFileSync(inputPath, 'utf-8');
    data = JSON.parse(content);
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } else {
    console.error('[tokenism] No input data. Use --input or pipe JSON data.');
    process.exit(1);
  }

  // Export in requested format
  let output: string;
  switch (format) {
    case 'csv':
      output = exportToCSV(data);
      break;
    case 'json':
      output = exportToJSON(data);
      break;
    case 'md':
    case 'markdown':
      output = exportSummaryMarkdown(data);
      break;
    default:
      console.error(`[tokenism] Unknown format: ${format}`);
      process.exit(1);
  }

  // Write output
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, output);
    console.log(`[tokenism] Exported to ${outputPath}`);
  } else {
    console.log(output);
  }
}

main();

export { exportToCSV, exportToJSON, exportSummaryMarkdown };
