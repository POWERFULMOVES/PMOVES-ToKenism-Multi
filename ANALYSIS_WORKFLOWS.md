# PMOVES ToKenism Analysis Workflows

Comprehensive guide for running simulations, exporting data, and analyzing token economy models.

## Quick Start

```bash
cd integrations

# Run all tests
npm test

# Run contract simulation
npx ts-node contracts/example-contract-simulation.ts

# Export to Firefly-iii (PMOVES-Wealth)
npx ts-node firefly/export_sim_to_firefly.ts --dry-run  # Test mode
npx ts-node firefly/export_sim_to_firefly.ts            # Production
npx ts-node firefly/export_sim_to_firefly.ts --nats     # With NATS events
```

## Simulation Components

### 1. Contract Coordinator (`contracts/contract-coordinator.ts`)

The main orchestrator for all smart contract models. Coordinates:

| Contract | Purpose | Key Metrics |
|----------|---------|-------------|
| **GroToken** | Token distribution rewards | Total distributed, participation rate |
| **FoodUSD** | Stable spending currency | Transaction volume, spending patterns |
| **GroupPurchase** | Collective buying | Savings rate, order execution |
| **GroVault** | Token staking | Locked value, APR, voting power |
| **CoopGovernor** | Democratic governance | Proposals, votes, participation |

### 2. Running Simulations

#### Basic Contract Simulation
```typescript
import { ContractCoordinator } from './contracts/contract-coordinator';

const coordinator = new ContractCoordinator({
  groToken: {
    distributionMean: 0.5,
    distributionStd: 0.2,
    tokenValue: 2.0,
    participationRate: 0.20,
  },
  foodUSD: {
    pegValue: 1.0,
    foodCategories: ['groceries', 'prepared_food', 'dining'],
  },
  groupPurchase: {
    savingsRate: 0.15,
    minimumParticipants: 5,
  },
  groVault: {
    baseInterestRate: 0.02,
    lockBonusMultiplier: 0.5,
  },
  governance: {
    votingPeriodWeeks: 2,
    proposalThreshold: 100,
  },
});

// Initialize population
coordinator.initialize({
  addresses: ['0xMEMBER001', '0xMEMBER002', ...],
  initialWealth: [5000, 7500, ...],
});

// Process weekly
for (let week = 1; week <= 52; week++) {
  await coordinator.processWeek(week, householdBudgets);
}

// Get results
const stats = coordinator.getComprehensiveStats();
```

#### Projection Validation
```typescript
import { ProjectionValidator } from './projections/projection-validator';
import { AI_ENHANCED_LOCAL_SERVICE } from './projections/scenario-configs';

const validator = new ProjectionValidator();
const results = await validator.runSimulation(AI_ENHANCED_LOCAL_SERVICE, 52);

console.log(`Final Revenue: $${results.finalRevenue}`);
console.log(`Weekly History: ${results.weeklyRevenue}`);
```

### 3. Export to PMOVES-Wealth (Firefly-iii)

#### Configuration
```bash
# .env file
FIREFLY_URL=http://localhost:8080
FIREFLY_API_TOKEN=your-api-token
NATS_ENABLED=true
NATS_URL=nats://localhost:4222
```

#### Export Options
```bash
# Dry run (test without writing)
npx ts-node firefly/export_sim_to_firefly.ts --dry-run

# Full export
npx ts-node firefly/export_sim_to_firefly.ts

# With NATS event publishing
npx ts-node firefly/export_sim_to_firefly.ts --nats
```

#### NATS Events Published
- `tokenism.export.result.v1` - Export completion event
- `tokenism.simulation.result.v1` - Simulation data for downstream consumers

### 4. Analysis Metrics

#### GroToken Distribution
- **Total Supply**: Cumulative tokens distributed
- **Participation Rate**: % of population actively earning tokens
- **Token Value**: Current market value per token
- **Distribution Events**: Weekly reward transactions

#### FoodUSD Spending
- **Total Spent**: Cumulative spending volume
- **Transactions**: Number of purchases
- **Average per Holder**: Mean spending behavior
- **Category Breakdown**: Groceries, prepared food, dining

