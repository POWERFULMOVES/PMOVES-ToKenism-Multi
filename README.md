# PMOVES Token Economy Simulator

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](https://github.com)

**A comprehensive token economy simulation and projection validation framework for cooperative food systems, integrated with real financial data.**

---

## 🌟 What is PMOVES?

PMOVES (Powerful Moves Token Economy Simulator) is a production-ready framework that simulates cooperative food purchasing systems with blockchain-based token incentives. It validates business projections against 5-year simulations and calibrates models using real financial data from Firefly-iii.

### Key Features

- **🔬 5-Year Business Simulations** - Validate projections across 260 weeks
- **🪙 Smart Contract Models** - 5 fully-integrated token economy contracts
- **📊 Real Data Integration** - Calibrate with actual spending from Firefly-iii
- **📈 Projection Validation** - Compare projected vs actual performance
- **🎯 Confidence Scoring** - HIGH/MEDIUM/LOW confidence for all calibrations
- **📝 Comprehensive Reports** - Markdown + CSV exports for analysis
- **🔄 Event-Driven Architecture** - Pub/sub pattern for contract communication
- **✅ Production Ready** - TypeScript strict mode, full type safety

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **TypeScript 5.0+**
- **Firefly-iii** (optional, for real data calibration)

### Installation

```bash
# Clone the repository
git clone https://github.com/POWERFULMOVES/PMOVEStokensim.git
cd PMOVEStokensim/integrations

# Install dependencies
npm install

# Run quick validation (1 model, 260 weeks)
npm run validate:quick
```

### Run Your First Simulation

```bash
# Full validation (5 models, 1,300 weeks total)
npm run validate:all

# View results
cat ../TEST_RESULTS_PHASE3.md
```

### Calibrate with Real Data

```bash
# Set Firefly-iii API token
export FIREFLY_API_TOKEN="your-token-here"

# Run calibration (analyzes last 90 days)
npx ts-node --project tsconfig.run.json firefly/run-integration.ts

# View calibration report
cat output/firefly-calibration/CALIBRATION_REPORT.md
```

### Export Simulation Data

Populate Firefly-iii with synthetic transaction history:

```bash
# Run simulation and export to Firefly
npm run firefly:export-sim
```

---

## 📚 Documentation

### For Users

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in 5 minutes
- **[User Guide](USER_GUIDE.md)** - Complete usage documentation
- **[Folder Structure](FOLDER_STRUCTURE.md)** - Project organization

### For Developers

- **[Technical Guide](TECHNICAL_GUIDE.md)** - Architecture and implementation
- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Documentation Index](DOCUMENTATION_INDEX.md)** - Master index of all docs

### Phase Documentation

- **[Phase 1: Event Bus](integrations/event-bus/README.md)** - Pub/sub architecture
- **[Phase 2: Contracts](integrations/contracts/README.md)** - Smart contract models
- **[Phase 3: Projections](integrations/projections/README.md)** - Validation framework
- **[Phase 4: Firefly Integration](integrations/firefly/README.md)** - Real data calibration

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PMOVES Token Economy                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ↓             ↓             ↓
         ┌────────────┐  ┌────────────┐  ┌────────────┐
         │  Phase 1   │  │  Phase 2   │  │  Phase 3   │
         │ Event Bus  │→ │ Contracts  │→ │Projections │
         └────────────┘  └────────────┘  └────────────┘
                                               ↓
                                        ┌────────────┐
                                        │  Phase 4   │
                                        │  Firefly   │
                                        └────────────┘
```

### Components

1. **Event Bus** - Pub/sub messaging for contract communication
2. **Smart Contracts** - 5 token economy models (GroToken, FoodUSD, GroupPurchase, GroVault, CoopGovernor)
3. **Projection Validator** - 5-year simulation and variance analysis
4. **Firefly Integration** - Real data calibration and confidence scoring

---

## 🎯 Use Cases

### 1. Business Planning

Validate cooperative food purchasing projections before launch:

- Test different population sizes (100, 500, 1000+ members)
- Compare market scenarios (bull, normal, bear, crypto-winter)
- Validate ROI assumptions (1,366% baseline)
- Optimize break-even timeline (3.3 months projected)

### 2. Real Data Validation

Calibrate models with actual spending behavior:

- Fetch 3-12 months of Firefly-iii transactions
- Map spending categories (Groceries → groceries, etc.)
- Adjust parameters (weekly budget, participation rate)
- Generate confidence scores (HIGH/MEDIUM/LOW)

### 3. Token Economy Design

Model blockchain-based incentive systems:

- Simulate 260 weeks of token distributions
- Track 100+ participants with Gaussian distribution
- Test group purchase savings (15% baseline)
- Validate staking rewards and governance

### 4. Continuous Improvement

Improve projections as you collect data:

- Weekly/monthly calibration runs
- Track parameter drift over time
- Identify emerging spending patterns
- Refine market scenario assumptions

---

## 📊 Example Results

### Business Projection Validation

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

Break-Even:
  Projected: 3.3 months
  Actual:    5.3 months
  Variance:  +61.0%

⚠️ RISK ASSESSMENT
Success Achieved: ❌ NO (break-even delayed)
Confidence Level: LOW

📈 ANALYSIS
Revenue Growth:    LINEAR
Profitability:     IMPROVING
Market Scenario:   BULL
Token Impact:      POSITIVE
```

### Firefly-iii Calibration

