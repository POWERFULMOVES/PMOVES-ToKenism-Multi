# PMOVES User Guide

Complete guide to using the PMOVES Token Economy Simulator for business projection validation and real-world calibration.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Running Simulations](#running-simulations)
5. [Understanding Results](#understanding-results)
6. [Firefly-iii Integration](#firefly-iii-integration)
7. [Customization](#customization)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

### What is PMOVES?

PMOVES (Powerful Moves Token Economy Simulator) validates business projections for cooperative food purchasing systems with blockchain-based token incentives. It runs 5-year simulations (260 weeks) to compare projected vs actual performance.

### Who Should Use This?

- **Business Analysts** - Validate cooperative food system projections
- **Project Managers** - Test different population sizes and market scenarios
- **Financial Planners** - Assess ROI and break-even timelines
- **Researchers** - Study token economy impacts on community spending

### Key Capabilities

- Simulate 5 smart contract models (GroToken, FoodUSD, GroupPurchase, GroVault, CoopGovernor)
- Validate 3 business models + 2 market variants
- Calibrate with real Firefly-iii spending data
- Generate comprehensive reports (Markdown + CSV)
- High/Medium/Low confidence scoring

---

## Installation

### Prerequisites

Before installing PMOVES, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **TypeScript 5.0+** (installed via npm)
- **Firefly-iii** (optional, for real data calibration)

### Verify Prerequisites

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version
```

### Install PMOVES

```bash
# Clone the repository
git clone https://github.com/POWERFULMOVES/PMOVEStokensim.git
cd PMOVEStokensim/integrations

# Install dependencies
npm install

# Verify installation
npm test
```

Expected output: All tests passing with 90%+ coverage.

### Set Up Firefly-iii (Optional)

If you want to calibrate with real spending data:

1. **Install Firefly-iii** - Follow [official docs](https://docs.firefly-iii.org/)
2. **Get API Token**:
   - Log in to Firefly-iii
   - Go to **Options > Profile > OAuth**
   - Create **Personal Access Token**
   - Copy token for later use

```bash
# Set environment variable
export FIREFLY_API_TOKEN="your-token-here"
export FIREFLY_URL="http://localhost:8080"  # Optional
```

---

## Getting Started

### Quick Validation (5 minutes)

Run a quick validation to ensure everything works:

```bash
cd integrations

# Validate one model (AI-Enhanced Local Service)
npm run validate:quick
```

Expected output:

```
================================================================================
VALIDATION REPORT: AI-Enhanced Local Service Business
================================================================================

📊 PROJECTIONS vs ACTUAL
Revenue:
  Projected: $94,277
  Actual:    $385,988
  Variance:  +309.4%

ROI:
  Projected: 1366%
  Actual:    7594%
  Variance:  +455.9%

✅ Validation complete!
```

### Full Validation (5-6 minutes)

Run all 5 models for comprehensive comparison:

```bash
# Validate all models
npm run validate:all

# View results
cat ../TEST_RESULTS_PHASE3.md
```

### Project Structure

```
PMOVEStokensim/
├── integrations/           # Main source code
│   ├── event-bus/         # Phase 1: Pub/sub messaging
│   ├── contracts/         # Phase 2: Token economy models
│   ├── projections/       # Phase 3: Validation framework
│   ├── firefly/           # Phase 4: Real data integration
│   └── package.json       # Dependencies & scripts
├── output/                # Generated reports (created on first run)
├── TEST_RESULTS_PHASE3.md # Latest validation results
└── README.md              # Project overview
```

---

## Running Simulations

### Validation Commands

PMOVES provides npm scripts for common validation tasks:

#### Quick Validation (1 model)

```bash
npm run validate:quick
```

- Validates **AI-Enhanced Local Service** model
- Duration: ~60 seconds
- Output: Console summary

#### Full Validation (5 models)

```bash
npm run validate:all
```

- Validates all 5 models sequentially
- Duration: ~5-6 minutes
- Output: `TEST_RESULTS_PHASE3.md` + CSV files

#### Compare Models

```bash
npm run validate:compare
```

- Runs all models and ranks by score
- Duration: ~5-6 minutes
- Output: Comparison table + rankings

### Programmatic Usage

For custom simulations, use the TypeScript API:

```typescript
import { ProjectionValidator } from "./projections";
import { AI_ENHANCED_LOCAL_SERVICE } from "./projections/scenario-configs";

// Create validator
const validator = new ProjectionValidator();

// Run validation
const report = await validator.validate(AI_ENHANCED_LOCAL_SERVICE);

// Access results
console.log(`Revenue Variance: ${report.variance.revenueVariance.toFixed(1)}%`);
console.log(`ROI: ${report.actual.roi}%`);
console.log(`Break-Even: ${report.actual.breakEvenMonths} months`);
```

### Custom Model Configuration

Create your own projection model:

```typescript
import { ProjectionModel } from "./projections";

const MY_CUSTOM_MODEL: ProjectionModel = {
  name: "My Custom Food Co-op",
  description: "Custom cooperative model",

  // Financial projections
  initialInvestment: 5000,
  projectedYear5Revenue: 100000,
  projectedRiskAdjustedROI: 15.0, // 1500%
  projectedBreakEvenMonths: 4.0,
  successProbability: 0.7,

  // Simulation parameters
  populationSize: 600,
  participationRate: 0.65,

  // Revenue modeling
  weeklyRevenuePerParticipant: 0.6,
  growthRatePerWeek: 0.0115,

  // Token economy
  tokenDistributionRate: 0.55,
  groupBuyingSavings: 0.15,
  stakingParticipation: 0.35,
};

// Validate
const report = await validator.validate(MY_CUSTOM_MODEL);
```

### Batch Simulations

Run multiple scenarios in parallel:

```typescript
import {
  AI_ENHANCED_LOCAL_SERVICE,
  ENERGY_CONSULTING,
  TOKEN_PRE_ORDER,
} from "./projections/scenario-configs";

const validator = new ProjectionValidator();

// Sequential execution (prevents race conditions)
const reports: ValidationReport[] = [];
for (const model of [
  AI_ENHANCED_LOCAL_SERVICE,
  ENERGY_CONSULTING,
  TOKEN_PRE_ORDER,
]) {
  reports.push(await validator.validate(model));
}

// Compare results
reports.forEach((report) => {
  console.log(`${report.model}: ${report.actual.roi}% ROI`);
});
```

---

## Understanding Results

### Validation Report Structure

Each validation generates a comprehensive report:

```
================================================================================
VALIDATION REPORT: AI-Enhanced Local Service Business
================================================================================

📊 PROJECTIONS vs ACTUAL
Revenue:
  Projected: $94,277      # Year 5 projection from business plan
  Actual:    $385,988     # Simulated Year 5 revenue
  Variance:  +309.4%      # Percentage difference

Profit:
  Projected: $68,277
  Actual:    $364,488
  Variance:  +433.7%

ROI:
  Projected: 1366%        # Risk-adjusted ROI from projections
  Actual:    7594%        # Simulated ROI after 5 years
  Variance:  +455.9%      # How much better/worse than projected

Break-Even:
  Projected: 3.3 months
  Actual:    5.3 months   # Simulated break-even point
  Variance:  +61.0%       # Delay vs projection

⚠️ RISK ASSESSMENT
Success Achieved: ❌ NO
  Reason: Break-even delayed by 61.0%

Risk Level: HIGH
  Projected Success Probability: 75%
  Actual Performance: Break-even took 2 months longer

Confidence Level: LOW
  Variance Magnitude: 309.4%
  Volatility: High variance suggests uncertain projections

📈 ANALYSIS
Revenue Growth:    LINEAR     # Growth pattern
Profitability:     IMPROVING  # Profit trend
Market Scenario:   BULL       # Market conditions
Token Impact:      POSITIVE   # Token economy effect

💡 INSIGHTS
- Revenue exceeded projections by 3.1x
- ROI dramatically higher than projected (7594% vs 1366%)
- Break-even delayed, suggesting slower initial adoption
- Token economy providing significant value (+$280K from projections)
```

### Key Metrics Explained

#### 1. Revenue Variance

**Formula:**

```
Revenue Variance = ((Actual Revenue - Projected Revenue) / Projected Revenue) * 100
```

**Interpretation:**

- **Positive variance** - Simulation exceeded projections (good)
- **Negative variance** - Simulation underperformed (concerning)
- **±10%** - High confidence, projection accurate
- **±25%** - Medium confidence, projection reasonable
- **>25%** - Low confidence, projection needs review

#### 2. ROI (Return on Investment)

**Formula:**

```
ROI = ((Year 5 Profit - Initial Investment) / Initial Investment) * 100
```

**Example:**

```
Initial Investment: $5,000
Year 5 Profit: $364,488
ROI = (($364,488 - $5,000) / $5,000) * 100 = 7,190%
```

**Interpretation:**

- **>1000%** - Excellent return (highly successful)
- **500-1000%** - Good return (successful)
- **100-500%** - Moderate return (viable)
- **<100%** - Poor return (risky)

#### 3. Break-Even Analysis

**Definition:** Week when cumulative profit becomes positive

**Example Timeline:**

```
Week 1-10:   -$5,000 (initial investment)
Week 11-15:  -$2,500 (recovering)
Week 16-20:  -$500   (nearly break-even)
Week 21-23:  +$200   ✅ BREAK-EVEN ACHIEVED (5.3 months)
```

**Interpretation:**

- **<3 months** - Fast break-even (low risk)
- **3-6 months** - Moderate break-even (medium risk)
- **>6 months** - Slow break-even (high risk)
- **Not achieved** - Failed to break even in 5 years (very high risk)

#### 4. Success Assessment

**Criteria:**

1. ROI ≥ 80% of projected ROI
2. Revenue ≥ 80% of projected revenue
3. Break-even ≤ 125% of projected timeline

**Example:**

```
Projected ROI: 1366%
Actual ROI: 7594%
Check: 7594% ≥ (1366% * 0.8) = 1093% ✅ PASS

Projected Break-Even: 3.3 months
Actual Break-Even: 5.3 months
Check: 5.3 ≤ (3.3 * 1.25) = 4.1 months ❌ FAIL

Overall: ❌ FAIL (break-even criterion not met)
```

### CSV Output Files

Validations generate CSV files for analysis in Excel/Google Sheets:

#### model-comparison.csv

```csv
Model,Projected Revenue,Actual Revenue,Revenue Variance %,Projected ROI,Actual ROI,ROI Variance %,Break-Even Months,Score
AI-Enhanced Local Service,94277,385988,309.4,1366,7594,455.9,5.3,92.5
Sustainable Energy AI,63020,289456,359.4,818,6989,754.3,6.1,88.7
...
```

**Use cases:**

- Sort by score to rank models
- Filter by variance to find outliers
- Create charts comparing projected vs actual

#### weekly-progression.csv

```csv
Week,Cumulative Revenue,Cumulative Profit,ROI %,Token Value,Group Savings
1,200,-4800,-96.0,50,0
2,425,-4575,-91.5,105,12
...
260,385988,364488,7290,28500,42750
```

**Use cases:**

- Plot revenue growth over time
- Identify inflection points
- Track token value accumulation

---

## Firefly-iii Integration

### Overview

Phase 4 calibrates projections using **real spending data** from Firefly-iii, your personal finance manager.

**Benefits:**

- Adjust parameters based on actual behavior
- Validate assumptions with real data
- Get confidence scores (HIGH/MEDIUM/LOW)
- Improve projection accuracy

### Setup

#### 1. Install Firefly-iii

Follow [official installation guide](https://docs.firefly-iii.org/):

```bash
# Using Docker (recommended)
docker run -d \
  -p 8080:8080 \
  -e APP_KEY=your-random-key \
  fireflyiii/core:latest
```

#### 2. Add Spending Data

1. Log in to Firefly-iii (http://localhost:8080)
2. Add **Accounts** (Checking, Savings, etc.)
3. Import or manually add **Transactions**
4. Categorize transactions:
   - Groceries
   - Restaurants
   - Fast Food
   - Farmers Market
   - etc.

**Minimum data:** 4 weeks (12 weeks recommended)

#### 3. Get API Token

1. Go to **Options > Profile > OAuth**
2. Click **Create New Token**
3. Name: "PMOVES Integration"
4. Click **Create**
5. Copy token

#### 4. Set Environment Variable

```bash
export FIREFLY_API_TOKEN="your-token-here"
export FIREFLY_URL="http://localhost:8080"  # Optional (defaults to localhost:8080)
```

### Running Calibration

#### Quick Calibration (Last 90 Days)

```bash
cd integrations

# Run integration (analyzes last 3 months)
npx ts-node --project tsconfig.run.json firefly/run-integration.ts
```

Expected output:

```
Using model: AI-Enhanced Local Service Business
Firefly URL: http://localhost:8080
Analysis period: 2024-08-16 to 2024-11-15

Fetching transactions from Firefly-iii...
✅ Fetched 234 transactions

Transforming data...
✅ Mapped 189 food-related transactions

Running baseline simulation...
✅ Baseline simulation complete (260 weeks)

Calibrating parameters...
✅ Calibration complete

Running calibrated simulation...
✅ Calibrated simulation complete

Generating reports...
✅ Reports saved to: ./output/firefly-calibration

📊 CALIBRATION SUMMARY
================================================================================

Overall Accuracy:
  Confidence Level: HIGH
  Confidence Score: 87.3/100
  Average Variance: 6.4%

Top Parameter Adjustments:
  weeklyFoodBudget: 150 → 162.45 (+8.3%)
  participationRate: 0.75 → 0.68 (-9.3%)
  categoryDistribution.groceries: 0.6 → 0.642 (+7.0%)

Category Performance:
  groceries: +4.2% variance
  prepared_food: -8.1% variance
  dining: -2.3% variance

Recommendations:
  1. Increase weekly budget to $162 per participant
  2. Adjust participation assumption to 68% for conservative forecasts
  3. Groceries spending 4% higher than projected
```

#### Custom Time Period

```typescript
import { FireflyIntegration } from "./firefly";
import { AI_ENHANCED_LOCAL_SERVICE } from "./projections/scenario-configs";

const integration = new FireflyIntegration({
  firefly: {
    baseUrl: "http://localhost:8080",
    apiToken: process.env.FIREFLY_API_TOKEN || "",
  },
  analysis: {
    // Analyze specific period
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-06-30"),
    totalPopulation: 500,
  },
  output: {
    directory: "./output/custom-calibration",
    generateCSV: true,
    generateMarkdown: true,
  },
});

const result = await integration.run(AI_ENHANCED_LOCAL_SERVICE);

console.log(
  `Confidence: ${result.calibrated.calibration.overallAccuracy.confidenceLevel}`
);
```

### Exporting Simulation Data to Firefly-iii

You can populate your Firefly-iii instance with synthetic transaction data generated by the PMOVES simulation. This is useful for:

- Visualizing simulation results in a familiar personal finance dashboard.
- Testing the integration without needing real bank data.
- Validating the economic model against "representative" user profiles.

To run the export:

```bash
npm run firefly:export-sim
```

This script will:

1.  Run a 1-year baseline simulation.
2.  Create representative Firefly accounts (e.g., "Sim Agent: Average Member").
3.  Generate and upload weekly transactions (Income, Groceries, etc.) for these accounts.

Once complete, log in to Firefly-iii (`http://localhost:8080`) to explore the generated data.

### Understanding Calibration Reports

#### CALIBRATION_REPORT.md

Main report with parameter adjustments:

```markdown
# PMOVES Firefly-iii Calibration Report

**Model:** AI-Enhanced Local Service Business
**Analysis Period:** 2024-08-16 to 2024-11-15 (90 days)
**Data Points:** 189 food transactions across 12 weeks
**Generated:** 2024-11-15

## Overall Accuracy

| Metric               | Value                |
| -------------------- | -------------------- |
| **Confidence Level** | HIGH                 |
| **Confidence Score** | 87.3/100             |
| **Average Variance** | 6.4%                 |
| **Data Quality**     | Excellent (12 weeks) |

## Parameter Adjustments

| Parameter            | Baseline | Calibrated | Adjustment      | Confidence |
| -------------------- | -------- | ---------- | --------------- | ---------- |
| weeklyFoodBudget     | $150.00  | $162.45    | +$12.45 (+8.3%) | HIGH       |
| participationRate    | 75.0%    | 68.0%      | -7.0pp (-9.3%)  | MEDIUM     |
| groceries %          | 60.0%    | 64.2%      | +4.2pp (+7.0%)  | HIGH       |
| prepared_food %      | 25.0%    | 21.9%      | -3.1pp (-12.4%) | MEDIUM     |
| groupPurchaseSavings | 15.0%    | 15.0%      | 0.0pp (0.0%)    | HIGH       |

### Detailed Reasoning

**weeklyFoodBudget: +8.3% (HIGH confidence)**

- Baseline assumption: $150/week per participant
- Actual average: $162.45/week across 12 weeks
- Recommendation: Increase budget projection to $162
- Impact: More realistic revenue projections (+8.3%)

**participationRate: -9.3% (MEDIUM confidence)**

- Baseline assumption: 75% of population participates
- Actual participation: 68% based on active spending patterns
- Recommendation: Use 68% for conservative forecasts
- Impact: Lower revenue (-9.3%) but more realistic

...
```

#### category-comparison.csv

Category-level variance analysis:

```csv
Category,Actual Spending,Simulated Spending,Variance ($),Variance (%),Confidence
groceries,12450.50,11280.30,1170.20,10.38,high
prepared_food,3250.75,3890.15,-639.40,-16.45,medium
dining,1820.30,1950.25,-129.95,-6.67,high
farmers_market,890.50,780.00,110.50,14.17,medium
food_delivery,650.20,595.80,54.40,9.13,low
```

#### parameter-adjustments.csv

Detailed parameter calibration:

```csv
Parameter,Baseline,Calibrated,Adjustment ($),Adjustment (%),Confidence,Reasoning
weeklyFoodBudget,150.00,162.45,12.45,8.30,high,"Based on 12 weeks of actual data showing average spending of $162.45/week. Consistent pattern with low volatility (CV=0.12)."
participationRate,0.75,0.68,-0.07,-9.33,medium,"Active participants (68%) lower than projected. Based on transaction frequency analysis across population of 500."
...
```

### Confidence Scoring

**Confidence Levels:**

| Level      | Variance | Interpretation                                   |
| ---------- | -------- | ------------------------------------------------ |
| **HIGH**   | ≤10%     | Projection highly accurate, use calibrated value |
| **MEDIUM** | 10-25%   | Projection reasonable, consider calibration      |
| **LOW**    | >25%     | Projection unreliable, needs review              |

**Confidence Score (0-100):**

```
Score = max(0, min(100, 100 - (Average Variance * 2)))

Example:
Average Variance = 6.4%
Score = 100 - (6.4 * 2) = 87.2/100 → HIGH confidence
```

**Data Quality Factors:**

- **Excellent:** 12+ weeks of data
- **Good:** 8-12 weeks of data
- **Fair:** 4-8 weeks of data
- **Poor:** <4 weeks of data

### Category Mapping

Firefly-iii categories are automatically mapped to FoodUSD categories:

| Firefly Category | FoodUSD Category | Auto-Detected |
| ---------------- | ---------------- | ------------- |
| Groceries        | groceries        | Yes           |
| Supermarket      | groceries        | Yes           |
| Food & Drink     | groceries        | Yes           |
| Restaurants      | dining           | Yes           |
| Fast Food        | prepared_food    | Yes           |
| Takeaway         | food_delivery    | Yes           |
| Delivery         | food_delivery    | Yes           |
| Farmers Market   | farmers_market   | Yes           |
| Farm Stand       | farmers_market   | Yes           |

**Custom Mappings:**

If you use custom categories in Firefly-iii:

```typescript
import { FireflyDataTransformer, CategoryMapping } from "./firefly";

const customMappings: CategoryMapping[] = [
  {
    fireflyCategory: "Whole Foods",
    foodUSDCategory: "groceries",
    description: "Map Whole Foods to groceries",
  },
  {
    fireflyCategory: "CSA Box",
    foodUSDCategory: "farmers_market",
    description: "Community Supported Agriculture",
  },
];

const transformer = new FireflyDataTransformer(customMappings);
```

---

## Customization

### Adjust Simulation Parameters

Modify projection models to test different scenarios:

#### Population Size

```typescript
const LARGE_POPULATION: ProjectionModel = {
  ...AI_ENHANCED_LOCAL_SERVICE,
  name: "AI Service (1000 members)",
  populationSize: 1000, // 2x population
  participationRate: 0.7, // Lower participation at scale
};
```

#### Market Scenarios

```typescript
const CRYPTO_WINTER: ProjectionModel = {
  ...TOKEN_PRE_ORDER,
  name: "Token Pre-Order (Crypto Winter)",
  projectedRiskAdjustedROI: TOKEN_PRE_ORDER.projectedRiskAdjustedROI * 0.4, // -60%
  successProbability: 0.15, // Very low success rate
  growthRatePerWeek: TOKEN_PRE_ORDER.growthRatePerWeek * 0.5, // 50% slower
};
```

#### Token Economy

```typescript
const HIGH_TOKEN_REWARDS: ProjectionModel = {
  ...AI_ENHANCED_LOCAL_SERVICE,
  name: "AI Service (High Token Rewards)",
  tokenDistributionRate: 0.8, // 80% receive tokens (vs 60% baseline)
  stakingParticipation: 0.6, // 60% stake (vs 40% baseline)
  groupBuyingSavings: 0.2, // 20% savings (vs 15% baseline)
};
```

### Custom Report Generation

Generate custom reports programmatically:

```typescript
import { ProjectionValidator } from "./projections";
import {
  exportValidationReport,
  exportComparisonCSV,
} from "./projections/export-results";

const validator = new ProjectionValidator();
const report = await validator.validate(MY_MODEL);

// Custom Markdown report
const customReport = `
# Custom Business Report

## Executive Summary
- ROI: ${report.actual.roi}%
- Revenue: $${report.actual.revenue.toLocaleString()}
- Break-Even: ${report.actual.breakEvenMonths} months

## Risk Assessment
${report.riskAssessment.successAchieved ? "✅ Success" : "❌ Failed"}
- Risk Level: ${report.riskAssessment.riskLevel}
- Confidence: ${report.riskAssessment.confidenceLevel}
`;

fs.writeFileSync("./output/custom-report.md", customReport);

// Custom CSV export
const csvData = [
  ["Metric", "Value"],
  ["ROI", report.actual.roi],
  ["Revenue", report.actual.revenue],
  ["Profit", report.actual.profit],
];

const csvContent = csvData.map((row) => row.join(",")).join("\n");
fs.writeFileSync("./output/custom-data.csv", csvContent);
```

---

## Best Practices

### 1. Data Quality

**Firefly-iii Integration:**

- Use **12+ weeks** of data for HIGH confidence
- Categorize transactions consistently
- Include all food-related spending (groceries, dining, delivery)
- Update regularly for drift analysis

**Validation:**

- Run full validation suite before major decisions
- Compare multiple scenarios (bull, normal, bear)
- Validate assumptions quarterly

### 2. Interpretation

**Revenue Variance:**

- **>300%** - Likely overly optimistic simulation or underestimated projections
- **100-300%** - Strong performance, verify assumptions
- **±50%** - Reasonable alignment
- **<-50%** - Model underperforming, needs adjustment

**ROI Analysis:**

- Compare across all 5 models for ranking
- Consider risk-adjusted ROI (multiply by success probability)
- Account for market scenario (bull vs bear)

**Break-Even:**

- Aim for <6 months for low-risk ventures
- Longer break-even acceptable if ROI is very high (>1000%)
- Track weekly to identify inflection points

### 3. Simulation Frequency

**Recommended Schedule:**

| Frequency     | Use Case                                 | Duration                           |
| ------------- | ---------------------------------------- | ---------------------------------- |
| **Weekly**    | Active project with real data            | ~3 min                             |
| **Monthly**   | Established co-op, track drift           | ~6 min                             |
| **Quarterly** | Strategic planning, budget review        | ~15 min (full suite + calibration) |
| **Annually**  | Long-term validation, projections update | ~30 min (comprehensive analysis)   |

### 4. Model Selection

**Choose the right model for your use case:**

| Model                         | Best For                                | Risk Level |
| ----------------------------- | --------------------------------------- | ---------- |
| **AI-Enhanced Local Service** | Tech-savvy communities, high adoption   | Low-Medium |
| **Sustainable Energy AI**     | Niche markets, specialized services     | Medium     |
| **Community Token Pre-Order** | High trust communities, network effects | High       |
| **Bull Market Variant**       | Optimistic scenarios, fundraising       | Low        |
| **Bear Market Variant**       | Conservative planning, risk assessment  | High       |

### 5. Reporting

**Executive Stakeholders:**

- Use Markdown reports (CALIBRATION_REPORT.md)
- Focus on Overall Accuracy section
- Highlight top 3 parameter adjustments
- Include actionable recommendations

**Technical Teams:**

- Use CSV exports for detailed analysis
- Import into Excel/Google Sheets for charts
- Track weekly progression over time
- Monitor category-level variances

**Board/Investors:**

- Create custom executive summary
- Include ROI ranking comparison
- Show risk-adjusted projections
- Provide confidence scores

---

## Troubleshooting

### Common Issues

#### 1. "Module not found" Error

**Problem:**

```
Error: Cannot find module './projections'
```

**Solution:**

```bash
# Ensure you're in integrations directory
cd integrations

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run build
```

#### 2. Validation Hangs or Takes Too Long

**Problem:** Validation runs for >10 minutes

**Possible Causes:**

- Running all 5 models sequentially (expected: 5-6 minutes)
- Memory leak (rare)
- Large population size (>1000)

**Solution:**

```bash
# Run quick validation first
npm run validate:quick

# If quick works but full hangs, run models individually
npx ts-node --project tsconfig.run.json projections/run-validation.ts
```

#### 3. Firefly-iii Connection Failed

**Problem:**

```
❌ Failed to connect to Firefly-iii
Error: ECONNREFUSED
```

**Solutions:**

**Check Firefly-iii is running:**

```bash
curl http://localhost:8080/api/v1/about
```

Expected: JSON response with Firefly version

**Verify API token:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/v1/about
```

**Check environment variables:**

```bash
echo $FIREFLY_API_TOKEN
echo $FIREFLY_URL
```

**Update token:**

```bash
export FIREFLY_API_TOKEN="new-token-here"
```

#### 4. "No food-related transactions found"

**Problem:** Calibration finds 0 food transactions

**Causes:**

- Transactions not categorized
- Date range has no data
- Custom categories not mapped

**Solutions:**

**1. Check Firefly-iii categories:**

- Log in to Firefly-iii
- Go to **Transactions**
- Verify categories: Groceries, Restaurants, etc.

**2. Expand date range:**

```typescript
{
  analysis: {
    startDate: new Date('2024-01-01'),  // Start of year
    endDate: new Date(),                 // Today
    totalPopulation: 500,
  }
}
```

**3. Add custom mappings:**

```typescript
const customMappings: CategoryMapping[] = [
  { fireflyCategory: "My Food Category", foodUSDCategory: "groceries" },
];
```

#### 5. Low Confidence Calibration

**Problem:** Confidence score <60, level = LOW

**Causes:**

- Insufficient data (<4 weeks)
- High spending volatility
- Inconsistent categorization

**Solutions:**

**1. Increase data period:**

```typescript
{
  analysis: {
    startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),  // Last 6 months
    endDate: new Date(),
  }
}
```

**2. Review spending patterns:**

- Check for large one-time purchases
- Identify anomalies (holidays, special events)
- Verify consistent categorization

**3. Adjust model assumptions:**

- Use median instead of average for volatile data
- Exclude outlier weeks
- Apply smoothing to weekly spending

#### 6. TypeScript Compilation Errors

**Problem:**

```
error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**Solution:**

```bash
# Ensure TypeScript version matches
npm install typescript@5.0 --save-dev

# Clean build
rm -rf dist/
npm run build

# Check tsconfig.json
cat tsconfig.json
```

Expected `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## FAQ

### General

**Q: How long does a full validation take?**
A: 5-6 minutes for all 5 models (1 minute per model × 5 models)

**Q: Can I run simulations in parallel?**
A: No, models must run sequentially to avoid race conditions with shared state.

**Q: How much data do I need for calibration?**
A: Minimum 4 weeks, recommended 12 weeks, optimal 52 weeks (1 year)

**Q: Is Firefly-iii required?**
A: No, Firefly-iii is optional. Simulations run fine without it.

### Technical

**Q: What population sizes are supported?**
A: 100-10,000. Recommended: 300-1,000 for realistic simulations.

**Q: Can I customize the smart contract models?**
A: Yes, all models are TypeScript classes. Extend or modify as needed.

**Q: How accurate are the simulations?**
A: Typical variance ±50% for revenue, ±100% for ROI. Use real data calibration for better accuracy.

**Q: Can I export results to other tools?**
A: Yes, CSV exports work with Excel, Google Sheets, Tableau, Power BI.

### Integration

**Q: Does PMOVES connect to real blockchain?**
A: No, PMOVES simulates contract behavior without deploying to blockchain.

**Q: Can I integrate with QuickBooks/Xero instead of Firefly-iii?**
A: Not yet. Firefly-iii integration is Phase 4. Other integrations planned for future.

**Q: How do I update calibration parameters after each month?**
A: Re-run calibration with updated date range. Compare parameter drift over time.

### Results

**Q: Why is my ROI so high (>5000%)?**
A: Token economy and group savings create significant value beyond traditional revenue. This is expected for successful cooperative models.

**Q: What's a "good" confidence score?**
A: 80+ = HIGH, 60-80 = MEDIUM, <60 = LOW. Aim for 75+ for reliable projections.

**Q: Break-even is delayed in simulation. Is this bad?**
A: Not necessarily. If ROI is still high (>1000%), delayed break-even is acceptable. Focus on long-term profitability.

**Q: Can I trust simulations for fundraising?**
A: Use conservative scenarios (bear market) and calibrate with real data for investor presentations.

---

## Additional Resources

### Documentation

- **[Technical Guide](TECHNICAL_GUIDE.md)** - Architecture and development
- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Folder Structure](FOLDER_STRUCTURE.md)** - Project organization
- **[Documentation Index](DOCUMENTATION_INDEX.md)** - Master index

### External Links

- **[Firefly-iii Docs](https://docs.firefly-iii.org/)** - Personal finance manager
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - Language reference
- **[Node.js Docs](https://nodejs.org/docs/)** - Runtime documentation

### Support

- **[GitHub Issues](https://github.com/POWERFULMOVES/PMOVEStokensim/issues)** - Report bugs
- **[GitHub Discussions](https://github.com/POWERFULMOVES/PMOVEStokensim/discussions)** - Ask questions
- **[CHANGELOG](CHANGELOG_PHASE3_FIXES.md)** - Latest updates

---

<p align="center">
  <a href="README.md">Main README</a> •
  <a href="QUICK_START.md">Quick Start</a> •
  <a href="TECHNICAL_GUIDE.md">Technical Guide</a> •
  <a href="API_REFERENCE.md">API Reference</a>
</p>

<p align="center">
  <strong>Complete PMOVES User Guide</strong><br>
  Last updated: 2025-11-15
</p>
