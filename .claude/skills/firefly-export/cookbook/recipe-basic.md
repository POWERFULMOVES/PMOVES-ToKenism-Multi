# Recipe: Basic Firefly Export

Export simulation results to Firefly-III for financial tracking.

## Prerequisites

- Firefly-III running (localhost:8080 or remote)
- Personal Access Token created
- Simulation results in JSON format

## Steps

### 1. Configure Firefly Access

Create configuration file:
```bash
# integrations/.env.firefly
cat > integrations/.env.firefly << EOF
FIREFLY_BASE_URL=http://localhost:8080
FIREFLY_TOKEN=your_token_here
FIREFLY_ACCOUNT_ID=1
EOF
```

### 2. Verify Connectivity

```bash
npx ts-node .claude/skills/firefly-export/tools/api-health-check.ts
```

Expected output:
```
[firefly-health] Health Check Result
=====================================
Status: HEALTHY
Latency: 45ms
...
Checks:
  Connectivity: PASS
  Authentication: PASS
  API Version: 6.1.0
  Accounts Access: PASS
```

### 3. Generate CSV for Review

```bash
npx ts-node .claude/skills/firefly-export/tools/csv-generator.ts \
  --input results.json \
  --format firefly \
  --output firefly-import.csv
```

Review the CSV to verify transactions look correct.

### 4. Dry-Run Export

Preview what will be created:
```bash
npx ts-node .claude/skills/firefly-export/tools/firefly-cli.ts \
  --input results.json \
  --dry-run
```

Output shows each transaction that would be created:
```
[firefly] DRY-RUN: {
  "type": "withdrawal",
  "date": "2025-01-15",
  "amount": "1250.00",
  "description": "[PMOVES] Week 1 Internal Spending"
}
```

### 5. Live Export

Once satisfied with dry-run:
```bash
npx ts-node .claude/skills/firefly-export/tools/firefly-cli.ts \
  --input results.json \
  --confirm
```

### 6. Verify in Firefly

1. Open Firefly-III web interface
2. Navigate to Transactions
3. Filter by tag: `pmoves`
4. Review imported transactions

## Output Formats

### Firefly Native CSV
```bash
npx ts-node tools/csv-generator.ts --format firefly
```
Columns: type, date, amount, description, source_name, destination_name, category, tags, notes

### Spectre/YNAB Compatible
```bash
npx ts-node tools/csv-generator.ts --format spectre
```
Columns: Date, Payee, Category, Memo, Outflow, Inflow

### Generic (raw data)
```bash
npx ts-node tools/csv-generator.ts --format generic
```
Columns: week, gini, poverty_rate, avg_wealth, total_internal, total_external, grotokens_earned

## Next Steps

- Set up recurring imports with [recipe-advanced.md](recipe-advanced.md)
- Create Firefly rules to auto-categorize PMOVES transactions
- Link transactions to budgets for cooperative tracking
