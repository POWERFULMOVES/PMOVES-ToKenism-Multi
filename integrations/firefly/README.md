# Firefly-iii Integration Module

Integrates real financial data from Firefly-iii to calibrate and validate PMOVES business projections.

## Overview

This module fetches real spending data from Firefly-iii, transforms it into a format compatible with PMOVES token economy simulations, calibrates projection parameters based on actual behavior, and generates comprehensive comparison reports.

## Architecture

```
┌──────────────────┐
│  Firefly-iii API │
└────────┬─────────┘
         │
         ↓
┌────────────────────┐
│  FireflyClient     │  ← Fetch transactions, spending data
└────────┬───────────┘
         │
         ↓
┌───────────────────────┐
│  DataTransformer      │  ← Map categories, aggregate weekly
└────────┬──────────────┘
         │
         ↓
┌───────────────────────┐
│  CalibrationEngine    │  ← Compare, calibrate parameters
└────────┬──────────────┘
         │
         ↓
┌───────────────────────┐
│  FireflyIntegration   │  ← Orchestrate pipeline
└────────┬──────────────┘
         │
         ↓
┌───────────────────────┐
│  Reports              │  ← Markdown + CSV outputs
└───────────────────────┘
```

## Components

### 1. FireflyClient (`firefly-client.ts`)

**Purpose:** HTTP client for Firefly-iii API

**Methods:**
- `getTransactions(startDate, endDate)` - Fetch all transactions
- `getSpendingByCategory(startDate, endDate)` - Get category breakdown
- `getBudgetVsActual(startDate, endDate)` - Budget analysis
- `getUserGroupWealth(groupId)` - Wealth distribution
- `testConnection()` - Verify API connectivity

**Example:**
```typescript
const client = new FireflyClient({
  baseUrl: 'http://localhost:8080',
  apiToken: 'your-api-token',
});

const transactions = await client.getTransactions(
  new Date('2024-01-01'),
  new Date('2024-03-31')
);
```

### 2. DataTransformer (`data-transformer.ts`)

**Purpose:** Transform Firefly data into simulation-ready format

**Features:**
- Category mapping (Firefly → FoodUSD)
- Weekly spending aggregation
- Participation metrics calculation
- Spending distribution analysis

**Category Mappings:**
| Firefly Category | FoodUSD Category |
|------------------|------------------|
| Groceries | groceries |
| Supermarket | groceries |
| Restaurants | dining |
| Fast Food | prepared_food |
| Takeaway | food_delivery |
| Farmers Market | farmers_market |

**Example:**
```typescript
const transformer = new FireflyDataTransformer();

const transformed = transformer.transform(transactions, 500);
// Result: {
//   weeklySpending: WeeklySpending[],
//   participation: ParticipationMetrics,
//   categoryDistribution: Record<string, number>,
//   totalSpending: number
// }
```

### 3. CalibrationEngine (`calibration-engine.ts`)

**Purpose:** Calibrate projection parameters using real data

**Calibrates:**
- Weekly food budget per participant
- Participation rate
- Category distribution percentages
- GroupPurchase savings rate (15% baseline)

**Confidence Levels:**
- **HIGH:** Variance ≤ 10%
- **MEDIUM:** Variance 10-25%
- **LOW:** Variance > 25%

**Example:**
```typescript
const calibrator = new CalibrationEngine();

const report = await calibrator.calibrate(
  'AI-Enhanced Local Service',
  actualData,
  simulatedResults,
  500 // total population
);

// Result: CalibrationReport with parameter adjustments
```

### 4. FireflyIntegration (`firefly-integration.ts`)

**Purpose:** Orchestrate complete integration pipeline

**Pipeline:**
1. Fetch real data from Firefly-iii
2. Run baseline simulation
3. Calibrate model with real data
4. Run calibrated simulation
5. Generate comparison reports

