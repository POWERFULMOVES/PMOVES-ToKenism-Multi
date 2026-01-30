#!/usr/bin/env npx ts-node
/**
 * Merkle Proof Verification Tool
 *
 * Verifies Merkle proofs for CHIT attribution chains.
 * Part of the chit-geometry skill toolset.
 *
 * Usage:
 *   npx ts-node merkle-verify.ts --root <hash> --proof <prooffile.json>
 *   npx ts-node merkle-verify.ts --cgp <cgpfile.json> --leaf <leafdata>
 */

import * as fs from 'fs';
import * as crypto from 'crypto';

interface MerkleProof {
  leaf: string;
  leaf_index: number;
  proof: Array<{
    hash: string;
    position: 'left' | 'right';
  }>;
  root: string;
}

interface ShapeAttribution {
  agent_id: string;
  contribution_weight: number;
  shape_signature: string;
  timestamp: string;
}

interface CGPDocument {
  packet_id: string;
  merkle_root?: string;
  attributions: ShapeAttribution[];
}

interface VerificationResult {
  valid: boolean;
  computedRoot: string;
  expectedRoot: string;
  leafHash: string;
  proofLength: number;
  error?: string;
}

// SHA-256 hash function
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Combine two hashes in sorted order (for consistent tree construction)
function combineHashes(left: string, right: string): string {
  return sha256(left + right);
}

// Hash an attribution for Merkle leaf
function hashAttribution(attr: ShapeAttribution): string {
  const canonical = JSON.stringify({
    agent_id: attr.agent_id,
    contribution_weight: attr.contribution_weight,
    shape_signature: attr.shape_signature,
    timestamp: attr.timestamp,
  });
  return sha256(canonical);
}

// Build Merkle tree from attributions
function buildMerkleTree(attributions: ShapeAttribution[]): {
  root: string;
  leaves: string[];
  tree: string[][];
} {
  if (attributions.length === 0) {
    return { root: sha256(''), leaves: [], tree: [[]] };
  }

  // Hash all leaves
  let currentLevel = attributions.map(hashAttribution);
  const leaves = [...currentLevel];
  const tree: string[][] = [currentLevel];

  // Build tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // Duplicate if odd
      nextLevel.push(combineHashes(left, right));
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0] || sha256(''),
    leaves,
    tree,
  };
}

