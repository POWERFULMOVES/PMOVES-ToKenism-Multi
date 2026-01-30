# Firefly Export Cookbook

Progressive disclosure guide for the firefly-export skill.

## Quick Start

Check Firefly-III connectivity:
```bash
npx ts-node .claude/skills/firefly-export/tools/api-health-check.ts
```

## Recipes

| Recipe | Use Case | Complexity |
|--------|----------|------------|
| [Basic Export](recipe-basic.md) | Export simulation to Firefly | Beginner |
| [Advanced Workflows](recipe-advanced.md) | Automated imports, reconciliation | Advanced |

## Tools Reference

| Tool | Purpose |
|------|---------|
| `firefly-cli.ts` | Export simulation data to Firefly-III API |
| `csv-generator.ts` | Generate Firefly-compatible CSV files |
| `api-health-check.ts` | Verify Firefly connectivity and auth |

## Configuration

Set environment variables or create `.env.firefly`:

```bash
# integrations/.env.firefly
FIREFLY_BASE_URL=http://localhost:8080
FIREFLY_TOKEN=your_personal_access_token
FIREFLY_ACCOUNT_ID=1
FIREFLY_BUDGET_ID=1
```

## Common Tasks

### Generate CSV for manual import
```bash
npx ts-node tools/csv-generator.ts \
  --input simulation_results.json \
  --format firefly \
  --output firefly-import.csv
```

### Dry-run export (preview transactions)
```bash
npx ts-node tools/firefly-cli.ts \
  --input simulation_results.json \
  --dry-run
```

### Live export to Firefly
```bash
npx ts-node tools/firefly-cli.ts \
  --input simulation_results.json \
  --confirm
```

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
