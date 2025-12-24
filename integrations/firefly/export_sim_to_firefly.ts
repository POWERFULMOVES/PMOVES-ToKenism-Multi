/**
 * Export Simulation to Firefly-iii
 *
 * Runs a baseline simulation and exports transaction history for representative
 * agents to Firefly-iii for validation and visualization.
 */

import { ProjectionValidator } from '../projections/projection-validator';
import { AI_ENHANCED_LOCAL_SERVICE } from '../projections/scenario-configs';
import FireflyClient from './firefly-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config(); // Load from current dir if exists
dotenv.config({ path: path.resolve(__dirname, '../../PMOVES-Firefly-iii/.env') }); // Load from submodule (relative to script file)
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Load from root

const FIREFLY_URL = process.env.FIREFLY_URL || 'http://localhost:8080';
const FIREFLY_API_TOKEN = process.env.FIREFLY_API_TOKEN;

if (!FIREFLY_API_TOKEN) {
  console.warn('⚠️  FIREFLY_API_TOKEN not set. Running in DRY RUN mode (no export).');
}

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

async function main() {
  console.log('\n🚀 Starting Simulation Export to Firefly-iii');
  console.log('============================================');

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

  // 2. Initialize Firefly Client
  let client: FireflyClient | null = null;
  if (FIREFLY_API_TOKEN) {
    client = new FireflyClient({
      baseUrl: FIREFLY_URL,
      apiToken: FIREFLY_API_TOKEN,
    });

    // Test connection
    const connected = await client.testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to Firefly-iii. Switching to DRY RUN mode.');
      client = null;
    }
  } else {
    console.log('ℹ️  Skipping Firefly connection (Dry Run)');
  }

  // 3. Process Agents
  console.log('\n2️⃣  Processing Representative Agents...');

  for (const agent of AGENTS) {
    console.log(`\n   👤 Processing: ${agent.name}`);

    // Create Account
    let accountId: string;
    if (client) {
      try {
        // Attempt to create account; if 422, search for existing account by name
        const account = await client.createAccount({
          name: agent.name,
          type: agent.type,
          balance: 1000, // Initial balance
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
              continue;
            }
          } catch (searchError) {
            console.error(`      ❌ Error searching for account:`, searchError);
            continue;
          }
        } else {
          console.error(`      ❌ Error creating account:`, error.message);
          continue;
        }
      }
    } else {
       console.log(`      [DRY RUN] Would create/find account for: ${agent.name}`);
       accountId = 'dry-run-id';
    }

    // Generate Transactions
    console.log(`      generating transactions...`);
    const transactions = [];
    let currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() - 1); // Start 1 year ago

    // Add Initial Balance Transaction to ensure validation baseline
    transactions.push({
      type: 'deposit',
      date: new Date(currentDate),
      amount: 1000.00,
      description: 'Simulation Start Balance',
      destinationId: accountId,
      category: 'Initial Balance',
      destinationName: agent.name,
      sourceName: 'Opening Balance'
    });

    for (let i = 0; i < results.weeklyRevenue.length; i++) {
      const weekRevenue = results.weeklyRevenue[i];
      const weekDate = new Date(currentDate);
      weekDate.setDate(weekDate.getDate() + (i * 7));

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
          destinationName: agent.name, // Required for deposit? usually source is revenue account, dest is asset
          sourceName: 'Revenue Account' // Placeholder
        });
      }

      // Grocery Expense (Withdrawal)
      // Base budget $150
      const groceryAmount = 150 * agent.spendingMultiplier;
      transactions.push({
        type: 'withdrawal',
        date: weekDate,
        amount: parseFloat(groceryAmount.toFixed(2)),
        description: 'Weekly Groceries (Simulated)',
        sourceId: accountId,
        category: 'Groceries',
        destinationName: 'Supermarket'
      });
    }

    // Export in batches
    console.log(`      Generated ${transactions.length} transactions: ${transactions.filter((t: any) => t.type === 'deposit').length} deposits, ${transactions.filter((t: any) => t.type === 'withdrawal').length} withdrawals`);
    console.log(`      📤 Exporting transactions...`);
    const BATCH_SIZE = 10;
    
    if (client) {
      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(tx => client!.createTransaction(tx as any)));
        
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`\n      ❌ Failed to create transaction ${i + index}:`, result.reason?.message || result.reason);
          }
        });
        process.stdout.write('.');
      }
    } else {
       console.log(`      [DRY RUN] Would export ${transactions.length} transactions`);
    }
    console.log('\n      ✅ Done');
  }

  console.log('\n✅ Export Complete!');
}

main().catch((error) => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
