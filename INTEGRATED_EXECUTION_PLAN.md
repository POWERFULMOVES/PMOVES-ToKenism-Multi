# Integrated Execution Plan

**Project:** PMOVEStokensim Economic Validation & Integrations
**Plan Start:** 2025-11-06
**Last Updated:** 2026-05-22
**Owner:** PMOVES Engineering & Data Teams
**Status Legend:** ☐ To Do · ◐ In Progress · ☐⧗ Blocked · ☑ Done

---

## 1. Objectives
- Deliver analytics, integrations, and governance features that align simulation outputs with real-world cooperative data.
- Establish an end-to-end pipeline connecting Firefly-iii, PMOVEStokensim, PMOVES-DoX, and on-chain contract primitives.
- Provide repeatable validation, reporting, and operational workflows exercised through automated testing and documentation.

**Current scope note:** CHIT core hardening has landed in the Tokenism library. Settlement now has typed requested/recorded/failed event contracts plus a deterministic planner, but live Firefly writes, contract deployment, and optimizer-driven parameter changes remain separate gated workstreams.

---

## 2. Workstreams & Key Tasks

### 2.1 Analytics Surface & UX
| Status | Task | Notes |
|--------|------|-------|
| ☑ | Add `/analytics` to primary navigation (`pmoves-nextjs/src/app/layout.tsx`) | Ensure route guard for sample data fallback. |
| ☐ | Implement lazy-loading or route-level code splitting for chart bundle | Prevent large TTI regressions. |
| ☐ | Add Playwright/RTL smoke tests covering tab switching, export presence, and sample data | Capture regressions in CI. |
| ☐ | Document analytics usage flow in `README.md` | Include screenshots once available. |

### 2.2 Export → DoX Automation
| Status | Task | Notes |
|--------|------|-------|
| ☐ | Finalize CLI options for `scripts/integrate_with_dox.py` (paths, feature toggles, dry-run) | Accept CSV/JSON bundle inputs. |
| ☐ | Add DoX health check + failure messaging before uploads | Fail fast when backend offline. |
| ☐ | Trigger optional CHR/datavzrd generation via CLI flag | Store outputs under `artifacts/`. |
| ☐ | Update `integrations/README.md` with workflow & troubleshooting | Include curl examples. |
| ☐ | Add pytest coverage for JSON serializer and CLI argument parsing | Gate via CI. |

