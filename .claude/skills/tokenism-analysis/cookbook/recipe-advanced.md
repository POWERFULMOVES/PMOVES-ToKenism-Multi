# Recipe: Advanced Tokenism Analysis

Parameter sweeps, sensitivity analysis, and multi-scenario comparisons.

## Prerequisites

- Basic recipe completed
- Understanding of simulation parameters
- Flask backend running

## Parameter Sweep

Test multiple scenarios systematically:

```bash
#!/bin/bash
# sweep-internal-spending.sh

for pct in 0.3 0.4 0.5 0.6 0.7 0.8; do
  echo "Running with PERCENT_SPEND_INTERNAL_AVG=$pct"

  echo "{
    \"NUM_MEMBERS\": 100,
    \"SIMULATION_WEEKS\": 156,
    \"PERCENT_SPEND_INTERNAL_AVG\": $pct
  }" | npx ts-node tools/run-simulation.ts > "results_internal_$pct.json"

  # Extract key metrics
  npx ts-node tools/export-metrics.ts \
    --input "results_internal_$pct.json" \
    --format csv >> sweep_results.csv
done
```

## Sensitivity Analysis

Compare baseline vs modified parameters:

```bash
# Baseline
npx ts-node tools/run-simulation.ts \
  --members 100 --weeks 156 > baseline.json

# High GroToken rewards
echo '{
  "NUM_MEMBERS": 100,
  "SIMULATION_WEEKS": 156,
  "GROTOKEN_REWARD_PER_WEEK_AVG": 2.0,
  "GROTOKEN_USD_VALUE": 3.0
}' | npx ts-node tools/run-simulation.ts > high_grotoken.json

# Compare final Gini
echo "Baseline Gini: $(jq '.summary.final_gini' baseline.json)"
echo "High GroToken Gini: $(jq '.summary.final_gini' high_grotoken.json)"
```

## Long-term Projections

10-year simulation with quarterly checkpoints:

```bash
npx ts-node tools/run-simulation.ts \
  --members 200 \
  --weeks 520 \
  --output json > long_term.json

# Extract quarterly snapshots (every 13 weeks)
jq '[.weekly_data[] | select(.week % 13 == 0)]' long_term.json > quarterly.json
```

## Monte Carlo Simulation

Run multiple iterations with varied initial conditions:

```bash
#!/bin/bash
# monte-carlo.sh

for i in {1..100}; do
  # Randomize initial wealth distribution
  sigma=$(echo "scale=2; 0.4 + $RANDOM/32767 * 0.4" | bc)

  echo "{
    \"NUM_MEMBERS\": 100,
    \"SIMULATION_WEEKS\": 156,
    \"INITIAL_WEALTH_SIGMA_LOG\": $sigma
  }" | npx ts-node tools/run-simulation.ts > "mc_$i.json"

  # Append summary to results
  echo "$i,$sigma,$(jq -r '.summary.final_gini' mc_$i.json)" >> monte_carlo.csv
done

echo "Monte Carlo complete. Results in monte_carlo.csv"
```

## Comparing Cooperative Strategies

Test different group buying savings:

```typescript
// strategy-comparison.ts
import { runSimulation } from './tools/run-simulation';

const strategies = [
  { name: 'Low Savings', GROUP_BUY_SAVINGS_PERCENT: 0.05, LOCAL_PRODUCTION_SAVINGS_PERCENT: 0.10 },
  { name: 'Medium Savings', GROUP_BUY_SAVINGS_PERCENT: 0.15, LOCAL_PRODUCTION_SAVINGS_PERCENT: 0.25 },
  { name: 'High Savings', GROUP_BUY_SAVINGS_PERCENT: 0.25, LOCAL_PRODUCTION_SAVINGS_PERCENT: 0.35 },
];

async function compare() {
  for (const strategy of strategies) {
    const result = await runSimulation({
      NUM_MEMBERS: 100,
      SIMULATION_WEEKS: 156,
      ...strategy,
    });

    console.log(`${strategy.name}: Gini=${result.summary.final_gini.toFixed(4)}, Poverty=${(result.summary.final_poverty_rate * 100).toFixed(2)}%`);
  }
}

compare();
```

## Visualization Pipeline

Export for visualization tools:

```bash
# For Datavzrd
npx ts-node tools/export-metrics.ts \
  --input results.json \
  --format csv \
  --output artifacts/simulation_data.csv

# Generate Datavzrd config
cat > artifacts/datavzrd.yaml << EOF
name: Tokenism Simulation Analysis
datasets:
  simulation:
    path: simulation_data.csv
    columns:
      week: { display_mode: normal }
      gini: { display_mode: bar, precision: 4 }
      poverty_rate: { display_mode: percentage }
EOF

# Run Datavzrd
datavzrd artifacts/datavzrd.yaml --output artifacts/report
```

## Tips

1. **Start small**: Begin with 52 weeks before running 520-week simulations
2. **Validate first**: Always run `validate-params.ts` before long simulations
3. **Watch memory**: Use CSV export for very long simulations
4. **Parallel runs**: Use GNU Parallel for large parameter sweeps
5. **Version results**: Include parameter hash in output filenames
