# Recipe: Advanced CHIT Geometry

Batch processing, Merkle tree operations, and GEOMETRY BUS integration.

## Prerequisites

- Basic recipe completed
- Understanding of CGP structure
- NATS running for GEOMETRY BUS

## Batch CGP Validation

Validate multiple CGP documents:

```bash
#!/bin/bash
# validate-all.sh

VALID=0
INVALID=0

for file in packets/*.json; do
  result=$(npx ts-node tools/cgp-validate.ts --input "$file" --json 2>/dev/null)
  is_valid=$(echo "$result" | jq -r '.valid')

  if [ "$is_valid" = "true" ]; then
    echo "VALID: $file"
    ((VALID++))
  else
    echo "INVALID: $file"
    echo "$result" | jq '.errors[]'
    ((INVALID++))
  fi
done

echo ""
echo "Summary: $VALID valid, $INVALID invalid"
```

## Merkle Tree Operations

### Build complete tree from attributions
```typescript
// build-merkle.ts
import { buildMerkleTree, generateProof } from './tools/merkle-verify';
import * as fs from 'fs';

const cgp = JSON.parse(fs.readFileSync('packet.json', 'utf-8'));
const { root, leaves, tree } = buildMerkleTree(cgp.attributions);

console.log('Merkle Tree Built:');
console.log(`  Root: ${root}`);
console.log(`  Leaves: ${leaves.length}`);
console.log(`  Levels: ${tree.length}`);

// Generate proofs for all leaves
const proofs = leaves.map((_, index) => ({
  leaf_index: index,
  proof: generateProof(tree, index),
}));

fs.writeFileSync('proofs.json', JSON.stringify(proofs, null, 2));
```

### Verify attribution inclusion
```bash
# Check if specific agent is in the tree
npx ts-node tools/merkle-verify.ts \
  --cgp packet.json \
  --generate \
  --index 0 > proof_agent_0.json

# Verify the proof
npx ts-node tools/merkle-verify.ts \
  --proof proof_agent_0.json
```

## Dirichlet Distribution Analysis

Analyze how contribution weights map to geometry:

```typescript
// analyze-dirichlet.ts
import * as fs from 'fs';

interface CGP {
  dirichlet: { alpha: number[] };
  attributions: Array<{ contribution_weight: number }>;
}

const cgp: CGP = JSON.parse(fs.readFileSync('packet.json', 'utf-8'));

// Calculate concentration parameter
const alphaSum = cgp.dirichlet.alpha.reduce((a, b) => a + b, 0);
const concentration = alphaSum / cgp.dirichlet.alpha.length;

// Calculate entropy
const probs = cgp.dirichlet.alpha.map(a => a / alphaSum);
const entropy = -probs.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);

console.log('Dirichlet Analysis:');
console.log(`  Dimensions: ${cgp.dirichlet.alpha.length}`);
console.log(`  Concentration: ${concentration.toFixed(4)}`);
console.log(`  Entropy: ${entropy.toFixed(4)} bits`);
console.log(`  Max entropy: ${Math.log2(cgp.dirichlet.alpha.length).toFixed(4)} bits`);
console.log(`  Uniformity: ${(entropy / Math.log2(cgp.dirichlet.alpha.length) * 100).toFixed(2)}%`);
```

## Hyperbolic Embedding

Map agents to hyperbolic space based on hierarchy:

```typescript
// embed-hyperbolic.ts
interface HyperbolicPoint {
  agent_id: string;
  position: [number, number, number];
  distance_from_origin: number;
}

function embedAgents(attributions: Array<{ agent_id: string; contribution_weight: number }>): HyperbolicPoint[] {
  return attributions.map((attr, i) => {
    // Place higher-weight agents closer to origin (more central)
    const radius = 1 - attr.contribution_weight; // 0.9 for small, 0.5 for large
    const angle = (2 * Math.PI * i) / attributions.length;

    const position: [number, number, number] = [
      radius * Math.cos(angle) * 0.8,  // Stay within Poincare ball
      radius * Math.sin(angle) * 0.8,
      0.1 * (1 - attr.contribution_weight),  // Depth based on weight
    ];

    return {
      agent_id: attr.agent_id,
      position,
      distance_from_origin: Math.sqrt(position.reduce((s, x) => s + x * x, 0)),
    };
  });
}
```

