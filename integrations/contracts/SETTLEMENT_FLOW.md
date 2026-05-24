# Tokenism Settlement Flow

**Status:** Interface, planner, Firefly dry-run executor, and signed result publisher implemented; live Firefly and chain execution remain gated.
**Last updated:** 2026-05-24

## Scope

This flow makes Tokenism settlement explicit instead of hiding token distribution inside CHIT generation.

CHIT produces attribution. Settlement consumes attribution and creates auditable instructions for Firefly and contract executors.

## Event Flow

1. `tokenism.cgp.weekly.v1` publishes a validated CGP with attribution and Merkle proof roots.
2. `SettlementPlanner` converts the CGP contributors into deterministic instructions.
3. `tokenism.settlement.requested.v1` carries the signed settlement batch.
4. The Firefly executor dry-runs the batch by default, producing transaction drafts without writing to Firefly.
5. In live mode, a Firefly executor records accounting entries and the settlement publisher emits validated `tokenism.settlement.recorded.v1` or `tokenism.settlement.failed.v1` events.
6. A contract executor mints/transfers/records on chain and emits the same recorded/failed result events.

## Idempotency

Each instruction has an `idempotency_key` derived from:

- settlement profile
- week
- contributor address
- amount and asset
- action
- CGP hash

Executors must treat `idempotency_key` as unique. Replays with an already-recorded key should emit `tokenism.settlement.recorded.v1` with `status: "skipped"` and the original external reference when available.

## Trust Boundary

Required before trusted live execution:

- Signed `tokenism.settlement.requested.v1` event.
- Registered agent identity for the planner/executor.
- CGP Merkle root present when `requireMerkleRoot=true`.
- Firefly dry-run mode passing against the target instance.
- Schema-validated signed result publishing passing for recorded and failed settlement events.
- Hardhat harness passing for GroToken, FoodUSD, GroupPurchase, GroVault, and CoopGovernor.

## Current Validation

- `contracts/solidity`: `npm ci && npm test` compiles 14 Solidity files and passes the existing 4 Hardhat tests.
- `integrations/contracts/settlement-planner.ts` is deterministic and covered by Jest tests.
- `integrations/firefly/settlement-executor.ts` validates dry-run behavior, live client writes, write failures, and duplicate idempotency-key rejection.
- `integrations/firefly/settlement-publisher.ts` validates recorded/failed events against Tokenism schemas before best-effort or strict NATS publish.

## Non-goals

- Dry-run mode does not submit Firefly API requests. Live mode is implemented but should remain gated on executor identity and operator approval.
- This pass does not deploy contracts or sign transactions.
- This pass does not decide token monetary policy; it only makes the settlement path typed and replay-safe.
