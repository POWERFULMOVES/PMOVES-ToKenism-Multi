# CHIT Integration

> Contract for publishing CHIT geometry/attribution events from PMOVES-ToKenism-Multi onto the PMOVES.AI Geometry Bus (NATS). This document is referenced by the parent `POWERFULMOVES/PMOVES.AI` repo's NATS subject catalog (`pmoves/.claude/context/geometry-nats-subjects.md`).

## Overview

ToKenism runs weekly economic simulations whose attribution outcomes are exported as **CHIT geometry documents (CGP)** and broadcast on the shared PMOVES.AI NATS bus. The integration is publish-only from this repo's simulation side; parent services (publisher-discord, Hi-RAG v2, Shape Store, consciousness service) consume the events.

Implementation lives in:

- `integrations/contracts/chit/chit-nats-publisher.ts` — validated publisher (`CHITNATSPublisher`)
- `integrations/contracts/chit/cgp-generator.ts` — CGP document generation
- `integrations/nats/nats-client.ts` — connection/reconnect handling
- `contracts/schemas/tokenism/*.v1.schema.json` — JSON Schemas (AJV-validated)

## NATS Subjects

All subjects are published (not subscribed) by this repo and match the parent Geometry Bus subject catalog exactly:

| Subject | Trigger | Required payload keys | Key optional keys |
|---|---|---|---|
| `tokenism.swarm.population.v1` | Per-generation swarm progress during CGP optimization | `namespace, modality, pack_id, status, timestamp` | `population_id, generation, best_fitness, metrics` |
| `tokenism.attribution.recorded.v1` | Per-member CHIT attribution recorded in a simulation week | `chit_id, address, action, amount, week, timestamp` | `category, merkle_root` |
| `tokenism.cgp.weekly.v1` | Weekly CGP export (end-of-week attribution summary) | `week, cgp, super_node_count, total_attributions, cgp_spec` | `gini, poverty_rate` |
| `tokenism.cgp.ready.v1` | CGP document ready for downstream consumption (also used by parent research services: DeepResearch / SupaSerch CGP publish) | `cgp, super_node_count, source, cgp_spec, timestamp` | `week` |

The CGP document embedded in `cgp` follows spec `chit.cgp.v0.2` (weekly export) / `chit.cgp.v0.1` (research-produced CGPs), and itself validates against `contracts/schemas/geometry/cgp.v1.schema.json`.

## Payload Reference

### `tokenism.cgp.weekly.v1`

```json
{
  "week": 12,
  "cgp": {
    "spec": "chit.cgp.v0.2",
    "summary": "ToKenism Week 12 Economic Simulation",
    "created_at": "2026-01-05T12:00:00Z",
    "super_nodes": [
      {
        "id": "grotoken-week-12",
        "label": "GroToken Distribution",
        "x": 0.0,
        "y": 0.0,
        "r": 0.3,
        "constellations": ["..."]
      }
    ],
    "meta": {
      "attribution": {
        "total_attributions": 1240,
        "by_category": {
          "grotoken_reward": 620,
          "coop_purchase": 380,
          "local_production": 240
        }
      }
    }
  },
  "super_node_count": 1,
  "total_attributions": 1240,
  "cgp_spec": "chit.cgp.v0.2",
  "gini": 0.34,
  "poverty_rate": 0.11
}
```

### `tokenism.attribution.recorded.v1`

```json
{
  "chit_id": "chit-2026-w12-000123",
  "address": "0xabc...def",
  "action": "grotoken_reward",
  "amount": 12.5,
  "week": 12,
  "category": "grotoken_reward",
  "merkle_root": null,
  "timestamp": "2026-01-05T12:00:00Z"
}
```

### `tokenism.swarm.population.v1`

```json
{
  "namespace": "tokenism",
  "modality": "economic-sim",
  "pack_id": "grotoken-week-12",
  "status": "running",
  "population_id": "pop-001",
  "generation": 42,
  "best_fitness": 0.87,
  "metrics": {
    "gini": 0.34,
    "poverty_rate": 0.11
  },
  "timestamp": "2026-01-05T12:00:00Z"
}
```

### `tokenism.cgp.ready.v1`

```json
{
  "cgp": { "spec": "chit.cgp.v0.2", "summary": "...", "super_nodes": ["..."], "meta": {} },
  "super_node_count": 1,
  "week": 12,
  "source": "tokenism-simulator",
  "cgp_spec": "chit.cgp.v0.2",
  "timestamp": "2026-01-05T12:00:00Z"
}
```

## Validation & Publishing Guarantees

