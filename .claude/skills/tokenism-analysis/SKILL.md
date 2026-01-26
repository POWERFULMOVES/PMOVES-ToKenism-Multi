# Skill: Tokenism Analysis

**Version**: 1.0.0
**Description**: Token economics analysis and simulation for PMOVES ecosystem

## When to Use
- Running economic simulations
- Analyzing token distribution patterns
- Generating metrics reports
- Validating economic models

## Capabilities
- Flask backend simulation API
- Economic metrics calculation
- Sensitivity analysis
- Cohort-based projections

## Context Priming
Before running simulations:
1. Verify Flask backend is running
2. Check simulation parameters in frontend
3. Review `EconomicMetrics` class for available metrics

## Key Files
- `flask_backend.py` - Simulation API endpoints
- `pmoves-nextjs/src/components/EnhancedSimulationForm.tsx` - UI
- `pmoves-nextjs/app/api/` - Next.js API routes

## Constraints
- Simulations can be CPU-intensive; consider batch sizes
- Validate input ranges before running
- Use sensitivity analysis for edge cases

## Recipes
See `prompts/simulate.md` for simulation workflow.
