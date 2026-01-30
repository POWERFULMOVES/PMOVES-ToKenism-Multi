# Recipe: Basic Tokenism Simulation

Run your first economic simulation with default parameters.

## Prerequisites

- Flask backend running on port 5000
- Node.js with ts-node available

## Steps

### 1. Start the Backend

```bash
cd pmoves_backend
python flask_backend.py
```

### 2. Validate Your Parameters

```bash
npx ts-node .claude/skills/tokenism-analysis/tools/validate-params.ts \
  --members 50 \
  --weeks 52
```

Expected output:
```
[tokenism] Validation result: VALID

Warnings:
  - Short simulation (<1 year) may not show long-term trends
```

### 3. Run the Simulation

```bash
npx ts-node .claude/skills/tokenism-analysis/tools/run-simulation.ts \
  --members 50 \
  --weeks 52 \
  --output json > results.json
```

### 4. Review Results

```bash
# Quick summary
npx ts-node .claude/skills/tokenism-analysis/tools/export-metrics.ts \
  --input results.json \
  --format md
```

Output:
```markdown
# Tokenism Simulation Results

## Summary Metrics

| Metric | Value |
|--------|-------|
| Simulation Duration | 52 weeks |
| Final Gini Coefficient | 0.3421 |
| Final Poverty Rate | 12.50% |
...
```

### 5. Export for Analysis

```bash
# To CSV for spreadsheet analysis
npx ts-node .claude/skills/tokenism-analysis/tools/export-metrics.ts \
  --input results.json \
  --format csv \
  --output results.csv
```

## Key Metrics to Watch

| Metric | Healthy Range | Meaning |
|--------|---------------|---------|
| Gini Coefficient | 0.25-0.40 | Wealth inequality (lower = more equal) |
| Poverty Rate | < 15% | Members below poverty threshold |
| Internal Spending | > 50% | Cooperative economy circulation |

## Next Steps

- Try [Advanced Analysis](recipe-advanced.md) for parameter sweeps
- Adjust `PERCENT_SPEND_INTERNAL_AVG` to see impact on equality
- Increase `GROTOKEN_REWARD_PER_WEEK_AVG` to model incentive effects