**Example:**
```typescript
const integration = new FireflyIntegration({
  firefly: {
    baseUrl: 'http://localhost:8080',
    apiToken: process.env.FIREFLY_API_TOKEN,
  },
  analysis: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-03-31'),
    totalPopulation: 500,
  },
  output: {
    directory: './output/calibration',
    generateCSV: true,
    generateMarkdown: true,
  },
});

const result = await integration.run(AI_ENHANCED_LOCAL_SERVICE);
```

### 5. FireflySettlementExecutor (`settlement-executor.ts`)

**Purpose:** Consume signed `tokenism.settlement.requested.v1` batches and map Firefly-lane instructions into Firefly transaction drafts.

Dry-run is the default. In dry-run mode the executor validates the batch, builds transaction drafts, skips non-Firefly lanes, and never calls the Firefly API. Live mode requires an injected client with `createTransaction()`.

**Example:**
```typescript
import { FireflySettlementExecutor } from './firefly';

const executor = new FireflySettlementExecutor(undefined, { dryRun: true });
const result = await executor.execute(settlementRequestedEvent);

console.log(result.drafts.length);  // Firefly transactions that would be created
console.log(result.skipped.length); // Contract/manual lanes ignored by this executor
```

**Live mode gate:**
```typescript
const executor = new FireflySettlementExecutor(fireflyClient, {
  dryRun: false,
  executorAgentId: 'FIREFLY-SETTLEMENT-EXECUTOR',
  executorSignature: {
    alg: 'HMAC-SHA256',
    kid: 'firefly-exec',
    hmac: process.env.FIREFLY_EXECUTOR_HMAC!,
  },
});

const result = await executor.execute(settlementRequestedEvent);
```

Live mode emits recorded/failed result objects for publishing to `tokenism.settlement.recorded.v1` or `tokenism.settlement.failed.v1`. The executor does not publish to NATS directly; callers own the bus client and strict-publish policy.

## Installation

```bash
cd integrations
npm install
```

## Usage

### HTTP trigger (dry-run export service)

The CLI exporter below now has a token-gated HTTP twin for room UIs:
`pmoves_backend/export_service.py` (Flask). It resolves scenarios from the
demo library (`pmoves_backend/scenarios.py`), runs the Python simulator, and
returns the dry-run Firefly transaction summary — a live-write path does not
exist in the service (TAC_TOKENISM settlement gate governs any future one).

```bash
# token comes from the env-tier secrets pipeline; example var name:
#   TOKENISM_EXPORT_TOKEN
python -m pmoves_backend.export_service   # serves 127.0.0.1:8118

curl -s -X POST http://127.0.0.1:8118/v1/tokenism/export/wealth \
  -H "Authorization: Bearer $TOKENISM_EXPORT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "baseline"}'
```

Publishes `tokenism.export.result.v1` to NATS when `NATS_URL` is set.

### Quick Start

1. **Set up Firefly-iii API token:**

**Option 1: Create .env file (recommended)**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your values:
# FIREFLY_API_TOKEN=your-token-here
# FIREFLY_URL=http://localhost:8080
# TOTAL_POPULATION=500
```

**Option 2: Export environment variable**
```bash
# Get token from Firefly-iii: Options > Profile > OAuth > Personal Access Token
export FIREFLY_API_TOKEN="your-token-here"

# Optional: Configure Firefly URL and population size
export FIREFLY_URL="http://localhost:8080"  # Default: http://localhost:8080
export TOTAL_POPULATION="500"               # Default: 500
```

**Option 3: Inline with command**
```bash
FIREFLY_API_TOKEN="your-token" npm run firefly:calibrate
```

2. **Run integration:**

```bash
npm run firefly:calibrate
```

3. **View results:**

```bash
ls output/firefly-calibration/
# CALIBRATION_REPORT.md        - Comprehensive markdown report
# category-comparison.csv       - Category-level variance analysis
# parameter-adjustments.csv     - Parameter calibration details
# weekly-comparison.csv         - Week-by-week comparison
```

### Programmatic Usage

```typescript
import { FireflyIntegration } from './firefly';
import { AI_ENHANCED_LOCAL_SERVICE } from './projections';

