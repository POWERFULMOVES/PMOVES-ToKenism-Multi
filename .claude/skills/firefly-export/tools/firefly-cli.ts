#!/usr/bin/env npx ts-node
/**
 * Firefly Export CLI Tool
 *
 * Command-line interface for exporting simulation data to Firefly-III.
 * Part of the firefly-export skill toolset.
 *
 * Usage:
 *   npx ts-node firefly-cli.ts --input results.json --dry-run
 *   npx ts-node firefly-cli.ts --input results.json --confirm
 */

import * as fs from 'fs';
import * as path from 'path';

interface FireflyConfig {
  baseUrl: string;
  token: string;
  accountId?: string;
  budgetId?: string;
}

interface TransactionPayload {
  type: 'withdrawal' | 'deposit' | 'transfer';
  date: string;
  amount: string;
  description: string;
  source_id?: string;
  destination_id?: string;
  category_name?: string;
  tags?: string[];
}

interface ExportResult {
  success: boolean;
  transactionsCreated: number;
  errors: string[];
  dryRun: boolean;
}

function loadConfig(): FireflyConfig {
  const envPath = path.join(process.cwd(), 'integrations', '.env.firefly');

  // Default config from environment or .env file
  const config: FireflyConfig = {
    baseUrl: process.env.FIREFLY_BASE_URL || 'http://localhost:8080',
    token: process.env.FIREFLY_TOKEN || '',
    accountId: process.env.FIREFLY_ACCOUNT_ID,
    budgetId: process.env.FIREFLY_BUDGET_ID,
  };

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const [key, value] = line.split('=').map((s) => s.trim());
      if (key === 'FIREFLY_BASE_URL') config.baseUrl = value;
      if (key === 'FIREFLY_TOKEN') config.token = value;
      if (key === 'FIREFLY_ACCOUNT_ID') config.accountId = value;
      if (key === 'FIREFLY_BUDGET_ID') config.budgetId = value;
    });
  }

  return config;
}

async function createTransaction(
  config: FireflyConfig,
  payload: TransactionPayload,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  if (dryRun) {
    console.log('[firefly] DRY-RUN:', JSON.stringify(payload, null, 2));
    return { success: true };
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/v1/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        error_if_duplicate_hash: true,
        apply_rules: true,
        fire_webhooks: true,
        transactions: [payload],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function simulationToTransactions(
  data: Record<string, unknown>,
  config: FireflyConfig
): TransactionPayload[] {
  const transactions: TransactionPayload[] = [];
  const weeklyData = (data.weekly_data || []) as Array<{
    week: number;
    total_internal?: number;
    total_external?: number;
  }>;

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - weeklyData.length * 7);

  weeklyData.forEach((week, index) => {
    const weekDate = new Date(baseDate);
    weekDate.setDate(weekDate.getDate() + index * 7);
    const dateStr = weekDate.toISOString().split('T')[0];

    if (week.total_internal) {
      transactions.push({
        type: 'withdrawal',
        date: dateStr,
        amount: String(week.total_internal.toFixed(2)),
        description: `[PMOVES] Week ${week.week} Internal Spending`,
        source_id: config.accountId,
        category_name: 'Cooperative Internal',
        tags: ['pmoves', 'simulation', 'internal'],
      });
    }

    if (week.total_external) {
      transactions.push({
        type: 'withdrawal',
        date: dateStr,
        amount: String(week.total_external.toFixed(2)),
        description: `[PMOVES] Week ${week.week} External Spending`,
        source_id: config.accountId,
        category_name: 'Cooperative External',
        tags: ['pmoves', 'simulation', 'external'],
      });
    }
  });

  return transactions;
}

async function exportToFirefly(
  inputPath: string,
  dryRun: boolean
): Promise<ExportResult> {
  const config = loadConfig();
  const result: ExportResult = {
    success: true,
    transactionsCreated: 0,
    errors: [],
    dryRun,
  };

  if (!config.token && !dryRun) {
    result.success = false;
    result.errors.push('FIREFLY_TOKEN not configured');
    return result;
  }

  // Load simulation data
  const content = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(content);
  const transactions = simulationToTransactions(data, config);

  console.log(`[firefly] Processing ${transactions.length} transactions...`);

  for (const tx of transactions) {
    const txResult = await createTransaction(config, tx, dryRun);
    if (txResult.success) {
      result.transactionsCreated++;
    } else {
      result.errors.push(txResult.error || 'Unknown error');
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputPath = args[++i];
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--confirm':
        dryRun = false;
        break;
    }
  }

  if (!inputPath) {
    console.error('[firefly] Usage: firefly-cli.ts --input <file> [--dry-run|--confirm]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[firefly] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const result = await exportToFirefly(inputPath, dryRun);

  console.log('\n[firefly] Export Result:');
  console.log(`  Mode: ${result.dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`  Transactions: ${result.transactionsCreated}`);
  console.log(`  Success: ${result.success}`);

  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }

  process.exit(result.success ? 0 : 1);
}

main();

export { exportToFirefly, loadConfig, TransactionPayload, ExportResult };