## GEOMETRY BUS Publishing

Publish CGP to NATS:

```typescript
// publish-cgp.ts
import { connect, StringCodec } from 'nats';
import * as fs from 'fs';

async function publishCGP(cgpPath: string) {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();

  const cgp = JSON.parse(fs.readFileSync(cgpPath, 'utf-8'));

  // Publish to CGP ready subject
  nc.publish('tokenism.cgp.ready.v1', sc.encode(JSON.stringify({
    packet_id: cgp.packet_id,
    version: cgp.version,
    timestamp: new Date().toISOString(),
    payload: cgp,
  })));

  console.log(`Published CGP ${cgp.packet_id} to GEOMETRY BUS`);

  await nc.drain();
}

publishCGP(process.argv[2]);
```

### Subscribe to CGP events
```typescript
// subscribe-cgp.ts
import { connect, StringCodec } from 'nats';

async function subscribeCGP() {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();

  const sub = nc.subscribe('tokenism.cgp.ready.v1');

  console.log('Listening for CGP events...');

  for await (const msg of sub) {
    const data = JSON.parse(sc.decode(msg.data));
    console.log(`Received CGP: ${data.packet_id}`);

    // Validate received CGP
    // Process shape...
  }
}

subscribeCGP();
```

## Shape Comparison

Compare two CGP shapes:

```typescript
// compare-shapes.ts
interface CGP {
  dirichlet: { alpha: number[] };
  hyperbolic: { position: [number, number, number] };
}

function kl_divergence(p: number[], q: number[]): number {
  const pSum = p.reduce((a, b) => a + b, 0);
  const qSum = q.reduce((a, b) => a + b, 0);
  const pNorm = p.map(x => x / pSum);
  const qNorm = q.map(x => x / qSum);

  return pNorm.reduce((sum, pi, i) => {
    if (pi > 0 && qNorm[i] > 0) {
      return sum + pi * Math.log(pi / qNorm[i]);
    }
    return sum;
  }, 0);
}

function hyperbolic_distance(p1: number[], p2: number[]): number {
  // Poincare ball distance
  const diff = p1.map((x, i) => x - p2[i]);
  const diffNorm = Math.sqrt(diff.reduce((s, x) => s + x * x, 0));
  const p1Norm = Math.sqrt(p1.reduce((s, x) => s + x * x, 0));
  const p2Norm = Math.sqrt(p2.reduce((s, x) => s + x * x, 0));

  const numerator = 2 * diffNorm * diffNorm;
  const denominator = (1 - p1Norm * p1Norm) * (1 - p2Norm * p2Norm);

  return Math.acosh(1 + numerator / denominator);
}

function compareShapes(cgp1: CGP, cgp2: CGP) {
  const kl = kl_divergence(cgp1.dirichlet.alpha, cgp2.dirichlet.alpha);
  const hDist = hyperbolic_distance(cgp1.hyperbolic.position, cgp2.hyperbolic.position);

  console.log('Shape Comparison:');
  console.log(`  KL Divergence (Dirichlet): ${kl.toFixed(4)}`);
  console.log(`  Hyperbolic Distance: ${hDist.toFixed(4)}`);
  console.log(`  Similar: ${kl < 0.1 && hDist < 0.5 ? 'Yes' : 'No'}`);
}
```

## Tips

1. **Normalize weights**: Always ensure attribution weights sum to 1.0
2. **Curvature consistency**: Use -1 for standard hyperbolic space
3. **Merkle before publish**: Always compute Merkle root before publishing
4. **Batch validation**: Validate all documents before pipeline processing
5. **Version control**: Track CGP versions for compatibility