const integration = new FireflyIntegration({
  firefly: {
    baseUrl: 'http://localhost:8080',
    apiToken: 'your-token',
  },
  analysis: {
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
    endDate: new Date(),
    totalPopulation: 500,
  },
  output: {
    directory: './output',
    generateCSV: true,
    generateMarkdown: true,
  },
});

const result = await integration.run(AI_ENHANCED_LOCAL_SERVICE);

console.log(`Confidence: ${result.calibrated.calibration.overallAccuracy.confidenceLevel}`);
console.log(`Score: ${result.calibrated.calibration.overallAccuracy.confidenceScore}/100`);
```

### Custom Category Mappings

```typescript
import { FireflyDataTransformer, CategoryMapping } from './firefly';

const customMappings: CategoryMapping[] = [
  {
    fireflyCategory: 'My Custom Category',
    foodUSDCategory: 'groceries',
    description: 'Maps my custom category to groceries',
  },
];

const transformer = new FireflyDataTransformer(customMappings);
```

## Output Reports

### CALIBRATION_REPORT.md

Comprehensive markdown report including:
- Overall accuracy metrics
- Parameter adjustment table
- Detailed parameter reasoning
- Category spending comparison
- Actionable recommendations

**Example:**
```markdown
# PMOVES Firefly-iii Calibration Report

**Model:** AI-Enhanced Local Service Business
**Confidence Level:** HIGH
**Confidence Score:** 87.3/100

## Parameter Adjustments

| Parameter | Baseline | Calibrated | Adjustment | Confidence |
|-----------|----------|------------|------------|------------|
| weeklyFoodBudget | 150 | 162.45 | +8.3% | HIGH |
| participationRate | 0.75 | 0.68 | -9.3% | MEDIUM |
```

### category-comparison.csv

Category-level variance analysis:
```csv
Category,Actual,Simulated,Variance,Variance %
groceries,12450.50,11280.30,1170.20,10.38
prepared_food,3250.75,3890.15,-639.40,-16.45
```

### parameter-adjustments.csv

Detailed parameter calibration:
```csv
Parameter,Baseline,Calibrated,Adjustment,Adjustment %,Confidence,Reasoning
weeklyFoodBudget,150,162.45,12.45,8.30,high,"Based on 12 weeks of actual data..."
```

### weekly-comparison.csv

Week-by-week comparison:
```csv
Week,Start Date,Actual Spending,Baseline Revenue,Calibrated Revenue
1,2024-01-01,15234.50,14500.00,15100.00
2,2024-01-08,15892.30,14500.00,15100.00
```

## Configuration

### Environment Variables

Configuration can be provided via `.env` file (recommended), shell exports, or inline with the command.

**Via .env file (recommended):**
```bash
# Copy .env.example to .env and edit values
cp .env.example .env
```

**Available variables:**
```bash
# Required
FIREFLY_API_TOKEN="your-firefly-api-token"

# Optional
FIREFLY_URL="http://localhost:8080"      # Default: http://localhost:8080
TOTAL_POPULATION="500"                   # Default: 500 (for participation calculation)
```

### Analysis Period

```typescript
{
  analysis: {
    startDate: new Date('2024-01-01'),  // Analysis start
    endDate: new Date('2024-03-31'),    // Analysis end
    totalPopulation: 500,                // Total coop population
  }
}
```

**Recommendations:**
- Minimum: 4 weeks of data
- Recommended: 12 weeks (3 months)
- Optimal: 52 weeks (1 year)

## Integration with Phase 3

Phase 4 builds on Phase 3 (Projection Validation):

```typescript
import { ProjectionValidator } from './projections';
import { FireflyIntegration } from './firefly';

// Phase 3: Baseline simulation
const validator = new ProjectionValidator();
const baselineReport = await validator.validate(AI_ENHANCED_LOCAL_SERVICE);

