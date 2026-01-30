#!/usr/bin/env npx ts-node
/**
 * CSV Generator for Firefly Import
 *
 * Generates Firefly-III compatible CSV files from simulation data.
 * Part of the firefly-export skill toolset.
 *
 * Usage:
 *   npx ts-node csv-generator.ts --input results.json --output firefly-import.csv
 *   npx ts-node csv-generator.ts --input results.json --format spectre
 */

import * as fs from 'fs';
import * as path from 'path';

interface WeeklyMetric {
  week: number;
  gini?: number;
  poverty_rate?: number;
  avg_wealth?: number;
  total_internal?: number;
  total_external?: number;
  grotokens_earned?: number;
}

interface SimulationData {
  summary?: Record<string, number>;
  weekly_data?: WeeklyMetric[];
  params?: Record<string, unknown>;
}

type CSVFormat = 'firefly' | 'spectre' | 'generic';

interface CSVRow {
  [key: string]: string | number;
}

const FIREFLY_HEADERS = [
  'type',
  'date',
  'amount',
  'description',
  'source_name',
  'destination_name',
  'category',
  'tags',
  'notes',
];

const SPECTRE_HEADERS = [
  'Date',
  'Payee',
  'Category',
  'Memo',
  'Outflow',
  'Inflow',
];

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCSV(row: CSVRow, headers: string[]): string {
  return headers.map((h) => escapeCSV(row[h] ?? '')).join(',');
}

function generateFireflyCSV(data: SimulationData): string {
  const rows: CSVRow[] = [];
  const weeklyData = data.weekly_data || [];

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - weeklyData.length * 7);

  weeklyData.forEach((week, index) => {
    const weekDate = new Date(baseDate);
    weekDate.setDate(weekDate.getDate() + index * 7);
    const dateStr = weekDate.toISOString().split('T')[0];

    if (week.total_internal && week.total_internal > 0) {
      rows.push({
        type: 'withdrawal',
        date: dateStr,
        amount: week.total_internal.toFixed(2),
        description: `Week ${week.week} Internal Cooperative Spending`,
        source_name: 'PMOVES Cooperative',
        destination_name: 'Internal Vendors',
        category: 'Cooperative Internal',
        tags: 'pmoves;simulation;internal',
        notes: `Gini: ${week.gini?.toFixed(4) || 'N/A'}`,
      });
    }

    if (week.total_external && week.total_external > 0) {
      rows.push({
        type: 'withdrawal',
        date: dateStr,
        amount: week.total_external.toFixed(2),
        description: `Week ${week.week} External Spending`,
        source_name: 'PMOVES Cooperative',
        destination_name: 'External Vendors',
        category: 'Cooperative External',
        tags: 'pmoves;simulation;external',
        notes: `Poverty Rate: ${((week.poverty_rate || 0) * 100).toFixed(2)}%`,
      });
    }

    if (week.grotokens_earned && week.grotokens_earned > 0) {
      rows.push({
        type: 'deposit',
        date: dateStr,
        amount: (week.grotokens_earned * 2).toFixed(2), // Assuming $2 per token
        description: `Week ${week.week} GroToken Rewards`,
        source_name: 'GroToken System',
        destination_name: 'PMOVES Cooperative',
        category: 'Token Rewards',
        tags: 'pmoves;simulation;grotoken',
        notes: `Tokens: ${week.grotokens_earned.toFixed(2)}`,
      });
    }
  });

  const csvLines = [FIREFLY_HEADERS.join(',')];
  rows.forEach((row) => csvLines.push(rowToCSV(row, FIREFLY_HEADERS)));
  return csvLines.join('\n');
}

function generateSpectreCSV(data: SimulationData): string {
  const rows: CSVRow[] = [];
  const weeklyData = data.weekly_data || [];

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - weeklyData.length * 7);

  weeklyData.forEach((week, index) => {
    const weekDate = new Date(baseDate);
    weekDate.setDate(weekDate.getDate() + index * 7);
    const dateStr = weekDate.toISOString().split('T')[0];

    if (week.total_internal && week.total_internal > 0) {
      rows.push({
        Date: dateStr,
        Payee: 'PMOVES Internal',
        Category: 'Cooperative:Internal',
        Memo: `Week ${week.week} simulation`,
        Outflow: week.total_internal.toFixed(2),
        Inflow: '',
      });
    }

    if (week.total_external && week.total_external > 0) {
      rows.push({
        Date: dateStr,
        Payee: 'External Vendors',
        Category: 'Cooperative:External',
        Memo: `Week ${week.week} simulation`,
        Outflow: week.total_external.toFixed(2),
        Inflow: '',
      });
    }
  });

  const csvLines = [SPECTRE_HEADERS.join(',')];
  rows.forEach((row) => csvLines.push(rowToCSV(row, SPECTRE_HEADERS)));
  return csvLines.join('\n');
}

function generateGenericCSV(data: SimulationData): string {
  const weeklyData = data.weekly_data || [];
  const headers = [
    'week',
    'gini',
    'poverty_rate',
    'avg_wealth',
    'total_internal',
    'total_external',
    'grotokens_earned',
  ];

  const csvLines = [headers.join(',')];
  weeklyData.forEach((week) => {
    csvLines.push(
      headers.map((h) => week[h as keyof WeeklyMetric] ?? '').join(',')
    );
  });

  return csvLines.join('\n');
}

function generateCSV(data: SimulationData, format: CSVFormat): string {
  switch (format) {
    case 'firefly':
      return generateFireflyCSV(data);
    case 'spectre':
      return generateSpectreCSV(data);
    case 'generic':
    default:
      return generateGenericCSV(data);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';
  let format: CSVFormat = 'firefly';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputPath = args[++i];
        break;
      case '--output':
        outputPath = args[++i];
        break;
      case '--format':
        format = args[++i] as CSVFormat;
        break;
    }
  }

  if (!inputPath) {
    console.error('[csv-gen] Usage: csv-generator.ts --input <file> [--output <file>] [--format firefly|spectre|generic]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[csv-gen] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(content) as SimulationData;
  const csv = generateCSV(data, format);

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, csv);
    console.log(`[csv-gen] Exported to ${outputPath} (${format} format)`);
  } else {
    console.log(csv);
  }
}

main();

export { generateCSV, generateFireflyCSV, generateSpectreCSV, CSVFormat };
