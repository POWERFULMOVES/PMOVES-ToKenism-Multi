# PMOVES-ToKenism-Multi Roadmap

**Last Updated:** 2026-01-29
**Branch:** PMOVES.AI-Edition-Hardened (Production)
**Status:** Production Ready with Active Development

---

## Overview

This document consolidates all project plans into a single source of truth for PMOVES.AI development. For detailed implementation specifics, see the referenced documents.

---

## Current State (Q1 2026)

### Completed
- [x] **Core Simulation** - 260-week economic modeling with 309% ROI improvement
- [x] **Contract Models** - GroToken, FoodUSD, GroupPurchase, GroVault, CoopGovernor
- [x] **CHIT Geometry Bus** - CGP generation, Merkle proofs, NATS publisher
- [x] **Firefly Integration** - TypeScript client, CSV export, 312 transaction validation
- [x] **BoTZ Architecture** - 4 Claude Code skills, safety patterns, expertise guides
- [x] **Testing** - 96 contract + 41 Python + 14 Jest tests passing
- [x] **Security** - Non-root containers, Flask/TS hardening (PRs #21, #22, #32)

### In Progress
- [ ] **Frontend UI** - Animation, design tokens, accessibility improvements
- [ ] **Production Config** - Environment files for 6-tier architecture
- [ ] **DoX Integration** - CLI automation, dashboard generation

### Planned
- [ ] **EvoSwarm** - Self-improving feedback loops
- [ ] **Venice.ai** - Big Thread offloading to frontier models
- [ ] **MACA Consensus** - Multi-Agent Consensus Alignment

---

## Q1 2026 Milestones

| Milestone | Target | Status | Reference |
|-----------|--------|--------|-----------|
| Phase 1-4 Complete | 2026-01-15 | ✅ Done | IMPLEMENTATION_PLAN.md |
| CHIT Geometry Bus | 2026-01-20 | ✅ Done | PR #25 |
| BoTZ Skills | 2026-01-25 | ✅ Done | PR #26 |
| Frontend Polish | 2026-02-15 | ⏳ In Progress | FRONTEND_IMPROVEMENT_PLAN.md |
| Production Deploy | 2026-02-28 | ⏳ Pending | docker-compose.pmoves.yml |

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           PMOVES.AI Platform            │
                    └─────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
   ┌────▼────┐                   ┌────▼────┐                   ┌────▼────┐
   │  DATA   │                   │   API   │                   │   LLM   │
   │  Tier   │                   │  Tier   │                   │  Tier   │
   └────┬────┘                   └────┬────┘                   └────┬────┘
        │                             │                             │
   Supabase                      Flask API                    TensorZero
   Neo4j                         Next.js                      Claude Code
   ClickHouse                    NATS                         Venice.ai
        │                             │                             │
   ┌────▼────┐                   ┌────▼────┐                   ┌────▼────┐
   │ WORKER  │                   │  MEDIA  │                   │  AGENT  │
   │  Tier   │                   │  Tier   │                   │  Tier   │
   └─────────┘                   └─────────┘                   └─────────┘
   Background                    ComfyUI                      Agent Zero
   CHIT Publisher                VibeVoice                    MCP Servers
```

---

## Key Documents

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 6-phase technical implementation | 2026-01-29 |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Current implementation status | 2026-01-29 |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Project overview and metrics | 2026-01-29 |
| [INTEGRATED_EXECUTION_PLAN.md](INTEGRATED_EXECUTION_PLAN.md) | Task-level execution tracking | 2026-01-29 |
| [CLAUDE.md](CLAUDE.md) | Developer context for Claude Code | 2026-01-29 |

### Frontend Plans
| Document | Purpose |
|----------|---------|
| [pmoves-nextjs/FRONTEND_IMPROVEMENT_PLAN.md](pmoves-nextjs/FRONTEND_IMPROVEMENT_PLAN.md) | 8-week UI improvement roadmap |
| [pmoves-nextjs/implementation-plan.md](pmoves-nextjs/implementation-plan.md) | MathModelService integration |
| [pmoves-nextjs/model-adjustment-plan.md](pmoves-nextjs/model-adjustment-plan.md) | Economic model parameter tuning |

### Architecture Documents
| Document | Location |
|----------|----------|
| PMOVES.AI Agentic Architecture Deep Dive | agents/ |
| HARDWARE_TTS_REQUIREMENTS | agents/ |
| PMOVES_Engine_Templates | agents/ |

---

## Development Workflow

### Thread-Based Engineering (BoTZ Doctrine)

| Thread | Symbol | Use Case | Model |
|--------|--------|----------|-------|
| Base | B | Standard prompt-response | Sonnet |
| Parallel | P | Concurrent independent tasks | Haiku |
| Chained | C | Sequential dependent operations | Sonnet |
| Fusion | F | Multi-agent consensus (MACA) | Opus |
| Big | L | Frontier model offloading | Opus |
| Zero-Touch | Z | Automated workflows | Haiku |

### Quick Commands

```bash
# Development
cd pmoves_backend && python flask_backend.py  # Backend
cd pmoves-nextjs && npm run dev               # Frontend

# Testing
pytest                                         # Python tests
npm run test:jest                             # Jest tests
npm run lighthouse:local                      # Lighthouse audit

# CHIT Export
cd integrations && npx ts-node contracts/chit/export-sample-cgp.ts
```

---

## Contributing

1. Check [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for current status
2. Review `agents/` for architectural guidance
3. Follow BoTZ patterns in `.claude/patterns.yaml`
4. Use skills in `.claude/skills/` for common workflows

---

## Pending High-Priority Items

| Item | Owner | Blocked By |
|------|-------|------------|
| Production env files | DevOps | None |
| EvoSwarm Evo-Controller | Core | Architecture review |
| Python Firefly adapter | Backend | None |
| CI pipeline expansion | DevOps | None |
| DoX CLI automation | Integration | DoX deployment |

---

**Version:** 1.0.0
**Maintained by:** PMOVES.AI Engineering Team