// Phase 4: Calibrate with real data
const integration = new FireflyIntegration(config);
const calibratedResult = await integration.run(AI_ENHANCED_LOCAL_SERVICE);

// Compare
console.log('Baseline ROI:', baselineReport.actual.roi);
console.log('Calibrated ROI:', calibratedResult.calibrated.results.actualROI);
```

## Calibration Parameters

### 1. Weekly Food Budget

**Baseline:** $150/week per participant
**Calibration:** Average actual spending per participant

**Example Adjustment:**
- Actual: $162.45/week
- Adjustment: +$12.45 (+8.3%)
- Confidence: HIGH

### 2. Participation Rate

**Baseline:** 75%
**Calibration:** Active participants / Total population

**Example Adjustment:**
- Actual: 68%
- Adjustment: -7 percentage points (-9.3%)
- Confidence: MEDIUM

### 3. Category Distribution

**Baseline:**
- Groceries: 60%
- Prepared Food: 25%
- Farmers Market: 15%

**Calibration:** Actual category spending percentages

### 4. GroupPurchase Savings

**Baseline:** 15% savings
**Calibration:** Based on spending volatility (Coefficient of Variation)

**Validation Logic:**
- CV < 0.2 → 15% savings (stable pricing)
- CV 0.2-0.4 → 10% savings (moderate)
- CV > 0.4 → 5% savings (volatile)

## Testing

### Unit Tests

```bash
npm test integrations/firefly
npm test integrations/projections/calibration-engine
```

### Integration Test

```bash
# Requires running Firefly-iii instance
npm run test:integration
```

### Mock Data

```typescript
import { generateMockTransactions } from './test/mock-data';

const transactions = generateMockTransactions(90); // 90 days
const transformed = transformer.transform(transactions, 500);
```

## Troubleshooting

### "Failed to connect to Firefly-iii"

**Solution:**
1. Verify Firefly-iii is running: `curl http://localhost:8080/api/v1/about`
2. Check API token is valid
3. Ensure network connectivity

### "No food-related transactions found"

**Solution:**
1. Check transaction categories in Firefly-iii
2. Add custom category mappings if needed
3. Ensure date range contains data

### "Low confidence calibration"

**Causes:**
- Insufficient data (< 4 weeks)
- High spending volatility
- Inconsistent categorization

**Solutions:**
- Increase analysis period to 12+ weeks
- Improve transaction categorization in Firefly-iii
- Review spending patterns for anomalies

## API Reference

### FireflyClient

```typescript
class FireflyClient {
  constructor(config: Partial<FireflyConfig>)
  async testConnection(): Promise<boolean>
  async getTransactions(start: Date, end: Date): Promise<Transaction[]>
  async getSpendingByCategory(start: Date, end: Date): Promise<CategorySpending[]>
}
```

### FireflyDataTransformer

```typescript
class FireflyDataTransformer {
  constructor(customMappings?: CategoryMapping[])
  transform(transactions: Transaction[], population: number): TransformedData
  mapCategory(fireflyCategory: string): string
  filterFoodTransactions(transactions: Transaction[]): Transaction[]
}
```

### CalibrationEngine

```typescript
class CalibrationEngine {
  async calibrate(
    modelName: string,
    actualData: TransformedData,
    simulatedResults: SimulationResults,
    population: number
  ): Promise<CalibrationReport>

  applyCalibration(
    model: ProjectionModel,
    calibration: CalibrationReport
  ): ProjectionModel
}
```

### FireflyIntegration

```typescript
class FireflyIntegration {
  constructor(config: IntegrationConfig)
  async run(model: ProjectionModel): Promise<IntegrationResult>
  async fetchRealData(): Promise<TransformedData>
  async calibrateModel(...): Promise<CalibrationReport>
}
```

## Examples

See `run-integration.ts` for a complete working example.

## License

Part of the PMOVES token economy simulation suite.