// Generate Merkle proof for a specific leaf
function generateProof(
  tree: string[][],
  leafIndex: number
): MerkleProof['proof'] {
  const proof: MerkleProof['proof'] = [];
  let index = leafIndex;

  for (let level = 0; level < tree.length - 1; level++) {
    const currentLevel = tree[level];
    const isLeft = index % 2 === 0;
    const siblingIndex = isLeft ? index + 1 : index - 1;

    if (siblingIndex < currentLevel.length) {
      proof.push({
        hash: currentLevel[siblingIndex],
        position: isLeft ? 'right' : 'left',
      });
    } else {
      // Sibling is duplicate of current node (odd number of nodes)
      proof.push({
        hash: currentLevel[index],
        position: 'right',
      });
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

// Verify a Merkle proof
function verifyProof(proof: MerkleProof): VerificationResult {
  let currentHash = proof.leaf;

  try {
    for (const step of proof.proof) {
      if (step.position === 'left') {
        currentHash = combineHashes(step.hash, currentHash);
      } else {
        currentHash = combineHashes(currentHash, step.hash);
      }
    }

    return {
      valid: currentHash === proof.root,
      computedRoot: currentHash,
      expectedRoot: proof.root,
      leafHash: proof.leaf,
      proofLength: proof.proof.length,
    };
  } catch (error) {
    return {
      valid: false,
      computedRoot: '',
      expectedRoot: proof.root,
      leafHash: proof.leaf,
      proofLength: proof.proof.length,
      error: String(error),
    };
  }
}

// Verify CGP document's Merkle root
function verifyCGPMerkle(doc: CGPDocument): {
  valid: boolean;
  computedRoot: string;
  documentRoot: string;
  leafCount: number;
} {
  const { root, leaves } = buildMerkleTree(doc.attributions);

  return {
    valid: root === doc.merkle_root,
    computedRoot: root,
    documentRoot: doc.merkle_root || 'NOT_PRESENT',
    leafCount: leaves.length,
  };
}

async function main() {
  const args = process.argv.slice(2);
  let rootHash = '';
  let proofPath = '';
  let cgpPath = '';
  let leafData = '';
  let generateMode = false;
  let leafIndex = 0;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--root':
        rootHash = args[++i];
        break;
      case '--proof':
        proofPath = args[++i];
        break;
      case '--cgp':
        cgpPath = args[++i];
        break;
      case '--leaf':
        leafData = args[++i];
        break;
      case '--generate':
        generateMode = true;
        break;
      case '--index':
        leafIndex = parseInt(args[++i], 10);
        break;
      case '--json':
        jsonOutput = true;
        break;
    }
  }

  // Mode 1: Verify CGP document's merkle root
  if (cgpPath && !generateMode) {
    if (!fs.existsSync(cgpPath)) {
      console.error(`[merkle] CGP file not found: ${cgpPath}`);
      process.exit(1);
    }

    const doc = JSON.parse(fs.readFileSync(cgpPath, 'utf-8')) as CGPDocument;
    const result = verifyCGPMerkle(doc);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n[merkle] CGP Merkle Verification');
      console.log('=================================');
      console.log(`Valid: ${result.valid ? 'YES' : 'NO'}`);
      console.log(`Computed Root: ${result.computedRoot}`);
      console.log(`Document Root: ${result.documentRoot}`);
      console.log(`Leaf Count: ${result.leafCount}`);
    }

    process.exit(result.valid ? 0 : 1);
  }

  // Mode 2: Generate proof from CGP
  if (cgpPath && generateMode) {
    if (!fs.existsSync(cgpPath)) {
      console.error(`[merkle] CGP file not found: ${cgpPath}`);
      process.exit(1);
    }

    const doc = JSON.parse(fs.readFileSync(cgpPath, 'utf-8')) as CGPDocument;
    const { root, leaves, tree } = buildMerkleTree(doc.attributions);

    if (leafIndex >= leaves.length) {
      console.error(`[merkle] Leaf index ${leafIndex} out of range (0-${leaves.length - 1})`);
      process.exit(1);
    }

    const proof: MerkleProof = {
      leaf: leaves[leafIndex],
      leaf_index: leafIndex,
      proof: generateProof(tree, leafIndex),
      root,
    };

    console.log(JSON.stringify(proof, null, 2));
    process.exit(0);
  }

  // Mode 3: Verify standalone proof
  if (proofPath) {
    if (!fs.existsSync(proofPath)) {
      console.error(`[merkle] Proof file not found: ${proofPath}`);
      process.exit(1);
    }

    const proof = JSON.parse(fs.readFileSync(proofPath, 'utf-8')) as MerkleProof;
    const result = verifyProof(proof);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n[merkle] Proof Verification');
      console.log('===========================');
      console.log(`Valid: ${result.valid ? 'YES' : 'NO'}`);
      console.log(`Leaf Hash: ${result.leafHash}`);
      console.log(`Computed Root: ${result.computedRoot}`);
      console.log(`Expected Root: ${result.expectedRoot}`);
      console.log(`Proof Length: ${result.proofLength} nodes`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
    }

    process.exit(result.valid ? 0 : 1);
  }

  // Show usage
  console.log('[merkle] Usage:');
  console.log('  Verify CGP:     merkle-verify.ts --cgp <file.json>');
  console.log('  Generate proof: merkle-verify.ts --cgp <file.json> --generate --index <n>');
  console.log('  Verify proof:   merkle-verify.ts --proof <proof.json>');
  console.log('\nOptions:');
  console.log('  --json    Output results as JSON');
  process.exit(1);
}

main();

export {
  verifyProof,
  verifyCGPMerkle,
  buildMerkleTree,
  generateProof,
  hashAttribution,
  MerkleProof,
};
