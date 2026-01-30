# Tokenism Analysis Troubleshooting

## Common Errors

### Connection refused to localhost:5000

**Symptom:** `Simulation failed: ECONNREFUSED`

**Cause:** Flask backend not running

**Solution:**
```bash
cd pmoves_backend && python flask_backend.py
```

Or with Docker:
```bash
docker-compose -f docker-compose.pmoves.yml up flask-backend -d
```

### NUM_MEMBERS validation error

**Symptom:** `NUM_MEMBERS (X) is below minimum (5)`

**Cause:** Too few members for meaningful simulation

**Solution:** Use at least 5 members. Recommended: 50-500 for stable results.

### SIMULATION_WEEKS exceeds maximum

**Symptom:** `SIMULATION_WEEKS (X) exceeds maximum (520)`

**Cause:** 520 weeks = 10 years is the maximum supported

**Solution:** Use weekly data aggregation or run multiple shorter simulations.

### Food budget exceeds income warning

**Symptom:** `Food budget exceeds income - members will accumulate debt`

**Cause:** `WEEKLY_FOOD_BUDGET_AVG > WEEKLY_INCOME_AVG`

**Solution:** Adjust parameters to realistic values:
```json
{
  "WEEKLY_INCOME_AVG": 120,
  "WEEKLY_FOOD_BUDGET_AVG": 80
}
```

### Empty weekly_data in results

**Symptom:** Results JSON has empty `weekly_data` array

**Cause:** Simulation may have failed silently

**Solution:**
1. Check Flask backend logs
2. Validate parameters first: `npx ts-node validate-params.ts ...`
3. Ensure all required parameters are provided

## Performance Issues

### Simulation runs slowly

**For large member counts (>1000):**
- Consider reducing weeks
- Run in batches
- Use CLI output mode instead of JSON for streaming

### Memory issues with export

**For very long simulations:**
- Export to CSV instead of JSON (smaller memory footprint)
- Use the `--format csv` flag

## Debug Mode

Enable verbose logging:
```bash
DEBUG=tokenism:* npx ts-node tools/run-simulation.ts --members 50 --weeks 52
```

## Getting Help

1. Check the [recipe-basic.md](recipe-basic.md) for working examples
2. Review [recipe-advanced.md](recipe-advanced.md) for complex scenarios
3. Open an issue in the repository
