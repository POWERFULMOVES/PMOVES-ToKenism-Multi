> **ARCHIVED**: This planning document is superseded by [PHASE4_IMPLEMENTATION.md](PHASE4_IMPLEMENTATION.md).
> Phase 4 implementation modules are complete. See the implementation guide for current documentation. This archived plan does not imply scheduled production ingestion, live settlement, or optimizer execution is complete.

# Phase 4: Firefly-iii Data Integration (Planning Document)

**Goal:** Validate and calibrate PMOVES business projections using real financial data from Firefly-iii

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 4 Integration Layer                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─────> Firefly-iii API Client
                              │       ├── Get spending by category
                              │       ├── Get transactions
                              │       └── Export historical data
                              │
                              ├─────> Data Transformation Layer
                              │       ├── Map Firefly categories → FoodUSD categories
                              │       ├── Aggregate spending by time period
                              │       └── Calculate participation metrics
                              │
                              ├─────> Projection Calibration System
                              │       ├── Compare actual vs simulated spending
                              │       ├── Calibrate FoodUSD parameters
                              │       ├── Validate GroupPurchase savings assumptions
                              │       └── Adjust business model projections
                              │
                              └─────> Validation & Reporting
                                      ├── Generate calibration reports
                                      ├── Export comparison CSVs
                                      └── Update projection models
```

## Components

### 1. Data Transformation Layer
**File:** `integrations/firefly/data-transformer.ts`
- Maps Firefly-iii categories to FoodUSD categories
- Aggregates weekly/monthly spending data
- Calculates user participation metrics
- Normalizes transaction data for simulation input

### 2. Calibration Engine
**File:** `integrations/projections/calibration-engine.ts`
- Compares real vs simulated spending patterns
- Calibrates FoodUSD mint/burn rates
- Validates GroupPurchase 15% savings assumption
- Adjusts projection model parameters
- Generates calibration confidence scores

### 3. Integration Coordinator
**File:** `integrations/firefly/firefly-integration.ts`
- Orchestrates data fetch from Firefly-iii
- Transforms data for simulation
- Runs calibrated simulations
- Generates comparison reports

### 4. Validation Reports
**File:** `integrations/projections/calibration-reports.ts`
- Actual vs Simulated comparison tables
- Parameter adjustment recommendations
- Confidence intervals for projections
- Category-level variance analysis

## Implementation Plan

### Step 1: Data Transformation Layer ✅
- [ ] Create category mapping configuration
- [ ] Implement transaction aggregation
- [ ] Calculate participation metrics
- [ ] Extract weekly spending patterns

### Step 2: Calibration Engine ✅
- [ ] Build comparison algorithms
- [ ] Implement parameter optimization
- [ ] Validate savings assumptions
- [ ] Generate calibration scores

### Step 3: Integration Coordinator ✅
- [ ] Fetch Firefly data
- [ ] Transform for simulation
- [ ] Run calibrated simulations
- [ ] Generate reports

### Step 4: Testing & Validation ✅
- [ ] Test with sample Firefly data
- [ ] Validate calibration accuracy
- [ ] Compare before/after projections
- [ ] Document results

## Data Flow

```
1. Fetch Real Data
   Firefly-iii API → Historical transactions (3-12 months)

2. Transform Data
   Transactions → Weekly food spending by category
                → Participation rates
                → Spending patterns

3. Calibrate Models
   Real Data + Simulated Data → Parameter adjustments
                              → Confidence scores
                              → Updated projections

4. Validate & Report
   Calibrated Models → Comparison reports
                    → Updated business projections
                    → Confidence intervals
```

## Category Mapping

### Firefly-iii Categories → FoodUSD Categories

| Firefly Category | FoodUSD Category | Notes |
|------------------|------------------|-------|
| Groceries | groceries | Direct mapping |
| Restaurants | dining | Direct mapping |
| Fast Food | prepared_food | Map to prepared |
| Takeaway | food_delivery | Direct mapping |
| Farmers Market | farmers_market | Direct mapping |
| Food & Drinks | groceries | Default to groceries |
| Supermarket | groceries | Map to groceries |
| Coffee Shop | prepared_food | Map to prepared |

## Calibration Parameters

### FoodUSD Model
- Weekly budget per participant ($150 baseline)
- Category distribution percentages
- Mint/burn rates
- Participation rate (75% baseline)

### GroupPurchase Model
- 15% savings rate validation
- Minimum participant thresholds
- Order frequency patterns
- Category preferences

### Business Projections
- Revenue multipliers
- ROI adjustments
- Break-even timeline corrections
- Growth rate calibrations

## Expected Outcomes

### 1. Validated Assumptions
- Confirm or adjust 15% group purchase savings
- Validate $150/week food spending baseline
- Confirm 75% participation rate
- Verify category distribution (60% groceries, 25% prepared, 15% farmers market)

### 2. Calibrated Projections
- Adjusted revenue forecasts based on real spending
- Updated ROI calculations with real participation
- Corrected break-even timelines
- Refined market scenario multipliers

### 3. Confidence Scores
- HIGH: Real data matches simulation within 10%
- MEDIUM: Real data within 25% of simulation
- LOW: Real data differs >25% from simulation

### 4. Reports Generated
- `CALIBRATION_REPORT.md` - Detailed calibration analysis
- `firefly-vs-simulation-comparison.csv` - Category-level comparison
- `calibrated-projections.csv` - Updated business projections
- `confidence-intervals.json` - Statistical confidence data

## Integration with Existing System

### Extends Phase 3
- Uses existing `ProjectionValidator` for simulations
- Leverages `ContractCoordinator` for contract integration
- Builds on `FoodUSDModel` and `GroupPurchaseModel`
- Integrates with CSV export functions

### New Dependencies
- Firefly-iii API (already implemented)
- Statistical analysis functions (new)
- Parameter optimization algorithms (new)
- Confidence interval calculations (new)

## Testing Strategy

### 1. Unit Tests
- Category mapping accuracy
- Transaction aggregation correctness
- Parameter calibration algorithms
- Confidence score calculations

### 2. Integration Tests
- End-to-end Firefly data fetch
- Full calibration pipeline
- Report generation
- Updated simulation runs

### 3. Validation Tests
- Compare calibrated vs baseline projections
- Verify parameter adjustments are sensible
- Validate confidence scores match reality
- Ensure backward compatibility

## Success Criteria

✅ Successfully fetch 3+ months of Firefly-iii data
✅ Map 95%+ of food transactions to FoodUSD categories
✅ Generate calibration with confidence scores
✅ Update projection models with calibrated parameters
✅ Produce comprehensive calibration report
✅ Validate calibrated models show improved accuracy

## Timeline Estimate

- **Step 1 (Transformer):** 2-3 hours
- **Step 2 (Calibration):** 3-4 hours
- **Step 3 (Integration):** 2-3 hours
- **Step 4 (Testing):** 2-3 hours
- **Total:** 9-13 hours

## Next Steps

1. Create data transformer with category mappings
2. Build calibration engine with parameter optimization
3. Implement integration coordinator
4. Test with real Firefly data
5. Generate calibration reports
6. Update Phase 3 projections with calibrated parameters
7. Document findings and recommendations

---

**Phase 4 Status:** Ready to implement
**Dependencies:** Phase 3 complete ✅, Firefly-iii client available ✅
**Expected Completion:** Phase 4 deliverables ready within 10-15 hours