### 2.3 Firefly-iii Data Bridge
| Status | Task | Notes |
|--------|------|-------|
| ☑ | Build TypeScript API client leveraging endpoints from analysis | `integrations/firefly/firefly-client.ts` with retry logic |
| ☐ | Map Firefly payloads into simulator-compatible schema | Store under `pmoves_backend/adapters/firefly.py` |
| ☑ | Create contract tests with mocked responses | `integrations/firefly/firefly-client.spec.ts` (PR #30) |
| ☑ | Document API token/env var configuration | Documented in integration README |
| ☐ | Schedule ingestion job (cron or task runner) to refresh calibration data | Output deltas for validation suite |

### 2.4 Smart-Contract Harness & Simulation Hooks
| Status | Task | Notes |
|--------|------|-------|
| ☐ | Install Hardhat dependencies (`contracts/solidity`) & update scripts | Ensure `npx hardhat test` works locally. |
| ☐ | Expand unit tests for `GroVault`, `GroupPurchase`, and governance flows | Cover vote cost, refunds, chair transfers. |
| ☐ | Generate ABI + deployment manifest for simulator / Next.js consumption | Store in `contracts/artifacts/` with `.gitignore`. |
| ☐ | Implement Python adapter that simulates contract interactions during runs | Toggle via config flag. |
| ☐ | Emit synthetic on-chain metrics for analytics dashboard | Include staking, refunds, governance turnout. |

### 2.5 Validation & Reporting
| Status | Task | Notes |
|--------|------|-------|
| ☐ | Re-run `tests/test_economic_model_validation.py` after each major integration | Archive outputs under `validation_reports/`. |
| ☐ | Update `ECONOMIC_MODEL_VALIDATION_REPORT.md` with empirical comparisons | Highlight confidence deltas. |
| ☐ | Automate datavzrd + Pandoc pipeline for dashboards and PDF reports | Add scripts under `scripts/reporting/`. |
| ☐ | Ensure large artifacts ignored via `.gitignore` | Keep repository lightweight. |

### 2.6 Operational Readiness & CI
| Status | Task | Notes |
|--------|------|-------|
| ☐ | Add `npm run analytics:test` and Hardhat lint/test jobs to CI pipeline | Prevent regressions before merge. |
| ☐ | Add `pytest integrate_with_dox` to CI workflow | Validate automation script. |
| ☐ | Document developer onboarding checklist in `ENHANCEMENTS_SUMMARY.md` | Include link to this plan. |
| ☐ | Define risk log (DoX availability, Firefly credentials, contract deployments) | Review weekly. |

---

## 3. Milestones & Target Windows
| Milestone | Target Window | Exit Criteria |
|-----------|---------------|---------------|
| M1: Analytics Launch | Week of 2025-11-17 | Navigation wired, tests added, documentation updated. |
| M2: DoX Automation | Week of 2025-11-24 | CLI complete, CI passing, artifacts generated in dry-run. |
| M3: Firefly Bridge | Week of 2025-12-01 | Client operational with mock tests; data ingested into simulator. |
| M4: Contract Simulation Sync | Week of 2025-12-08 | Hardhat tests passing, simulator emitting contract metrics. |
| M5: Validation Refresh | Week of 2025-12-15 | Report updated with empirical comparisons, automated pipelines running. |
| M6: Ops & CI Hardening | Week of 2025-12-22 | CI expanded, risk log active, onboarding checklist updated. |

---

## 4. Dependencies & Risks
- **PMOVES-DoX Access:** Awaiting repository availability; schedule at risk until confirmed.
- **Firefly Credentials:** Secure vaulting required; blocked without environment strategy.
- **Contract Deployment Targets:** Need clarity on testnet vs local-only usage.
- **Performance Budget:** Analytics bundle must remain performant after new charts.
- **Data Volume:** Ensure large exports do not exceed DoX upload limits.

Mitigations: stagger feature flags, use mock services for CI, document fallback flows.

---

## 5. Progress Log
| Date | Notes |
|------|-------|
| 2025-11-06 | Plan initialized; tasks seeded from visualization, integration, and contract analyses. |
| 2025-11-06 | Navigation shell added with links to Analytics and Sensitivity routes. |
| 2025-11-12 | Phases 1-3 complete: Event bus, contract models, projection validation. |
| 2026-01-15 | Firefly-iii TypeScript client complete with tests (PR #30). |
| 2026-01-20 | CHIT Geometry Bus implemented with NATS publisher. |
| 2026-01-25 | BoTZ Claude Code skills and expertise guides added. |
| 2026-01-29 | Branch consolidated to PMOVES.AI-Edition-Hardened; production configuration work progressed. |
| 2026-05-22 | CHIT core hardening reviewed: real Merkle hashing, schema-validated publisher, fitness tracking only for ToKenism swarm, zeta still heuristic. |
| 2026-05-22 | Settlement interface added: requested/recorded/failed schemas, deterministic planner, idempotency keys, and Hardhat harness validation. |

---

## 6. Immediate Next Actions
1. ~~Confirm DoX repository access and note status in Progress Log.~~ ✅ Available
2. ~~Draft navigation update PR for `/analytics` route.~~ ✅ Complete
3. ~~Outline Firefly client module structure and mock fixtures.~~ ✅ Complete
4. ☐ Install Hardhat dependencies and verify existing contract tests.
5. ☐ Implement Python adapter `pmoves_backend/adapters/firefly.py`
6. ☐ Add `npm run analytics:test` and Hardhat lint/test jobs to CI pipeline
7. ☐ Complete DoX CLI automation (`scripts/integrate_with_dox.py`)

---

**Current Focus:** Tokenism settlement design, contract harness validation, and PMOVES model-fitness/EvoSwarm handoff.

*Update this plan as milestones are reached and risks evolve. Link to this document from team status reports to centralize execution tracking.*
