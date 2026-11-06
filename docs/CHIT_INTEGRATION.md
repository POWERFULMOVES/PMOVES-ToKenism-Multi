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

## Monitoring

- Grep targets: `[CHIT] Published`, `[CHIT] Failed to publish`, `[NATS] Connecting`, `[NATS] Drained subscription`
- Schema validation errors include subject name and AJV error list in the failure log line.