- Every payload is **AJV-validated** against its JSON Schema **before** publish; an invalid payload raises and is **not** published (fail-closed).
- The geometry CGP schema is registered alongside the tokenism schemas so nested `cgp` objects validate against `contracts/schemas/geometry/cgp.v1.schema.json`.
- Publish failures are logged as `[CHIT] Failed to publish <subject>: <reason>` and return `false` to the caller.
- Successful publishes log `[CHIT] Published <subject>: <pack_id>`.

## Connection

- Client: `integrations/nats/nats-client.ts`
- URL resolution order: explicit config → `NATS_URL` env → default `nats://nats:pmoves@nats:4222`
- Reconnect handling and drain-on-shutdown are built in; subscription drain logs `[NATS] Drained subscription: <subject>`.

## Consumers (Parent Side)

| Service | Subjects | Behavior |
|---|---|---|
| Publisher Discord | `tokenism.*` | Formats events as Discord embeds |
| Hi-RAG Gateway v2 | `tokenism.cgp.ready.v1`, `geometry.*` | `POST /geometry/event` ingestion |
| Shape Store | `geometry.event.v1` | Persistence layer |
| Consciousness Service | `tokenism.cgp.ready.v1` | Always-on consumer |

Parent-side enablement flags (from the parent catalog): `DEEPRESEARCH_CGP_PUBLISH`, `SUPASERCH_CGP_PUBLISH` (research-produced CGPs → `tokenism.cgp.ready.v1`), `CHIT_VOICE_ATTRIBUTION` (`tokenism.geometry.event.v1`, voice events).

## Corpus & Integration Links

This integration is governed by the AGNOTE4482 corpus and PMOVESCHIT doctrine in the parent monorepo:

| Document | Link | Relevance |
|---|---|---|
| AGNOTE4482 (main corpus) | [pmoves/docs/AGENTS/AGNOTE4482.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/docs/AGENTS/AGNOTE4482.md) | Canonical convergence record; agents claim work here before edits |
| AGNOTE4482 Signoff Checklist | [AGNOTE4482_SIGNOFF_CHECKLIST.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/docs/AGENTS/AGNOTE4482_SIGNOFF_CHECKLIST.md) | Shared multi-agent merge-signoff gate |
| AGNOTE4482.FlOO$ (PR review flow) | [AGNOTE4482.FlOO$.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/docs/AGENTS/AGNOTE4482.FlOO$.md) | Sanctioned merge chain: validate → resolve → run-dry → chit-packet → strict |
| pr-monitor skill | [pr-monitor-skill/SKILL.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/skills/pr-monitor-skill/SKILL.md) | Retry discipline, learning taxonomy, strict gate behavior |
| Geometry Bus NATS Subject Catalog | [geometry-nats-subjects.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/.claude/context/geometry-nats-subjects.md) | The subject catalog this document fulfills |
| Three-Body Doctrine | [THREE_BODY_DOCTRINE.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/docs/PMOVESCHIT/THREE_BODY_DOCTRINE.md) | Foundational Human/AI/System stabilization layer behind CHIT geometry |
| CHIT Flow Index | [CHIT_FLOW_INDEX.md](https://github.com/POWERFULMOVES/PMOVES.AI/blob/main/pmoves/docs/PMOVESCHIT/CHIT_FLOW_INDEX.md) | CHIT pipeline flow index (run-dry → chit-packet chain) |

Integrating repositories and services:

| Repo / Service | Role |
|---|---|
| [POWERFULMOVES/PMOVES.AI](https://github.com/POWERFULMOVES/PMOVES.AI) | Parent monorepo; consumes this repo as a core submodule tracking `PMOVES.AI-Edition-Hardened`; builds GHCR images from it |
| [POWERFULMOVES/PMOVES-Wealth](https://github.com/POWERFULMOVES/PMOVES-Wealth) | Submodule sibling — wealth/finance lane; Firefly III settlement bridge feeds it |
| [POWERFULMOVES/PMOVES-DoX](https://github.com/POWERFULMOVES/PMOVES-DoX) | Submodule sibling — Agent Zero MCP tool for standalone mode |
| Pmoves-hyperdimensions (parent) | Three.js CHIT geometry visualizer — consumes CGP documents |
| publisher-discord (parent service) | Consumes `tokenism.*` → Discord embeds |
| Hi-RAG Gateway v2 (parent service) | Consumes `tokenism.cgp.ready.v1`, `geometry.*` → `POST /geometry/event` |
| Shape Store (parent service) | Persistence for `geometry.event.v1` |
| Consciousness Service (parent service) | Always-on consumer of `tokenism.cgp.ready.v1` |

## Monitoring

- Grep targets: `[CHIT] Published`, `[CHIT] Failed to publish`, `[NATS] Connecting`, `[NATS] Drained subscription`
- Schema validation errors include subject name and AJV error list in the failure log line.