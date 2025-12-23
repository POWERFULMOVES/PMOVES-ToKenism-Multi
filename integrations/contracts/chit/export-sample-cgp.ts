#!/usr/bin/env npx ts-node
/**
 * Export Sample CGP - CHIT Phase 2
 *
 * Generates a sample CGP (CHIT Geometry Packet) from mock simulation data.
 * Use this for testing Discord publishing and CGP validation.
 *
 * Usage:
 *   npx ts-node --project tsconfig.run.json contracts/chit/export-sample-cgp.ts
 *   npx ts-node --project tsconfig.run.json contracts/chit/export-sample-cgp.ts --week=5
 *
 * @packageDocumentation
 */

import {
  createCHITSystem,
  CHIT_VERSION,
  CHIT_NATS_SUBJECTS,
  validateCGPDocument,
} from './index';
import type { WeeklySimulationData } from './cgp-generator';

/**
 * Generate sample simulation data for a given week
 */
function generateSampleSimulation(week: number): WeeklySimulationData {
  // Simulate improving economic indicators over time
  const baseGini = 0.45;
  const giniImprovement = 0.005 * week;
  const basePoverty = 0.20;
  const povertyImprovement = 0.008 * week;

  return {
    week,
    gini: Math.max(0.25, baseGini - giniImprovement),
    povertyRate: Math.max(0.05, basePoverty - povertyImprovement),
    totalWealth: 100000 + (week * 5000),
    totalSpending: 5000 + (week * 250),
    totalSavings: 1000 + (week * 100),
    participantCount: 50 + (week * 2),
  };
}

/**
 * Generate sample attribution records
 */
function generateSampleAttributions(
  system: ReturnType<typeof createCHITSystem>,
  week: number
): void {
  const addresses = [
    '0xMEMBER_ALPHA',
    '0xMEMBER_BETA',
    '0xMEMBER_GAMMA',
    '0xMEMBER_DELTA',
    '0xMEMBER_EPSILON',
  ];

  const actions = ['spending', 'staking', 'voting', 'group_contribution'] as const;
  const categories = ['groceries', 'utilities', 'healthcare', 'education'];

  // Generate varied attribution records
  addresses.forEach((address, idx) => {
    const baseAmount = 50 + (idx * 25);
    const action = actions[idx % actions.length];
    const category = categories[idx % categories.length];

    system.attribution.recordAction(
      address,
      action,
      baseAmount + Math.floor(Math.random() * 50),
      week,
      category
    );
  });
}

/**
 * Main export function
 */
function main(): void {
  // Parse command line args
  const weekArg = process.argv.find(arg => arg.startsWith('--week='));
  const week = weekArg ? parseInt(weekArg.split('=')[1], 10) : 1;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CHIT Sample CGP Export');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(`  Version Info:`);
  console.log(`    Module: ${CHIT_VERSION.module}`);
  console.log(`    CGP Schema: ${CHIT_VERSION.cgpSchema}`);
  console.log(`    Swarm Schema: ${CHIT_VERSION.swarmSchema}`);
  console.log();
  console.log(`  NATS Subjects:`);
  Object.entries(CHIT_NATS_SUBJECTS).forEach(([key, subject]) => {
    console.log(`    ${key}: ${subject}`);
  });
  console.log();
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  Generating CGP for Week ${week}...`);
  console.log('───────────────────────────────────────────────────────────────');

  // Create CHIT system with default config
  const system = createCHITSystem({
    dirichlet: { smoothingAlpha: 0.1 },
    hyperbolic: { curvature: -1 },
    merkle: { strategy: 'per_week', hashAlgorithm: 'sha256', signProofs: false },
    cgp: { namespace: 'pmoves.tokenism', includeProofs: true, includeHyperbolic: true },
    swarm: { optimizationTarget: 'gini_reduction' },
  });

  // Generate sample attributions
  generateSampleAttributions(system, week);

  // Generate simulation data
  const simulation = generateSampleSimulation(week);

  console.log();
  console.log(`  Simulation Metrics:`);
  console.log(`    Gini Coefficient: ${simulation.gini.toFixed(4)}`);
  console.log(`    Poverty Rate: ${(simulation.povertyRate * 100).toFixed(2)}%`);
  console.log(`    Total Wealth: $${simulation.totalWealth.toLocaleString()}`);
  console.log(`    Participants: ${simulation.participantCount}`);
  console.log();

  // Generate CGP document
  const cgp = system.generator.generateWeeklyCGP(
    simulation,
    system.attribution,
    system.encoder
  );

  // Generate swarm meta
  const swarmMeta = system.swarm.createSwarmMeta(simulation);

  // Validate CGP
  const validation = validateCGPDocument(cgp);

  console.log(`  Validation: ${validation.valid ? '✓ VALID' : '✗ INVALID'}`);
  if (!validation.valid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  console.log();
  console.log(`  CGP Summary:`);
  console.log(`    Spec: ${cgp.spec}`);
  console.log(`    Super Nodes: ${cgp.super_nodes.length}`);
  console.log(`    Created At: ${cgp.created_at}`);
  console.log();
  console.log(`  Swarm Meta:`);
  console.log(`    Pack ID: ${swarmMeta.pack_id}`);
  console.log(`    Status: ${swarmMeta.status}`);
  console.log(`    Best Fitness: ${swarmMeta.best_fitness?.toFixed(4) ?? 'N/A'}`);
  console.log();

  // Get attribution weights
  const weights = system.attribution.getDirichletWeights('groceries');
  if (weights.length > 0) {
    console.log(`  Attribution Weights (groceries):`);
    weights.forEach(w => {
      console.log(`    ${w.address}: ${(w.weight * 100).toFixed(2)}%`);
    });
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CGP Document (JSON):');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  console.log(JSON.stringify(cgp, null, 2));
  console.log();

  // Output compact version for NATS publishing
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  NATS Payload (tokenism.cgp.weekly.v1):');
  console.log('───────────────────────────────────────────────────────────────');
  const natsPayload = {
    week: simulation.week,
    gini: simulation.gini,
    poverty_rate: simulation.povertyRate,
    total_wealth: simulation.totalWealth,
    super_node_count: cgp.super_nodes.length,
    total_attributions: system.attribution.getWeekAttribution(week).length,
    cgp_spec: cgp.spec,
    ts: cgp.created_at,
  };
  console.log(JSON.stringify(natsPayload, null, 2));
  console.log();
}

// Run if executed directly
main();
