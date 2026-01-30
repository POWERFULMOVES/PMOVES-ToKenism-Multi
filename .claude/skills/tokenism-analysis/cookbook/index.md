# Tokenism Analysis Cookbook

Progressive disclosure guide for the tokenism-analysis skill.

## Quick Start

Run a basic simulation:
```bash
npx ts-node .claude/skills/tokenism-analysis/tools/run-simulation.ts --members 50 --weeks 52
```

## Recipes

| Recipe | Use Case | Complexity |
|--------|----------|------------|
| [Basic Simulation](recipe-basic.md) | First-time users, quick results | Beginner |
| [Advanced Analysis](recipe-advanced.md) | Parameter sweeps, sensitivity analysis | Advanced |

## Tools Reference

| Tool | Purpose |
|------|---------|
| `run-simulation.ts` | Execute economic simulations via Flask API |
| `validate-params.ts` | Validate parameters before running |
| `export-metrics.ts` | Export results to CSV/JSON/Markdown |

## Common Tasks

### Run with validation
```bash
# Validate first
npx ts-node tools/validate-params.ts --members 100 --weeks 156

# Then run
npx ts-node tools/run-simulation.ts --members 100 --weeks 156 --output json
```

### Export to different formats
```bash
# To CSV
npx ts-node tools/export-metrics.ts --input results.json --format csv --output results.csv

# To Markdown summary
npx ts-node tools/export-metrics.ts --input results.json --format md --output RESULTS.md
```

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
