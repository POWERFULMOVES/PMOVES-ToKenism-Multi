# Recipe: Basic CGP Validation

Validate and visualize a Contextual Geometry Packet.

## Prerequisites

- Node.js with ts-node
- Sample CGP document

## Create Sample CGP

```bash
cat > sample-cgp.json << 'EOF'
{
  "version": "chit.cgp.v0.1",
  "packet_id": "cgp-sample-001",
  "created_at": "2026-01-29T12:00:00Z",
  "dirichlet": {
    "alpha": [0.4, 0.35, 0.25],
    "normalized": true
  },
  "hyperbolic": {
    "curvature": -1,
    "position": [0.2, 0.3, 0.4]
  },
  "attributions": [
    {
      "agent_id": "simulation-engine",
      "contribution_weight": 0.5,
      "shape_signature": "sha256:a1b2c3d4e5f6",
      "timestamp": "2026-01-29T11:55:00Z"
    },
    {
      "agent_id": "data-validator",
      "contribution_weight": 0.3,
      "shape_signature": "sha256:b2c3d4e5f6a1",
      "timestamp": "2026-01-29T11:57:00Z"
    },
    {
      "agent_id": "export-handler",
      "contribution_weight": 0.2,
      "shape_signature": "sha256:c3d4e5f6a1b2",
      "timestamp": "2026-01-29T11:59:00Z"
    }
  ]
}
EOF
```

## Step 1: Validate the Document

```bash
npx ts-node .claude/skills/chit-geometry/tools/cgp-validate.ts --input sample-cgp.json
```

Expected output:
```
[cgp-validate] Validation Result
=================================
Status: VALID
Version: chit.cgp.v0.1
Attributions: 3
Total Weight: 1.0000
Has Merkle: No

Warnings:
  - merkle_root is not present
```

## Step 2: Visualize the Shape

### ASCII Visualization
```bash
npx ts-node .claude/skills/chit-geometry/tools/shape-visualize.ts \
  --input sample-cgp.json \
  --format ascii
```

Output:
```
CHIT Shape Visualization: cgp-sample-001
Dirichlet Alpha: [0.400, 0.350, 0.250]
Hyperbolic Curvature: -1
Attributions: 3

|----------------------------------------------------------|
|                                                          |
|                          A40%                            |
|                         . .                              |
|                        .   .                             |
|                       .     .                            |
|                      .   P   .                           |
|                     .         .                          |
|                    .           .                         |
|                   .             .                        |
|                  .               .                       |
|                 B35%...........C25%                      |
|                                                          |
|----------------------------------------------------------|

Legend: A,B,C = simplex vertices, P = distribution point
```

### SVG Visualization
```bash
npx ts-node .claude/skills/chit-geometry/tools/shape-visualize.ts \
  --input sample-cgp.json \
  --format svg \
  --output sample-shape.svg
```

Open `sample-shape.svg` in a browser to view the interactive visualization.

## Step 3: Add Merkle Root

Generate and verify Merkle tree:

```bash
# Generate proof for first attribution
npx ts-node .claude/skills/chit-geometry/tools/merkle-verify.ts \
  --cgp sample-cgp.json \
  --generate \
  --index 0
```

Output:
```json
{
  "leaf": "a1b2c3...",
  "leaf_index": 0,
  "proof": [
    { "hash": "...", "position": "right" },
    { "hash": "...", "position": "right" }
  ],
  "root": "abc123..."
}
```

Add the root to your CGP:
```bash
jq '.merkle_root = "abc123..."' sample-cgp.json > sample-cgp-with-merkle.json
```

## Step 4: Verify Complete Document

```bash
npx ts-node .claude/skills/chit-geometry/tools/cgp-validate.ts \
  --input sample-cgp-with-merkle.json
```

Expected:
```
Status: VALID
Has Merkle: Yes
```

## Understanding the Shape

| Component | Meaning |
|-----------|---------|
| Dirichlet alpha | Contribution weights as probability distribution |
| Hyperbolic curvature | Hierarchical depth (-1 = standard) |
| Position | Location in Poincare ball model |
| Attributions | Agent contributions with proofs |
| Merkle root | Cryptographic commitment to all attributions |

## Next Steps

- See [recipe-advanced.md](recipe-advanced.md) for batch processing
- Explore `integrations/contracts/chit/` for production code
- Publish to GEOMETRY BUS via NATS
