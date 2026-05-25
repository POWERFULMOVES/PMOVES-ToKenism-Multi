# Tokenism Settlement Flow

**Status:** Interface, planner, Firefly executor, contract dry-run executor, live approval gates, and signed result publisher implemented; production deployment remains gated.
**Last updated:** 2026-05-25

## Scope

This flow makes Tokenism settlement explicit instead of hiding token distribution inside CHIT generation.

CHIT produces attribution. Settlement consumes attribution and creates auditable instructions for Firefly and contract executors.

## Event Flow

1. `tokenism.cgp.weekly.v1` publishes a validated CGP with attribution and Merkle proof roots.
2. `SettlementPlanner` converts the CGP contributors into deterministic instructions.
3. `tokenism.settlement.requested.v1` carries the signed settlement batch.
4. The Firefly executor dry-runs the batch by default, producing transaction drafts without writing to Firefly.
5. Live Firefly mode requires a signed executor identity and matching signed operator approval before `dryRun=false` can write.
6. In live mode, a Firefly executor records accounting entries and the settlement publisher emits validated `tokenism.settlement.recorded.v1` or `tokenism.settlement.failed.v1` events.
7. The contract executor dry-runs manifest-backed calls by default, producing chain call drafts without signing transactions.
8. Live contract mode requires a deployment manifest, signed executor identity, and matching signed operator approval before `dryRun=false` can submit calls through a caller-provided client.
9. Live contract execution emits the same recorded/failed result events with `lane: "contract"` and `tx_hash` when a client returns one.

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
- Matching signed operator approval for `firefly_live_execution` or `contract_live_execution`.
- Deployment manifest with validated contract addresses before contract-lane execution.
- CGP Merkle root present when `requireMerkleRoot=true`.
- Firefly dry-run mode passing against the target instance.
- Schema-validated signed result publishing passing for recorded and failed settlement events.
- Hardhat harness passing for GroToken, FoodUSD, GroupPurchase, GroVault, and CoopGovernor.

## Current Validation

- `contracts/solidity`: `npm ci && npm test` compiles Solidity contracts and passes the existing 5 Hardhat tests.
- `contracts/solidity`: `npm run manifest` exports an ABI manifest from Hardhat artifacts; deployment addresses are required when `REQUIRE_DEPLOYMENT_ADDRESSES=true`.
- `integrations/contracts/settlement-planner.ts` is deterministic and covered by Jest tests.
- `integrations/contracts/contract-settlement-executor.ts` validates deployment manifests, dry-run call drafts, live approval gating, write failures, and contract-lane result events.
- `integrations/firefly/settlement-executor.ts` validates dry-run behavior, live approval gating, live client writes, write failures, and duplicate idempotency-key rejection.
- `integrations/firefly/settlement-publisher.ts` validates recorded/failed events against Tokenism schemas before best-effort or strict NATS publish.

## Non-goals

- Dry-run mode does not submit Firefly API requests. Live mode is implemented and gated on executor identity plus operator approval.
- Dry-run contract mode does not sign or submit transactions. Live mode is implemented behind deployment, executor identity, and operator approval gates.
- This pass does not deploy contracts or choose production RPC/wallet custody.
- This pass does not decide token monetary policy; it only makes the settlement path typed and replay-safe.
