# PMOVES Technical Guide

Comprehensive technical documentation for developers, architects, and contributors to the PMOVES Token Economy Simulator.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Design Patterns](#design-patterns)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Testing Strategy](#testing-strategy)
6. [Development Workflow](#development-workflow)
7. [Code Standards](#code-standards)
8. [Performance Optimization](#performance-optimization)
9. [Security Considerations](#security-considerations)
10. [Contributing](#contributing)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PMOVES Token Economy                          │
│                   Simulation & Validation                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┬─────────────┐
                ↓             ↓             ↓             ↓
         ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
         │  Phase 1   │  │  Phase 2   │  │  Phase 3   │  │  Phase 4   │
         │ Event Bus  │→ │ Contracts  │→ │Projections │→ │  Firefly   │
         └────────────┘  └────────────┘  └────────────┘  └────────────┘
              │                │                │                │
              ↓                ↓                ↓                ↓
         Pub/Sub          5 Contract        Validation      Real Data
         Messaging         Models           Framework      Calibration
```

### Four-Phase Architecture

PMOVES is built in four progressive phases, each building on the previous:

#### Phase 1: Event Bus (Foundation)

**Purpose:** Decoupled communication between components

**Components:**

- `EventBus` - Core pub/sub event system
- `SchemaValidator` - Event schema validation
- Event topics for contract communication

**Key Files:**

- `integrations/event-bus/event-bus.ts` (295 lines)
- `integrations/event-bus/schema-validator.ts`
- `integrations/event-bus/schemas/` (JSON schemas)

**Design Pattern:** Pub/Sub (Publisher-Subscriber)

**Why:** Enables loose coupling between contracts, allowing independent development and testing.

#### Phase 2: Contract Integration (Business Logic)

**Purpose:** Simulate 5 smart contract models

**Components:**

- `GroTokenDistribution` - Token distribution model
- `FoodUSDModel` - Stablecoin spending tracker
- `GroupPurchaseModel` - Cooperative buying mechanism
- `GroVaultModel` - Token staking & rewards
- `CoopGovernorModel` - Quadratic voting governance
- `ContractCoordinator` - Unified orchestration

**Key Files:**

- `integrations/contracts/grotoken-model.ts`
- `integrations/contracts/foodusd-model.ts`
- `integrations/contracts/grouppurchase-model.ts`
- `integrations/contracts/grovault-model.ts`
- `integrations/contracts/coopgovernor-model.ts`
- `integrations/contracts/contract-coordinator.ts` (410 lines)

**Design Pattern:** Coordinator Pattern

**Why:** Centralized coordination of 5 independent contract models with shared state management.

#### Phase 3: Projection Validation (Analysis)

**Purpose:** Validate 5-year business projections against simulations

**Components:**

- `ProjectionValidator` - Core validation engine
- Scenario configurations (3 baseline + 2 market variants)
- Variance analysis & risk assessment
- Report generation (Markdown + CSV)

**Key Files:**

- `integrations/projections/projection-validator.ts` (465 lines)
- `integrations/projections/scenario-configs.ts` (228 lines)
- `integrations/projections/export-results.ts`

**Design Pattern:** Strategy Pattern (market scenarios)

**Why:** Allows flexible comparison of different business models and market conditions.

#### Phase 4: Firefly Integration (Real Data)

**Purpose:** Calibrate projections using real financial data

**Components:**

- `FireflyClient` - HTTP client for Firefly-iii API
- `FireflyDataTransformer` - Category mapping & aggregation
- `CalibrationEngine` - Parameter calibration logic
- `FireflyIntegration` - Pipeline coordinator

**Key Files:**

- `integrations/firefly/firefly-client.ts`
- `integrations/firefly/data-transformer.ts` (413 lines)
- `integrations/firefly/calibration-engine.ts` (391 lines)
- `integrations/firefly/firefly-integration.ts` (449 lines)

**Design Pattern:** Pipeline Pattern

**Why:** Enables step-by-step data transformation, calibration, and validation.

---

## Design Patterns

### 1. Pub/Sub (Event Bus)

**Implementation:**

```typescript
// Publisher
eventBus.publish(
  'finance.transactions.ingested.v1',
  {
    namespace: 'grotoken',
    transactions: [...],
    ingested_at: new Date().toISOString(),
  },
  'grotoken-distribution'
);

// Subscriber
eventBus.subscribe('finance.transactions.ingested.v1', async (event) => {
  console.log('Received transaction:', event.data);
});
```

**Benefits:**

- Decouples producers and consumers
- Enables asynchronous processing
- Supports multiple subscribers per topic
- Built-in retry logic with exponential backoff

**Event Envelope Structure:**

```typescript
interface EventEnvelope<T> {
  id: string; // Unique event ID
  topic: string; // Event topic (e.g., 'finance.transactions.ingested.v1')
  timestamp: string; // ISO 8601 timestamp
  source: string; // Component that published event
  data: T; // Event payload
  metadata?: Record<string, any>; // Optional metadata (retry count, etc.)
}
```

### 2. Coordinator Pattern (Contract Coordinator)

**Implementation:**

```typescript
export class ContractCoordinator {
  private groToken: GroTokenDistribution;
  private foodUSD: FoodUSDModel;
  private groupPurchase: GroupPurchaseModel;
  private groVault: GroVaultModel;
  private governance: CoopGovernorModel;

  async processWeek(week: number, budgets: Map<...>): Promise<void> {
    // 1. Distribute tokens
    const tokenEvents = this.groToken.distributeWeekly(week);

    // 2. Fund accounts
    for (const [address, budget] of budgets) {
      this.foodUSD.fundAccount(address, budget.foodBudget);
    }

    // 3. Process spending
    // 4. Accrue staking interest
  }
}
```

**Benefits:**

- Centralized orchestration of 5 models
- Single source of truth for simulation state
- Simplified API for consumers
- Encapsulates complexity

### 3. Strategy Pattern (Market Scenarios)

**Implementation:**

```typescript
// Define strategies
export const MARKET_SCENARIOS = {
  bull: {
    roiMultiplier: 1.5,
    growthAcceleration: 1.3,
  },
  normal: {
    roiMultiplier: 1.0,
    growthAcceleration: 1.0,
  },
  bear: {
    roiMultiplier: 0.6,
    growthAcceleration: 0.7,
  },
};

// Apply strategy
const BULL_MARKET: ProjectionModel = {
  ...BASE_MODEL,
  projectedRiskAdjustedROI: BASE_MODEL.projectedRiskAdjustedROI * 1.5,
  growthRatePerWeek: BASE_MODEL.growthRatePerWeek * 1.3,
};
```

**Benefits:**

- Easily test different market conditions
- Compare best/worst case scenarios
- Reusable scenario definitions

### 4. Pipeline Pattern (Firefly Integration)

**Implementation:**

```typescript
async run(model: ProjectionModel): Promise<IntegrationResult> {
  // 1. Fetch real data
  const actualData = await this.fetchRealData();

  // 2. Run baseline simulation
  const baselineResults = await this.runBaselineSimulation(model);

  // 3. Calibrate model
  const calibration = await this.calibrateModel(model, actualData, baselineResults);

  // 4. Run calibrated simulation
  const calibratedResults = await this.runCalibratedSimulation(model, calibration);

  // 5. Generate reports
  await this.generateReports({...});

  return result;
}
```

**Benefits:**

- Clear step-by-step processing
- Easy to test individual stages
- Transparent data flow
- Error handling at each stage

### 5. Factory Pattern (Model Creation)

**Implementation:**

```typescript
// Factory for creating configured models
export class ModelFactory {
  static createGroToken(config?: Partial<GroTokenConfig>): GroTokenDistribution {
    return new GroTokenDistribution({
      pricePerToken: 2.0,
      distributionAmount: 25,
      ...config,
    });
  }

  static createContractCoordinator(
    config?: ContractCoordinatorConfig
  ): ContractCoordinator {
    return new ContractCoordinator({
      groToken: config?.groToken,
      foodUSD: config?.foodUSD,
      ...
    });
  }
}
```

---

## Component Architecture

### Event Bus Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Event Bus                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │ Schema Validator │      │ Event Emitter    │   │
│  │                  │      │ (Node.js)        │   │
│  │ - Load schemas   │      │ - Publish/       │   │
│  │ - Validate data  │      │   Subscribe      │   │
│  │ - Get topics     │      │ - Routing        │   │
│  └──────────────────┘      └──────────────────┘   │
│           │                         │              │
│           └─────────┬───────────────┘              │
│                     ↓                              │
│            ┌─────────────────┐                     │
│            │ Retry Queue     │                     │
│            │ - Max 3 retries │                     │
│            │ - Exponential   │                     │
│            │   backoff       │                     │
│            └─────────────────┘                     │
│                                                     │
│  Metrics:                                          │
│  - published.total                                 │
│  - handled.{topic}                                 │
│  - errors.{topic}                                  │
└─────────────────────────────────────────────────────┘
```

**Key Features:**

- **Schema Validation:** All events validated against JSON schemas
- **Retry Logic:** Failed handlers retried up to 3 times with exponential backoff
- **Metrics:** Built-in metrics for published, handled, and failed events
- **Global Handler:** Subscribe to all events with `subscribeAll('*', handler)`

**Event Topics:**

```typescript
// Phase 2: Contract events
"finance.transactions.ingested.v1";
"contracts.initialized.v1";

// Future phases
"governance.proposal.created.v1";
"staking.lock.created.v1";
```

### Contract Model Architecture

Each contract model follows the same structure:

```typescript
export class ContractModel {
  // Configuration
  private config: ModelConfig;

  // State
  private participants: Map<string, ParticipantData>;
  private transactions: Transaction[];

  // Initialization
  constructor(config?: Partial<ModelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initializeHolders(addresses: string[]): void {
    // Initialize state for each participant
  }

  // Business logic
  processWeeklyActivity(week: number, ...): void {
    // Core weekly processing
  }

  // Queries
  getStatistics(): ModelStatistics {
    // Calculate aggregate statistics
  }

  // Utilities
  exportData(): ExportData {
    // Export for analysis
  }
}
```

**5 Contract Models:**

1. **GroTokenDistribution** - Token distribution

   - Gaussian distribution (Box-Muller transform)
   - Weekly rewards to 60% of participants
   - $2 per token value

2. **FoodUSDModel** - Food spending tracker

   - Category-based spending (groceries, dining, etc.)
   - Weekly budget allocation
   - Total spent tracking

3. **GroupPurchaseModel** - Cooperative purchasing

   - Order creation & contribution
   - 15% savings calculation
   - Participant savings tracking

4. **GroVaultModel** - Token staking

   - Time-locked staking (1-4 years)
   - APY: 10-50% based on lock duration
   - Voting power calculation

5. **CoopGovernorModel** - Governance
   - Quadratic voting (votes = sqrt(tokens))
   - Proposal creation & voting
   - Participation rate tracking

### Validation Architecture

```
┌───────────────────────────────────────────────────────┐
│              Projection Validator                     │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Input: ProjectionModel                              │
│  ┌────────────────────────────────────┐              │
│  │ - initialInvestment: 5000          │              │
│  │ - projectedYear5Revenue: 94277     │              │
│  │ - projectedRiskAdjustedROI: 13.66  │              │
│  │ - populationSize: 500              │              │
│  │ - participationRate: 0.75          │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  ┌────────────────────────────────────┐              │
│  │ 1. Create ContractCoordinator      │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  ┌────────────────────────────────────┐              │
│  │ 2. Initialize Population           │              │
│  │    - Generate Ethereum addresses   │              │
│  │    - Set initial budgets           │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  ┌────────────────────────────────────┐              │
│  │ 3. Simulate 260 Weeks              │              │
│  │    for week = 1 to 260:            │              │
│  │      - Distribute tokens           │              │
│  │      - Process spending            │              │
│  │      - Accrue staking interest     │              │
│  │      - Track cumulative profit     │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  ┌────────────────────────────────────┐              │
│  │ 4. Calculate Variance              │              │
│  │    - Revenue variance              │              │
│  │    - ROI variance                  │              │
│  │    - Break-even variance           │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  ┌────────────────────────────────────┐              │
│  │ 5. Risk Assessment                 │              │
│  │    - Check success criteria        │              │
│  │    - Assign risk level             │              │
│  │    - Calculate confidence          │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Output: ValidationReport                            │
│  ┌────────────────────────────────────┐              │
│  │ - actual: { revenue, roi, ... }    │              │
│  │ - variance: { revenueVariance, ... }│              │
│  │ - riskAssessment: { ... }          │              │
│  │ - weeklyData: [ ... ]              │              │
│  └────────────────────────────────────┘              │
└───────────────────────────────────────────────────────┘
```

**Key Algorithms:**

**1. Revenue Calculation:**

```typescript
for (let week = 1; week <= 260; week++) {
  const participatingCount = Math.floor(populationSize * participationRate);
  const baseRevenue = weeklyRevenuePerParticipant * participatingCount;
  const growthMultiplier = Math.pow(1 + growthRatePerWeek, week - 1);
  const weeklyRevenue = baseRevenue * growthMultiplier;

  cumulativeRevenue += weeklyRevenue;
}
```

**2. Break-Even Detection:**

```typescript
for (let week = 1; week <= 260; week++) {
  const cumulativeProfit = cumulativeRevenue - initialInvestment;

  if (cumulativeProfit >= 0 && !breakEvenAchieved) {
    breakEvenWeek = week;
    breakEvenMonths = week / 4.33; // Convert to months
    breakEvenAchieved = true;
  }
}
```

**3. Variance Analysis:**

```typescript
const projectedROIPercent = model.projectedRiskAdjustedROI * 100;
const roiVariance =
  ((actualROI - projectedROIPercent) / projectedROIPercent) * 100;

const revenueVariance =
  ((actualRevenue - projectedRevenue) / projectedRevenue) * 100;
```

### Calibration Architecture

```
┌───────────────────────────────────────────────────────┐
│            Firefly Integration Pipeline               │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Step 1: Fetch Real Data                             │
│  ┌────────────────────────────────────┐              │
│  │ FireflyClient.getTransactions()    │              │
│  │ - Date range: last 90 days        │              │
│  │ - Categories: food-related         │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Step 2: Transform Data                              │
│  ┌────────────────────────────────────┐              │
│  │ FireflyDataTransformer.transform() │              │
│  │ - Map categories                   │              │
│  │ - Aggregate weekly                 │              │
│  │ - Calculate participation          │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Step 3: Baseline Simulation                         │
│  ┌────────────────────────────────────┐              │
│  │ ProjectionValidator.validate()     │              │
│  │ - Run with original parameters     │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Step 4: Calibrate Parameters                        │
│  ┌────────────────────────────────────┐              │
│  │ CalibrationEngine.calibrate()      │              │
│  │ - Compare actual vs simulated      │              │
│  │ - Adjust 4 key parameters          │              │
│  │ - Calculate confidence scores      │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Step 5: Calibrated Simulation                       │
│  ┌────────────────────────────────────┐              │
│  │ ProjectionValidator.validate()     │              │
│  │ - Run with calibrated parameters   │              │
│  └────────────────────────────────────┘              │
│                     ↓                                 │
│  Step 6: Generate Reports                            │
│  ┌────────────────────────────────────┐              │
│  │ - CALIBRATION_REPORT.md            │              │
│  │ - category-comparison.csv          │              │
│  │ - parameter-adjustments.csv        │              │
│  │ - weekly-comparison.csv            │              │
│  └────────────────────────────────────┘              │
└───────────────────────────────────────────────────────┘
```

**Calibrated Parameters:**

1. **weeklyFoodBudget** - Average weekly spending per participant

   ```typescript
   const calibratedBudget =
     actualData.weeklySpending.reduce(
       (sum, week) => sum + week.totalSpending,
       0
     ) / actualData.weeklySpending.length;
   ```

2. **participationRate** - Active participants / total population

   ```typescript
   const calibratedRate =
     actualData.participation.activeParticipants / totalPopulation;
   ```

3. **categoryDistribution** - Percentage breakdown by category

   ```typescript
   const calibratedDist = {
     groceries: actualData.categoryDistribution.groceries,
     prepared_food: actualData.categoryDistribution.prepared_food,
     // ...
   };
   ```

4. **groupPurchaseSavings** - Validated based on spending volatility
   ```typescript
   const cv = stdDev / mean; // Coefficient of Variation
   const calibratedSavings = cv < 0.2 ? 0.15 : cv < 0.4 ? 0.1 : 0.05;
   ```

---

## Data Flow

### End-to-End Simulation Flow

```
1. User initiates validation
   ↓
2. ProjectionValidator.validate(model)
   ↓
3. Create ContractCoordinator
   ├→ GroTokenDistribution
   ├→ FoodUSDModel
   ├→ GroupPurchaseModel
   ├→ GroVaultModel
   └→ CoopGovernorModel
   ↓
4. Initialize population
   ├→ Generate 500 Ethereum addresses (ethers.Wallet.createRandom())
   ├→ Initialize balances to 0
   └→ Set participation flags
   ↓
5. For each week (1-260):
   ├→ Distribute GroTokens (Gaussian distribution)
   │  └→ Publish 'finance.transactions.ingested.v1' events
   ├→ Fund FoodUSD accounts (weekly budget)
   ├→ Process food spending (60% groceries, 25% prepared, 15% dining)
   ├→ Create group purchase orders (15% savings)
   ├→ Accrue staking interest (APY based on lock duration)
   ├→ Track cumulative revenue & profit
   └→ Detect break-even point
   ↓
6. Calculate aggregate statistics
   ├→ Total revenue (sum of all weekly revenue)
   ├→ ROI ((profit / investment) * 100)
   ├→ Break-even (week when profit > 0)
   ├→ Token value ($2/token × tokens distributed)
   └→ Group savings (15% × group purchase volume)
   ↓
7. Compare actual vs projected
   ├→ Revenue variance
   ├→ ROI variance
   └→ Break-even variance
   ↓
8. Risk assessment
   ├→ Success criteria check
   ├→ Risk level assignment
   └→ Confidence level calculation
   ↓
9. Generate reports
   ├→ Markdown summary
   ├→ CSV exports (3 files)
   └→ Console output
```

### Firefly Integration Data Flow

```
1. User runs FireflyIntegration.run()
   ↓
2. FireflyClient.getTransactions(startDate, endDate)
   ├→ HTTP GET /api/v1/transactions?start={}&end={}
   ├→ Filter by food-related categories
   └→ Return Transaction[]
   ↓
3. FireflyDataTransformer.transform(transactions, population)
   ├→ Map Firefly categories → FoodUSD categories
   │  Example: 'Groceries' → 'groceries'
   ├→ Group by week (ISO week)
   │  └→ Aggregate spending per week
   ├→ Calculate participation metrics
   │  ├→ Active participants (≥1 transaction/week)
   │  └→ Participation rate (active / total)
   └→ Return TransformedData
   ↓
4. ProjectionValidator.validate(baselineModel)
   └→ Run 260-week simulation with original parameters
   ↓
5. CalibrationEngine.calibrate(model, actualData, simulatedResults)
   ├→ Compare actual vs simulated spending
   ├→ Calculate parameter adjustments
   │  ├→ weeklyFoodBudget: actual avg vs baseline
   │  ├→ participationRate: actual % vs baseline
   │  ├→ categoryDistribution: actual % vs baseline
   │  └→ groupPurchaseSavings: validate based on CV
   ├→ Calculate confidence scores
   │  ├→ HIGH: variance ≤ 10%
   │  ├→ MEDIUM: variance 10-25%
   │  └→ LOW: variance > 25%
   └→ Return CalibrationReport
   ↓
6. Apply calibration to model
   ├→ Update model.weeklyRevenuePerParticipant
   ├→ Update model.participationRate
   └→ Update model.categoryDistribution (if applicable)
   ↓
7. ProjectionValidator.validate(calibratedModel)
   └→ Run 260-week simulation with calibrated parameters
   ↓
8. Compare baseline vs calibrated results
   ├→ Revenue improvement
   ├→ ROI change
   └→ Break-even change
   ↓
9. Generate 4 reports
   ├→ CALIBRATION_REPORT.md (comprehensive markdown)
   ├→ category-comparison.csv (category-level variance)
   ├→ parameter-adjustments.csv (parameter changes)
   └→ weekly-comparison.csv (week-by-week comparison)
```

### Simulation Export Data Flow

```
1. User runs npm run firefly:export-sim
   ↓
2. ProjectionValidator.runSimulation()
   └→ Run 52-week baseline simulation
   ↓
3. Select Representative Agents
   ├→ Average Member (1.0x spending)
   ├→ High Spender (1.5x spending)
   └→ Saver (0.7x spending)
   ↓
4. FireflyClient.createAccount()
   └→ Create Asset Account for each agent
   ↓
5. Generate Transactions
   ├→ De-aggregate weekly simulation data
   ├→ Create Income transactions (Deposit)
   └→ Create Expense transactions (Withdrawal)
   ↓
6. FireflyClient.createTransaction()
   └→ Batch upload to Firefly API
```

---

## Testing Strategy

### Test Coverage Targets

| Component            | Target | Actual       |
| -------------------- | ------ | ------------ |
| Event Bus            | 100%   | 100%         |
| Contract Models      | 95%    | 95%+         |
| Projection Validator | 90%    | 90%+         |
| Firefly Integration  | 85%    | Mock testing |

### Testing Pyramid

```
                    ┌──────────────┐
                    │  E2E Tests   │  <-- Full integration (1-2 tests)
                    │  (Slowest)   │
                    └──────────────┘
                 ┌──────────────────┐
                 │ Integration Tests│  <-- Multi-component (10-15 tests)
                 │   (Moderate)     │
                 └──────────────────┘
            ┌─────────────────────────┐
            │     Unit Tests          │  <-- Single component (100+ tests)
            │     (Fastest)           │
            └─────────────────────────┘
```

### Unit Tests

**Example: GroTokenDistribution**

```typescript
describe("GroTokenDistribution", () => {
  let distribution: GroTokenDistribution;

  beforeEach(() => {
    distribution = new GroTokenDistribution({
      pricePerToken: 2.0,
      distributionAmount: 25,
      distributionProbability: 0.6,
    });
  });

  it("should initialize holders correctly", () => {
    const addresses = ["0xABC...", "0xDEF..."];
    distribution.initializeHolders(addresses);

    const stats = distribution.getStatistics();
    expect(stats.totalHolders).toBe(2);
  });

  it("should distribute tokens with correct probability", () => {
    const addresses = generateAddresses(100);
    distribution.initializeHolders(addresses);

    const events = distribution.distributeWeekly(1);

    // Should distribute to ~60 out of 100 (with variance)
    expect(events.length).toBeGreaterThan(50);
    expect(events.length).toBeLessThan(70);
  });

  it("should use Gaussian distribution for amounts", () => {
    // Test that distribution follows normal curve
  });
});
```

### Integration Tests

**Example: ContractCoordinator**

```typescript
describe("ContractCoordinator Integration", () => {
  let coordinator: ContractCoordinator;

  beforeEach(() => {
    coordinator = new ContractCoordinator({});
    const population = {
      addresses: generateAddresses(100),
      initialWealth: new Array(100).fill(0),
    };
    coordinator.initialize(population);
  });

  it("should process a complete week", async () => {
    const budgets = new Map();
    for (let i = 0; i < 100; i++) {
      budgets.set(`0x${i}`, { foodBudget: 150, totalIncome: 1000 });
    }

    await coordinator.processWeek(1, budgets);

    const stats = coordinator.getComprehensiveStats();

    // Verify token distribution occurred
    expect(stats.groToken.totalDistributed).toBeGreaterThan(0);

    // Verify food spending tracked
    expect(stats.foodUSD.totalSpent).toBeGreaterThan(0);
  });
});
```

### End-to-End Tests

**Example: Full Validation**

```typescript
describe("Projection Validation E2E", () => {
  it("should validate AI-Enhanced Local Service model", async () => {
    const validator = new ProjectionValidator();

    const report = await validator.validate(AI_ENHANCED_LOCAL_SERVICE);

    // Verify report structure
    expect(report.model).toBe("AI-Enhanced Local Service Business");
    expect(report.actual.revenue).toBeGreaterThan(0);
    expect(report.actual.roi).toBeGreaterThan(0);

    // Verify variance calculations
    expect(report.variance.revenueVariance).toBeDefined();
    expect(report.variance.roiVariance).toBeDefined();

    // Verify risk assessment
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(
      report.riskAssessment.riskLevel
    );
  }, 120000); // 2-minute timeout for full simulation
});
```

### Mock Data Generation

**Firefly Transactions:**

```typescript
export function generateMockTransactions(days: number): Transaction[] {
  const transactions: Transaction[] = [];
  const categories = [
    "Groceries",
    "Restaurants",
    "Fast Food",
    "Farmers Market",
  ];

  for (let day = 0; day < days; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);

    // 2-4 transactions per day
    const dailyCount = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < dailyCount; i++) {
      transactions.push({
        id: `txn_${day}_${i}`,
        amount: 10 + Math.random() * 90, // $10-$100
        category: categories[Math.floor(Math.random() * categories.length)],
        date: date.toISOString(),
        description: `Food purchase ${day}-${i}`,
      });
    }
  }

  return transactions;
}
```

### Continuous Integration

**GitHub Actions Workflow:**

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: "18"

      - name: Install dependencies
        run: |
          cd integrations
          npm ci

      - name: Run tests
        run: |
          cd integrations
          npm test

      - name: Run linter
        run: |
          cd integrations
          npm run lint
```

---

## Development Workflow

### Setup Development Environment

```bash
# Clone repository
git clone https://github.com/POWERFULMOVES/PMOVEStokensim.git
cd PMOVEStokensim/integrations

# Install dependencies
npm install

# Run tests (watch mode)
npm run test:watch

# Build TypeScript
npm run build
```

### Branch Strategy

```
main
  └── develop
       ├── feature/phase-5-xxx
       ├── bugfix/fix-roi-calculation
       └── refactor/improve-performance
```

**Branch Naming:**

- `feature/` - New features
- `bugfix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Test updates
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `chore:` - Maintenance

**Examples:**

```bash
git commit -m "feat(firefly): add custom category mapping support"
git commit -m "fix(validator): correct ROI calculation (percentage vs decimal)"
git commit -m "docs(api): add CalibrationEngine API reference"
```

### Code Review Checklist

- [ ] Tests added/updated
- [ ] TypeScript strict mode compliance
- [ ] No `any` types (use explicit types)
- [ ] Documentation updated
- [ ] Performance acceptable (<10 seconds per model)
- [ ] No console.error in production code
- [ ] CSV exports properly escaped

---

## Code Standards

### TypeScript Best Practices

**1. Use Strict Mode:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**2. Explicit Return Types:**

```typescript
// Good
function calculateROI(profit: number, investment: number): number {
  return (profit / investment) * 100;
}

// Bad
function calculateROI(profit, investment) {
  // Implicit any
  return (profit / investment) * 100;
}
```

**3. Use Type Guards:**

```typescript
function isTransaction(obj: any): obj is Transaction {
  return obj && typeof obj.id === "string" && typeof obj.amount === "number";
}

if (isTransaction(data)) {
  // TypeScript knows data is Transaction here
  console.log(data.amount);
}
```

**4. Avoid `any`:**

```typescript
// Good
interface EventData {
  namespace: string;
  transactions: Transaction[];
}

// Bad
function handleEvent(data: any): void {
  // Use specific type instead
  //...
}
```

### Documentation Standards

**1. JSDoc for Public APIs:**

````typescript
/**
 * Validates a projection model against simulated results
 *
 * @param model - The projection model to validate
 * @returns Validation report with variance analysis and risk assessment
 *
 * @example
 * ```typescript
 * const validator = new ProjectionValidator();
 * const report = await validator.validate(AI_ENHANCED_LOCAL_SERVICE);
 * console.log(`ROI: ${report.actual.roi}%`);
 * ```
 */
async validate(model: ProjectionModel): Promise<ValidationReport> {
  // ...
}
````

**2. Inline Comments for Complex Logic:**

```typescript
// Convert projected ROI from decimal (13.66) to percentage (1366%)
// to match actualROI format before variance calculation
const projectedROIPercent = model.projectedRiskAdjustedROI * 100;
const roiVariance =
  ((actualROI - projectedROIPercent) / projectedROIPercent) * 100;
```

**3. README per Module:**

Each phase has its own README:

- `integrations/event-bus/README.md`
- `integrations/contracts/README.md`
- `integrations/projections/README.md`
- `integrations/firefly/README.md`

### Naming Conventions

**Files:**

- `kebab-case.ts` for source files
- `PascalCase.test.ts` for test files

**Classes:**

- `PascalCase` (e.g., `ProjectionValidator`, `FireflyClient`)

**Interfaces:**

- `PascalCase` (e.g., `ProjectionModel`, `ValidationReport`)

**Functions/Methods:**

- `camelCase` (e.g., `calculateROI`, `getStatistics`)

**Constants:**

- `UPPER_SNAKE_CASE` (e.g., `DEFAULT_CONFIG`, `MAX_RETRIES`)

**Private Members:**

- Prefix with `private` keyword (TypeScript enforces)

---

## Performance Optimization

### Benchmark Results

| Operation                  | Duration | Optimizations                         |
| -------------------------- | -------- | ------------------------------------- |
| Single model validation    | ~60s     | Acceptable                            |
| Full validation (5 models) | ~5-6min  | Sequential (prevents race conditions) |
| Firefly calibration        | ~2-3min  | HTTP caching, batch processing        |

### Optimization Techniques

**1. Avoid Race Conditions:**

```typescript
// Before: Parallel execution causes state pollution
const reports = await Promise.all(
  models.map((model) => validator.validate(model))
);

// After: Sequential execution ensures clean state
const reports: ValidationReport[] = [];
for (const model of models) {
  reports.push(await validator.validate(model));
}
```

**2. Efficient Data Structures:**

```typescript
// Use Map for O(1) lookups instead of Array.find() O(n)
private participants: Map<string, ParticipantData>;

// Good
const participant = this.participants.get(address);

// Bad
const participant = this.participantsArray.find(p => p.address === address);
```

**3. Lazy Loading:**

```typescript
private _statistics?: ModelStatistics;

getStatistics(): ModelStatistics {
  if (!this._statistics) {
    this._statistics = this.calculateStatistics();
  }
  return this._statistics;
}
```

**4. Batch Processing:**

```typescript
// Process transactions in batches of 100
const batchSize = 100;
for (let i = 0; i < transactions.length; i += batchSize) {
  const batch = transactions.slice(i, i + batchSize);
  await this.processBatch(batch);
}
```

---

## Security Considerations

### Input Validation

**1. Validate All External Inputs:**

```typescript
// Firefly API responses
const transactions = await response.json();

if (!Array.isArray(transactions)) {
  throw new Error("Invalid response: expected array");
}

for (const txn of transactions) {
  if (!isTransaction(txn)) {
    console.warn("Skipping invalid transaction:", txn);
    continue;
  }
}
```

**2. Sanitize File Paths:**

```typescript
import path from "path";

function exportToFile(filename: string, data: string): void {
  // Prevent directory traversal
  const safePath = path.basename(filename);
  const fullPath = path.join("./output", safePath);

  fs.writeFileSync(fullPath, data);
}
```

### API Security

**1. Secure API Tokens:**

```bash
# Never commit tokens to git
export FIREFLY_API_TOKEN="your-token"

# Use .env files (gitignored)
echo "FIREFLY_API_TOKEN=your-token" >> .env
```

**2. HTTPS Only:**

```typescript
const config = {
  baseUrl: process.env.FIREFLY_URL || "https://localhost:8080", // HTTPS default
  apiToken: process.env.FIREFLY_API_TOKEN,
};

// Validate HTTPS
if (!config.baseUrl.startsWith("https://")) {
  console.warn("Warning: Using HTTP instead of HTTPS");
}
```

### Data Privacy

**1. No PII in Logs:**

```typescript
// Good
console.log(`Processing ${transactions.length} transactions`);

// Bad
console.log(`Processing transactions for user ${email}`); // Logs PII
```

**2. Anonymize Addresses:**

```typescript
// Use deterministic hashing for reproducibility
import { createHash } from "crypto";

function anonymizeAddress(address: string): string {
  return createHash("sha256").update(address).digest("hex").slice(0, 10);
}
```

---

## Contributing

### Pull Request Process

1. **Fork the repository**
2. **Create feature branch:** `git checkout -b feature/my-feature`
3. **Make changes** with tests
4. **Run tests:** `npm test`
5. **Run linter:** `npm run lint`
6. **Commit:** `git commit -m "feat(scope): description"`
7. **Push:** `git push origin feature/my-feature`
8. **Open Pull Request** with description

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist

- [ ] TypeScript strict mode compliance
- [ ] No `any` types
- [ ] Documentation updated
- [ ] Performance acceptable
```

### Code Review Guidelines

**Reviewers should check:**

- Correctness of business logic
- Test coverage
- Performance impact
- Security implications
- Documentation clarity

---

## Additional Resources

### Internal Documentation

- **[User Guide](USER_GUIDE.md)** - End-user documentation
- **[API Reference](API_REFERENCE.md)** - Complete API docs
- **[Folder Structure](FOLDER_STRUCTURE.md)** - Project organization
- **[Quick Start](QUICK_START.md)** - Getting started guide

### External Resources

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Jest Documentation](https://jestjs.io/docs/)**
- **[Firefly-iii API Docs](https://api-docs.firefly-iii.org/)**

---

<p align="center">
  <a href="README.md">Main README</a> •
  <a href="USER_GUIDE.md">User Guide</a> •
  <a href="API_REFERENCE.md">API Reference</a> •
  <a href="FOLDER_STRUCTURE.md">Folder Structure</a>
</p>

<p align="center">
  <strong>PMOVES Technical Guide</strong><br>
  Last updated: 2025-11-15
</p>