#### Group Buying
- **Orders Created**: Total group purchase attempts
- **Execution Rate**: % of orders that reached threshold
- **Savings Generated**: Total collective savings
- **Savings Rate**: Actual vs. assumed discount rate

#### Staking (GroVault)
- **Total Locked**: GRO tokens in staking positions
- **Active Positions**: Number of lock positions
- **Interest Accrued**: Rewards generated
- **Voting Power**: sqrt(amount) * (1 + 0.5 * (years - 1))
- **Average APR**: Effective annual return

#### Governance
- **Proposals**: Total submitted
- **Pass Rate**: Approved vs. rejected
- **Voter Turnout**: % of eligible voters participating
- **Power Concentration**: Distribution of voting power

## Calibration & Validation

### Calibration Engine
```typescript
import { CalibrationEngine } from './projections/calibration-engine';

const engine = new CalibrationEngine();

// Adjust parameters based on real-world data
engine.calibrate({
  observedParticipation: 0.25,
  observedSavingsRate: 0.12,
  observedStakingRate: 0.08,
});
```

### Validation Checks
| Check | Expected | Tolerance |
|-------|----------|-----------|
| Savings Rate | 15% | ±5% |
| Participation | 20% | ±10% |
| Staking APR | 2-5% | ±1% |
| Governance Turnout | >10% | N/A |

## Integration with PMOVES.AI

### NATS Event Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Simulation    │────▶│      NATS       │────▶│  PMOVES.AI      │
│   Export        │     │  Message Bus    │     │  Consumers      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  Firefly-iii    │
                        │  (Wealth Track) │
                        └─────────────────┘
```

### Event Subjects
- `tokenism.simulation.result.v1` - Simulation completion
- `tokenism.export.result.v1` - Export to Firefly
- `tokenism.contract.event.v1` - Contract interactions

## Next.js Dashboard

Start the web dashboard for interactive analysis:

```bash
cd pmoves-nextjs
npm install
npm run dev
# Open http://localhost:3000
```

### Dashboard Features
- **Simulation Form**: Configure parameters
- **Results View**: Visual metrics display
- **Charts**: Violin, Sankey, Waterfall, Heatmap
- **Sensitivity Analysis**: Parameter impact testing
- **Scenario Comparison**: Multiple config comparison

## Advanced Workflows

### Monte Carlo Analysis
```typescript
const runs = 100;
const results = [];

for (let i = 0; i < runs; i++) {
  const coordinator = new ContractCoordinator(config);
  coordinator.initialize({ addresses, initialWealth });

  for (let week = 1; week <= 52; week++) {
    await coordinator.processWeek(week, generateRandomBudgets());
  }

  results.push(coordinator.getComprehensiveStats());
}

// Analyze distribution
const avgSavings = results.map(r => r.groupPurchase.totalSaved);
console.log(`Mean Savings: $${mean(avgSavings)}`);
console.log(`Std Dev: $${stdDev(avgSavings)}`);
```

### Batch Export
```bash
# Export multiple scenarios
for scenario in baseline optimistic pessimistic; do
  SCENARIO=$scenario npx ts-node firefly/export_sim_to_firefly.ts --nats
done
```

## Troubleshooting

### Common Issues

1. **NATS Connection Failed**
   ```bash
   # Check NATS is running
   nats server check connection
   ```

2. **Firefly API Error**
   ```bash
   # Verify token
   curl -H "Authorization: Bearer $FIREFLY_API_TOKEN" \
     http://localhost:8080/api/v1/about
   ```

3. **Test Failures**
   ```bash
   # Run specific test
   npm test -- --testPathPattern=grotoken
   ```

## Related Documentation

- [Technical Guide](./TECHNICAL_GUIDE.md) - Deep technical details
- [User Guide](./USER_GUIDE.md) - End-user documentation
- [API Reference](./API_REFERENCE.md) - Complete API docs
- [Integration Architecture](./INTEGRATION_ARCHITECTURE.md) - System design
