# Recipe: Token Economics Simulation

## Prerequisites
- Flask backend running
- Frontend accessible at localhost:3000

## Workflow

### 1. Start Backend
```bash
# Start Flask simulation server
python flask_backend.py
```

### 2. Configure Simulation Parameters
Key parameters in `EnhancedSimulationForm`:
- `num_members`: Cohort size (default: 100)
- `weeks`: Simulation duration (default: 52)
- `initial_balance`: Starting token balance
- `income_mean/std`: Income distribution
- `expense_ratio`: Expense as fraction of income

### 3. Run Simulation
Via API:
```bash
curl -X POST http://localhost:5000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"num_members": 100, "weeks": 52}'
```

Via Frontend:
- Navigate to http://localhost:3000
- Fill simulation form
- Click "Run Simulation"

### 4. Analyze Results
- Review metrics dashboard
- Check cohort distributions
- Run sensitivity analysis for edge cases

### 5. Export Results
```bash
# Export to Firefly (optional)
cd integrations/firefly
npx ts-node export_sim_to_firefly.ts
```

## Constraints
- Large simulations (>1000 members) may be slow
- Validate input ranges before running
- Use batch mode for multiple scenarios