```
Overall Accuracy:
  Confidence Level: HIGH
  Confidence Score: 87.3/100
  Average Variance: 6.4%

Parameter Adjustments:
  weeklyFoodBudget: $150 → $162.45 (+8.3%, HIGH confidence)
  participationRate: 75% → 68% (-9.3%, MEDIUM confidence)
  categoryDistribution.groceries: 60% → 64.2% (+7.0%, HIGH confidence)

Recommendations:
  1. Increase weekly budget to $162 per participant
  2. Adjust participation assumption to 68% for conservative forecasts
  3. Groceries spending 4% higher than projected
```

---

## 🛠️ Technology Stack

### Core

- **TypeScript 5.0** - Type-safe development
- **Node.js 18+** - Runtime environment
- **Ethers.js 6.x** - Ethereum utilities (for address generation)

### Testing

- **Jest 29.x** - Unit and integration testing
- **ts-jest** - TypeScript support for Jest

### Data Integration

- **Axios** - HTTP client for Firefly-iii API
- **Firefly-iii** - Personal finance manager (external)

### Development

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **ts-node** - TypeScript execution

---

## 📈 Performance

- **Simulation Speed:** ~60 seconds per 260-week model
- **Full Validation Suite:** ~5-6 minutes (5 models)
- **Firefly Integration:** ~2-3 minutes end-to-end
- **Memory Usage:** Efficient, no leaks
- **Concurrent Models:** Sequential execution (prevents race conditions)

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Event Bus tests
npm test event-bus

# Contract models
npm test contracts

# Projection validation
npm test projections
```

### Test Coverage

- Event Bus: 100% coverage
- Contract Models: 95%+ coverage
- Projection Validator: 90%+ coverage
- Firefly Integration: Mock data testing

---

## 📂 Project Structure

```
PMOVEStokensim/
├── integrations/           # Main source code
│   ├── event-bus/         # Phase 1: Pub/sub messaging
│   ├── contracts/         # Phase 2: Token economy models
│   ├── projections/       # Phase 3: Validation framework
│   └── firefly/           # Phase 4: Real data integration
├── QUICK_START.md         # Quick start guide
├── USER_GUIDE.md          # User documentation
├── TECHNICAL_GUIDE.md     # Developer documentation
├── API_REFERENCE.md       # API reference
├── FOLDER_STRUCTURE.md    # Project organization
└── DOCUMENTATION_INDEX.md # Master index
```

See [FOLDER_STRUCTURE.md](FOLDER_STRUCTURE.md) for detailed organization.

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Workflow

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Build
npm run build
```

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

**PMOVES Development Team**

- Cooperative food systems specialists
- Blockchain economists
- Token economy architects
- Data integration engineers

---

## 🔗 Links

- **Documentation:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- **User Guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **Technical Guide:** [TECHNICAL_GUIDE.md](TECHNICAL_GUIDE.md)
- **API Reference:** [API_REFERENCE.md](API_REFERENCE.md)
- **Issues:** [GitHub Issues](https://github.com/POWERFULMOVES/PMOVEStokensim/issues)

---

## 🙏 Acknowledgments

- **Firefly-iii** - Personal finance management
- **TypeScript** - Type-safe JavaScript
- **Ethers.js** - Ethereum utilities
- **Jest** - Testing framework

---

## PMOVES.AI Integration

This repository is part of the [PMOVES.AI](https://github.com/POWERFULMOVES/PMOVES.AI) multi-agent orchestration platform.

### Integration Points

| Service | Purpose | Status |
|---------|---------|--------|
| **NATS** | Event bus for simulation results | Stub ready |
| **TensorZero** | LLM gateway for insights | Planned |
| **Supabase** | Results persistence | Planned |
| **Agent Zero** | Task orchestration | Planned |

### Health Endpoints

The Flask backend exposes health check endpoints:

```bash
# Health check
curl http://localhost:5000/healthz

# Readiness probe
curl http://localhost:5000/readyz

# Basic metrics
curl http://localhost:5000/metrics
```

### Event Publishing

Simulation results can be published to NATS:

```typescript
import { natsClient } from './integrations/nats/nats-client';

await natsClient.connect();
await natsClient.publishSimulationResult({
  simulationId: 'sim-123',
  scenario: 'baseline',
  weeklyHistory: [...],
  finalMetrics: {...},
  parameters: {...}
});
```

See [integrations/nats/README.md](integrations/nats/README.md) for details.

---

## Support

- **Documentation:** See [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
- **Issues:** [GitHub Issues](https://github.com/POWERFULMOVES/PMOVEStokensim/issues)
- **Discussions:** [GitHub Discussions](https://github.com/POWERFULMOVES/PMOVEStokensim/discussions)

---

## 🎉 Status

**Current Version:** v1.0.0 (Production Ready)

- ✅ Phase 1: Event Bus - COMPLETE
- ✅ Phase 2: Contract Integration - COMPLETE
- ✅ Phase 3: Projection Validation - COMPLETE
- ✅ Phase 4: Firefly Integration - COMPLETE

**All systems operational. Ready for production deployment.**

---

<p align="center">
  Made with ❤️ by the PMOVES Team<br>
  <a href="QUICK_START.md">Quick Start</a> •
  <a href="USER_GUIDE.md">User Guide</a> •
  <a href="TECHNICAL_GUIDE.md">Technical Guide</a> •
  <a href="API_REFERENCE.md">API Reference</a>
</p>
