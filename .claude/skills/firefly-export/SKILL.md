# Skill: Firefly Export

**Version**: 1.0.0
**Description**: Export PMOVES simulations to Firefly-iii personal finance manager

## When to Use
- Exporting simulation results to Firefly-iii
- Creating Firefly accounts from simulation data
- Transferring transaction history
- Validating export data integrity

## Capabilities
- CSV export generation
- Firefly API client operations
- Account creation and mapping
- Transaction batch import

## Context Priming
Before exporting:
1. Verify Firefly-iii instance is accessible
2. Check API credentials in environment
3. Review simulation data format

## Key Files
- `integrations/firefly/export_sim_to_firefly.ts` - Main export script
- `integrations/firefly/firefly-client.ts` - API client
- `integrations/package.json` - Dependencies

## API Endpoints
- Account creation: `POST /api/v1/accounts`
- Transaction import: `POST /api/v1/transactions`

## Constraints
- DO NOT expose Firefly API tokens in logs
- Validate account types before creation
- Handle rate limiting for bulk operations

## Recipes
See `prompts/export-sim.md` for export workflow.
