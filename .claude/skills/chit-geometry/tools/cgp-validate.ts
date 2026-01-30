#!/usr/bin/env npx ts-node
/**
 * CGP Document Validator
 *
 * Validates Contextual Geometry Packets against CHIT schema.
 * Part of the chit-geometry skill toolset.
 *
 * Usage:
 *   npx ts-node cgp-validate.ts --input packet.json
 *   npx ts-node cgp-validate.ts --input packet.json --schema cgp.v1.schema.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface DirichletWeights {
  alpha: number[];
  normalized?: boolean;
}

interface HyperbolicCoords {
  curvature: number;
  position: [number, number, number]; // Poincare ball coordinates
}

interface ShapeAttribution {
  agent_id: string;
  contribution_weight: number;
  shape_signature: string;
  timestamp: string;
}

interface CGPDocument {
  version: string;
  packet_id: string;
  created_at: string;
  dirichlet: DirichletWeights;
  hyperbolic: HyperbolicCoords;
  attributions: ShapeAttribution[];
  merkle_root?: string;
  metadata?: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    version: string;
    attributions: number;
    totalWeight: number;
    hasMerkle: boolean;
  };
}

const CGP_SCHEMA_REQUIREMENTS = {
  requiredFields: ['version', 'packet_id', 'created_at', 'dirichlet', 'hyperbolic', 'attributions'],
  versionPattern: /^chit\.cgp\.v\d+\.\d+$/,
  maxAttributions: 1000,
  minDirichletAlpha: 0.001,
  maxCurvature: 0, // Hyperbolic = negative curvature
};

function validateDirichlet(dirichlet: DirichletWeights): string[] {
  const errors: string[] = [];

  if (!dirichlet.alpha || !Array.isArray(dirichlet.alpha)) {
    errors.push('dirichlet.alpha must be an array');
    return errors;
  }

  if (dirichlet.alpha.length < 2) {
    errors.push('dirichlet.alpha must have at least 2 dimensions');
  }

  dirichlet.alpha.forEach((a, i) => {
    if (typeof a !== 'number' || isNaN(a)) {
      errors.push(`dirichlet.alpha[${i}] must be a number`);
    } else if (a < CGP_SCHEMA_REQUIREMENTS.minDirichletAlpha) {
      errors.push(`dirichlet.alpha[${i}] (${a}) is below minimum (${CGP_SCHEMA_REQUIREMENTS.minDirichletAlpha})`);
    }
  });

  return errors;
}

function validateHyperbolic(hyperbolic: HyperbolicCoords): string[] {
  const errors: string[] = [];

  if (typeof hyperbolic.curvature !== 'number') {
    errors.push('hyperbolic.curvature must be a number');
  } else if (hyperbolic.curvature > CGP_SCHEMA_REQUIREMENTS.maxCurvature) {
    errors.push(`hyperbolic.curvature (${hyperbolic.curvature}) must be <= 0 for hyperbolic space`);
  }

  if (!Array.isArray(hyperbolic.position) || hyperbolic.position.length !== 3) {
    errors.push('hyperbolic.position must be a 3D coordinate array');
  } else {
    // Check Poincare ball constraint: ||x|| < 1
    const norm = Math.sqrt(
      hyperbolic.position.reduce((sum, x) => sum + x * x, 0)
    );
    if (norm >= 1) {
      errors.push(`hyperbolic.position norm (${norm.toFixed(4)}) must be < 1 for Poincare ball`);
    }
  }

  return errors;
}

function validateAttributions(attributions: ShapeAttribution[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(attributions)) {
    errors.push('attributions must be an array');
    return { errors, warnings };
  }

  if (attributions.length === 0) {
    warnings.push('attributions array is empty');
  }

  if (attributions.length > CGP_SCHEMA_REQUIREMENTS.maxAttributions) {
    errors.push(`attributions count (${attributions.length}) exceeds maximum (${CGP_SCHEMA_REQUIREMENTS.maxAttributions})`);
  }

  let totalWeight = 0;
  const agentIds = new Set<string>();

  attributions.forEach((attr, i) => {
    if (!attr.agent_id) {
      errors.push(`attributions[${i}].agent_id is required`);
    } else if (agentIds.has(attr.agent_id)) {
      warnings.push(`Duplicate agent_id: ${attr.agent_id}`);
    } else {
      agentIds.add(attr.agent_id);
    }

    if (typeof attr.contribution_weight !== 'number' || attr.contribution_weight < 0) {
      errors.push(`attributions[${i}].contribution_weight must be a non-negative number`);
    } else {
      totalWeight += attr.contribution_weight;
    }

    if (!attr.shape_signature) {
      errors.push(`attributions[${i}].shape_signature is required`);
    }

    if (!attr.timestamp) {
      warnings.push(`attributions[${i}].timestamp is missing`);
    }
  });

  if (Math.abs(totalWeight - 1.0) > 0.001 && attributions.length > 0) {
    warnings.push(`Total attribution weight (${totalWeight.toFixed(4)}) should sum to 1.0`);
  }

  return { errors, warnings };
}

function validateCGP(doc: CGPDocument): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  CGP_SCHEMA_REQUIREMENTS.requiredFields.forEach((field) => {
    if (!(field in doc)) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate version format
  if (doc.version && !CGP_SCHEMA_REQUIREMENTS.versionPattern.test(doc.version)) {
    errors.push(`Invalid version format: ${doc.version} (expected: chit.cgp.vX.Y)`);
  }

  // Validate packet_id
  if (doc.packet_id && doc.packet_id.length < 8) {
    warnings.push('packet_id is shorter than recommended (8+ chars)');
  }

  // Validate created_at
  if (doc.created_at) {
    const date = new Date(doc.created_at);
    if (isNaN(date.getTime())) {
      errors.push('created_at is not a valid ISO date');
    }
  }

  // Validate Dirichlet weights
  if (doc.dirichlet) {
    errors.push(...validateDirichlet(doc.dirichlet));
  }

  // Validate Hyperbolic coordinates
  if (doc.hyperbolic) {
    errors.push(...validateHyperbolic(doc.hyperbolic));
  }

  // Validate Attributions
  if (doc.attributions) {
    const attrResult = validateAttributions(doc.attributions);
    errors.push(...attrResult.errors);
    warnings.push(...attrResult.warnings);
  }

  // Check Merkle root if present
  if (doc.merkle_root && !/^[a-fA-F0-9]{64}$/.test(doc.merkle_root)) {
    warnings.push('merkle_root does not appear to be a valid SHA-256 hash');
  }

  const totalWeight = doc.attributions?.reduce((sum, a) => sum + (a.contribution_weight || 0), 0) || 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      version: doc.version || 'unknown',
      attributions: doc.attributions?.length || 0,
      totalWeight,
      hasMerkle: !!doc.merkle_root,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let schemaPath = '';
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputPath = args[++i];
        break;
      case '--schema':
        schemaPath = args[++i];
        break;
      case '--json':
        jsonOutput = true;
        break;
    }
  }

  if (!inputPath) {
    console.error('[cgp-validate] Usage: cgp-validate.ts --input <file> [--json]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[cgp-validate] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf-8');
  const doc = JSON.parse(content) as CGPDocument;
  const result = validateCGP(doc);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n[cgp-validate] Validation Result');
    console.log('=================================');
    console.log(`Status: ${result.valid ? 'VALID' : 'INVALID'}`);
    console.log(`Version: ${result.stats.version}`);
    console.log(`Attributions: ${result.stats.attributions}`);
    console.log(`Total Weight: ${result.stats.totalWeight.toFixed(4)}`);
    console.log(`Has Merkle: ${result.stats.hasMerkle ? 'Yes' : 'No'}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((e) => console.log(`  - ${e}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((w) => console.log(`  - ${w}`));
    }
  }

  process.exit(result.valid ? 0 : 1);
}

main();

export { validateCGP, CGPDocument, ValidationResult };
