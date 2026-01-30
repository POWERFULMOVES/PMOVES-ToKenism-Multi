# CHIT Geometry Cookbook

Progressive disclosure guide for the chit-geometry skill.

## Quick Start

Validate a CGP document:
```bash
npx ts-node .claude/skills/chit-geometry/tools/cgp-validate.ts --input packet.json
```

## What is CHIT?

**Cymatic-Holographic Information Transfer (CHIT)** encodes agent contributions as geometric shapes using:

- **Dirichlet distributions** for contribution weighting
- **Hyperbolic geometry** for hierarchical relationships
- **Merkle trees** for cryptographic verification

## Recipes

| Recipe | Use Case | Complexity |
|--------|----------|------------|
| [Basic Validation](recipe-basic.md) | Validate CGP documents | Beginner |
| [Advanced Geometry](recipe-advanced.md) | Shape generation, proofs | Advanced |

## Tools Reference

| Tool | Purpose |
|------|---------|
| `cgp-validate.ts` | Validate CGP documents against schema |
| `shape-visualize.ts` | Generate ASCII/SVG shape visualizations |
| `merkle-verify.ts` | Verify Merkle proofs for attribution chains |

## CGP Document Structure

```json
{
  "version": "chit.cgp.v0.1",
  "packet_id": "cgp-abc123",
  "created_at": "2026-01-29T12:00:00Z",
  "dirichlet": {
    "alpha": [0.4, 0.35, 0.25]
  },
  "hyperbolic": {
    "curvature": -1,
    "position": [0.1, 0.2, 0.3]
  },
  "attributions": [
    {
      "agent_id": "agent-001",
      "contribution_weight": 0.5,
      "shape_signature": "sha256:...",
      "timestamp": "2026-01-29T12:00:00Z"
    }
  ],
  "merkle_root": "abc123..."
}
```

## Common Tasks

### Validate before publishing
```bash
npx ts-node tools/cgp-validate.ts --input my-cgp.json
```

### Visualize shape
```bash
# ASCII art
npx ts-node tools/shape-visualize.ts --input my-cgp.json --format ascii

# SVG file
npx ts-node tools/shape-visualize.ts --input my-cgp.json --format svg --output shape.svg
```

### Verify Merkle proof
```bash
npx ts-node tools/merkle-verify.ts --cgp my-cgp.json
```

## GEOMETRY BUS Integration

CGP documents are published to NATS subjects:
- `tokenism.cgp.ready.v1` - New CGP available
- `tokenism.attribution.recorded.v1` - Attribution events

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.
