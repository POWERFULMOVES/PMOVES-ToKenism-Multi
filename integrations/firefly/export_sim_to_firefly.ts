/**
 * Export Simulation to Firefly-iii (PMOVES-Wealth)
 *
 * Runs a baseline simulation and exports transaction history for representative
 * agents to Firefly-iii for validation and visualization.
 *
 * Also publishes export results to NATS for PMOVES.AI ecosystem integration.
 *
 * @module firefly/export_sim_to_firefly
 */

import { ProjectionValidator } from '../projections/projection-validator';
import { AI_ENHANCED_LOCAL_SERVICE } from '../projections/scenario-configs';
import FireflyClient from './firefly-client';
import { natsClient } from '../nats/nats-client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const FIREFLY_URL = process.env.FIREFLY_URL || 'http://localhost:8080';
const FIREFLY_API_TOKEN = process.env.FIREFLY_API_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');
const PUBLISH_NATS = process.argv.includes('--nats') || process.env.NATS_ENABLED === 'true';

// Agent profiles for representative data generation
const AGENTS = [
  {
    name: 'Sim Agent: Average Member',
    type: 'asset',
    spendingMultiplier: 1.0,
    incomeMultiplier: 1.0,
  },
  {
    name: 'Sim Agent: High Spender',
    type: 'asset',
    spendingMultiplier: 1.5,
    incomeMultiplier: 1.2,
  },
  {
    name: 'Sim Agent: Saver',
    type: 'asset',
    spendingMultiplier: 0.7,
    incomeMultiplier: 1.0,
  },
];

interface ExportResult {
  simulation: {
    totalWeeks: number;
    finalRevenue: number;
    weeklyRevenue: number[];
  };
  agents: Array<{
    name: string;
    accountId?: string;
    transactionsExported: number;
    transactionsFailed: number;
  }>;
  exportedAt: string;
  dryRun: boolean;
}

async function publishToNATS(result: ExportResult): Promise<void> {
  if (!PUBLISH_NATS) {
    console.log('\n📡 NATS publishing disabled (use --nats to enable)');
    return;
  }

  console.log('\n📡 Publishing to NATS...');
  try {
    await natsClient.connect();

    // Publish export result event
    await natsClient.publish('tokenism.export.result.v1', {
      type: 'simulation_export',
      target: 'firefly-iii',
      result: {
        totalWeeks: result.simulation.totalWeeks,
        finalRevenue: result.simulation.finalRevenue,
        agentsProcessed: result.agents.length,
        totalTransactionsExported: result.agents.reduce((sum, a) => sum + a.transactionsExported, 0),
        totalTransactionsFailed: result.agents.reduce((sum, a) => sum + a.transactionsFailed, 0),
        dryRun: result.dryRun,
      },
      timestamp: result.exportedAt,
    });

    // Also publish simulation result for downstream consumers
    await natsClient.publishSimulationResult({
      simulationId: `export-${Date.now()}`,
      scenario: 'baseline-export',
      weeklyHistory: result.simulation.weeklyRevenue.map((revenue, week) => ({
        week,
        avgWealth: revenue / AI_ENHANCED_LOCAL_SERVICE.populationSize,
        gini: 0.35, // Placeholder
        povertyRate: 0.15, // Placeholder
      })),
      finalMetrics: {
        totalWealth: result.simulation.finalRevenue,
        wealthGap: 0.4, // Placeholder
        economicVelocity: 0.8, // Placeholder
      },
      parameters: {
        weeks: result.simulation.totalWeeks,
        populationSize: AI_ENHANCED_LOCAL_SERVICE.populationSize,
      },
    });

    await natsClient.disconnect();
    console.log('   ✅ Published to NATS');
  } catch (error: any) {
    console.warn('   ⚠️  NATS publish failed (non-fatal):', error.message);
  }
}

