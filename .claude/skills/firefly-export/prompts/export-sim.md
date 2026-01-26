# Recipe: Export Simulation to Firefly-iii

## Prerequisites
- Firefly-iii instance running
- API token configured
- Simulation data available

## Workflow

### 1. Configure Firefly Connection
Set environment variables:
```bash
export FIREFLY_URL="http://localhost:8080"
export FIREFLY_TOKEN="your-api-token"
```

### 2. Prepare Simulation Data
Ensure simulation has been run and results are available:
```bash
# Check simulation output
ls -la output/simulation_results.json
```

### 3. Run Export
```bash
cd integrations/firefly
npx ts-node export_sim_to_firefly.ts
```

### 4. Verify in Firefly
- Check accounts were created
- Verify transaction imports
- Review balance accuracy

### 5. Handle Errors
Common issues:
- **401 Unauthorized**: Check API token
- **Account exists**: Use `--force` flag to update
- **Rate limited**: Add delay between requests

## Export Options
```bash
# Dry run (no actual API calls)
npx ts-node export_sim_to_firefly.ts --dry-run

# Specific date range
npx ts-node export_sim_to_firefly.ts --start 2024-01-01 --end 2024-12-31

# Force update existing accounts
npx ts-node export_sim_to_firefly.ts --force
```

## Constraints
- DO NOT log API tokens
- Handle rate limiting gracefully
- Validate data before bulk import
