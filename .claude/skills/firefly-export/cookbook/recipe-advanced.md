# Recipe: Advanced Firefly Workflows

Automated imports, reconciliation, and multi-cooperative management.

## Prerequisites

- Basic recipe completed
- Firefly-III API familiarity
- Scheduled job capability (cron, Task Scheduler)

## Automated Import Pipeline

### Create import script
```bash
#!/bin/bash
# scripts/daily-firefly-sync.sh

set -e

RESULTS_DIR="artifacts/simulations"
EXPORT_DIR="artifacts/firefly-exports"

# Get latest simulation results
LATEST=$(ls -t $RESULTS_DIR/*.json | head -1)

if [ -z "$LATEST" ]; then
  echo "No simulation results found"
  exit 1
fi

# Generate unique export filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="$EXPORT_DIR/export_$TIMESTAMP.csv"

# Generate CSV
npx ts-node .claude/skills/firefly-export/tools/csv-generator.ts \
  --input "$LATEST" \
  --format firefly \
  --output "$EXPORT_FILE"

# Export to Firefly (with error handling)
npx ts-node .claude/skills/firefly-export/tools/firefly-cli.ts \
  --input "$LATEST" \
  --confirm || {
    echo "Export failed, CSV saved to $EXPORT_FILE for manual import"
    exit 1
  }

echo "Successfully exported to Firefly: $TIMESTAMP"
```

### Schedule with cron
```bash
# Run daily at 2 AM
0 2 * * * /path/to/daily-firefly-sync.sh >> /var/log/firefly-sync.log 2>&1
```

## Multi-Cooperative Management

Track multiple cooperatives in one Firefly instance:

### Create accounts per cooperative
```javascript
// In Firefly: Create asset accounts
// - "PMOVES Coop Alpha"
// - "PMOVES Coop Beta"
// - "PMOVES Coop Gamma"
```

### Export with cooperative tagging
```typescript
// custom-export.ts
import { exportToFirefly } from './tools/firefly-cli';
import * as fs from 'fs';

const cooperatives = [
  { name: 'Alpha', accountId: '10', resultsFile: 'results_alpha.json' },
  { name: 'Beta', accountId: '11', resultsFile: 'results_beta.json' },
  { name: 'Gamma', accountId: '12', resultsFile: 'results_gamma.json' },
];

async function exportAllCoops() {
  for (const coop of cooperatives) {
    process.env.FIREFLY_ACCOUNT_ID = coop.accountId;

    console.log(`Exporting ${coop.name}...`);
    // Run export with coop-specific account
    // Add coop name to tags for filtering
  }
}

exportAllCoops();
```

## Reconciliation Workflow

Compare simulation predictions with actual Firefly data:

### Export Firefly transactions
```bash
# Get PMOVES transactions from last quarter
curl -H "Authorization: Bearer $FIREFLY_TOKEN" \
  "$FIREFLY_BASE_URL/api/v1/transactions?tag=pmoves&start=2025-01-01&end=2025-03-31" \
  > firefly_actuals.json
```

### Compare with simulation
```typescript
// reconcile.ts
import * as fs from 'fs';

interface Transaction {
  date: string;
  amount: number;
  description: string;
}

const simulated = JSON.parse(fs.readFileSync('results.json', 'utf-8'));
const actual = JSON.parse(fs.readFileSync('firefly_actuals.json', 'utf-8'));

// Calculate variance
const simulatedTotal = simulated.summary.total_internal_spending;
const actualTotal = actual.data
  .filter(t => t.attributes.category_name === 'Cooperative Internal')
  .reduce((sum, t) => sum + parseFloat(t.attributes.transactions[0].amount), 0);

const variance = ((actualTotal - simulatedTotal) / simulatedTotal * 100).toFixed(2);

console.log(`Simulated Internal Spending: $${simulatedTotal}`);
console.log(`Actual Internal Spending: $${actualTotal}`);
console.log(`Variance: ${variance}%`);
```

## Budgeting Integration

Link PMOVES simulations to Firefly budgets:

### Create simulation-based budget
```bash
# Extract projected spending from simulation
MONTHLY_INTERNAL=$(jq '[.weekly_data[0:4] | .[].total_internal] | add' results.json)

# Create/update Firefly budget via API
curl -X POST "$FIREFLY_BASE_URL/api/v1/budgets" \
  -H "Authorization: Bearer $FIREFLY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"PMOVES Internal Spending\",
    \"auto_budget_type\": \"rollover\",
    \"auto_budget_amount\": \"$MONTHLY_INTERNAL\",
    \"auto_budget_period\": \"monthly\"
  }"
```

## Webhook Integration

Trigger Firefly export on simulation completion:

### Flask webhook endpoint
```python
# In flask_backend.py
@app.route('/webhooks/simulation-complete', methods=['POST'])
def simulation_webhook():
    data = request.json
    results_file = data.get('results_file')

    # Trigger Firefly export
    subprocess.run([
        'npx', 'ts-node',
        '.claude/skills/firefly-export/tools/firefly-cli.ts',
        '--input', results_file,
        '--confirm'
    ])

    return jsonify({'status': 'exported'})
```

## Error Recovery

### Handle failed exports
```bash
# Retry with exponential backoff
for i in 1 2 4 8 16; do
  npx ts-node tools/firefly-cli.ts --input results.json --confirm && break
  echo "Attempt failed, retrying in ${i}s..."
  sleep $i
done
```

### Archive failed exports
```bash
# On failure, archive for manual review
FAILED_DIR="artifacts/failed-exports"
mkdir -p "$FAILED_DIR"
cp results.json "$FAILED_DIR/$(date +%Y%m%d_%H%M%S)_failed.json"
```

## Tips

1. **Use dry-run liberally**: Always preview before live exports
2. **Tag everything**: Use consistent tags for filtering
3. **Keep CSV backups**: Archive generated CSVs for audit trail
4. **Monitor API limits**: Firefly may rate-limit bulk imports
5. **Test in staging**: Use a test Firefly instance for development