async function main(): Promise<ExportResult> {
  console.log('\n🚀 Starting Simulation Export to Firefly-iii (PMOVES-Wealth)');
  console.log('=============================================================');

  if (DRY_RUN) {
    console.log('⚡ DRY RUN MODE - No data will be written to Firefly-iii');
  }

  if (!FIREFLY_API_TOKEN && !DRY_RUN) {
    console.error('❌ Error: FIREFLY_API_TOKEN environment variable is not set.');
    console.error('   Set FIREFLY_API_TOKEN or use --dry-run for testing.');
    process.exit(1);
  }

  // 1. Run Simulation
  console.log('\n1️⃣  Running Baseline Simulation...');
  let results;
  try {
    const validator = new ProjectionValidator();
    results = await validator.runSimulation(AI_ENHANCED_LOCAL_SERVICE, 52); // 1 year
    console.log(`   ✅ Simulation complete: ${results.totalWeeks} weeks`);
  } catch (error: any) {
    console.error('❌ Simulation failed:', error.message);
    process.exit(1);
  }
  console.log(`   Final Revenue: $${results.finalRevenue.toLocaleString()}`);

  const exportResult: ExportResult = {
    simulation: {
      totalWeeks: results.totalWeeks,
      finalRevenue: results.finalRevenue,
      weeklyRevenue: results.weeklyRevenue,
    },
    agents: [],
    exportedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
  };

  // 2. Initialize Firefly Client (if not dry run)
  let client: FireflyClient | null = null;
  if (!DRY_RUN) {
    client = new FireflyClient({
      baseUrl: FIREFLY_URL,
      apiToken: FIREFLY_API_TOKEN!,
    });

    // Test connection
    const connected = await client.testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to Firefly-iii');
      process.exit(1);
    }
  }

  // 3. Process Agents
  console.log('\n2️⃣  Processing Representative Agents...');

  for (const agent of AGENTS) {
    console.log(`\n   👤 Processing: ${agent.name}`);

    const agentResult = {
      name: agent.name,
      accountId: undefined as string | undefined,
      transactionsExported: 0,
      transactionsFailed: 0,
    };

    // Create Account (skip in dry run)
    let accountId: string = 'dry-run-account';
    if (!DRY_RUN && client) {
      try {
        const account = await client.createAccount({
          name: agent.name,
          type: agent.type,
          balance: 1000,
        });
        accountId = account.id;
        console.log(`      ✅ Created account (ID: ${accountId})`);
      } catch (error: any) {
        if (error.response?.status === 422) {
          console.log(`      ⚠️  Account might already exist. Searching...`);
          try {
            const accounts = await client.getAccounts('asset');
            const existingAccount = accounts.find((a: any) => a.attributes.name === agent.name);

            if (existingAccount) {
              accountId = existingAccount.id;
              console.log(`      ✅ Found existing account (ID: ${accountId})`);
            } else {
              console.error(`      ❌ Could not find existing account with name: ${agent.name}`);
              exportResult.agents.push(agentResult);
              continue;
            }
          } catch (searchError) {
            console.error(`      ❌ Error searching for account:`, searchError);
            exportResult.agents.push(agentResult);
            continue;
          }
        } else {
          console.error(`      ❌ Error creating account:`, error.message);
          exportResult.agents.push(agentResult);
          continue;
        }
      }
    } else {
      console.log(`      [DRY RUN] Would create account: ${agent.name}`);
    }

    agentResult.accountId = accountId;

    // Generate Transactions
    console.log(`      generating transactions...`);
    const transactions = [];
    const currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() - 1);

    for (let i = 0; i < results.weeklyRevenue.length; i++) {
      const weekRevenue = results.weeklyRevenue[i];
      const weekDate = new Date(currentDate);
      weekDate.setDate(weekDate.getDate() + i * 7);

      // Income (Deposit)
      const incomeAmount = (weekRevenue / AI_ENHANCED_LOCAL_SERVICE.populationSize) * agent.incomeMultiplier;
      if (incomeAmount > 0) {
        transactions.push({
          type: 'deposit',
          date: weekDate,
          amount: parseFloat(incomeAmount.toFixed(2)),
          description: 'Weekly Income (Simulated)',
          destinationId: accountId,
          category: 'Income',
          destinationName: agent.name,
          sourceName: 'Revenue Account',
        });
      }

      // Grocery Expense (Withdrawal)
      const groceryAmount = 150 * agent.spendingMultiplier;
      transactions.push({
        type: 'withdrawal',
        date: weekDate,
        amount: parseFloat(groceryAmount.toFixed(2)),
        description: 'Weekly Groceries (Simulated)',
        sourceId: accountId,
        category: 'Groceries',
        destinationName: 'Supermarket',
      });
    }

    // Export in batches
    console.log(`      📤 Exporting ${transactions.length} transactions...`);

    if (DRY_RUN) {
      console.log(`      [DRY RUN] Would export ${transactions.length} transactions`);
      agentResult.transactionsExported = transactions.length;
    } else if (client) {
      const BATCH_SIZE = 10;
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map((tx) => client!.createTransaction(tx as any)));

        batchResults.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`\n      ❌ Failed to create transaction ${i + index}:`, result.reason?.message || result.reason);
            agentResult.transactionsFailed++;
          } else {
            agentResult.transactionsExported++;
          }
        });
        process.stdout.write('.');
      }
    }
    console.log('\n      ✅ Done');
    exportResult.agents.push(agentResult);
  }

  // 4. Summary
  console.log('\n📊 Export Summary');
  console.log('─────────────────');
  console.log(`   Simulation Weeks: ${exportResult.simulation.totalWeeks}`);
  console.log(`   Final Revenue: $${exportResult.simulation.finalRevenue.toLocaleString()}`);
  console.log(`   Agents Processed: ${exportResult.agents.length}`);
  console.log(
    `   Transactions Exported: ${exportResult.agents.reduce((sum, a) => sum + a.transactionsExported, 0)}`
  );
  console.log(
    `   Transactions Failed: ${exportResult.agents.reduce((sum, a) => sum + a.transactionsFailed, 0)}`
  );
  console.log(`   Dry Run: ${exportResult.dryRun ? 'Yes' : 'No'}`);

  // 5. Publish to NATS
  await publishToNATS(exportResult);

  console.log('\n✅ Export Complete!');
  return exportResult;
}

main().catch((error) => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});

export { main as exportSimToFirefly, ExportResult };
