/**
 * CHIT (Context-Hybrid Information Token) Integration Module
 *
 * Provides Shape Attribution capabilities for ToKenism economic simulations:
 * - Dirichlet-weighted contribution attribution
 * - Hyperbolic (Poincaré disk) encoding for hierarchical data
 * - Merkle tree proofs for verifiable attribution
 * - CGP (CHIT Geometry Packet) v2 document generation
 * - Swarm optimization integration
 *
 * @packageDocumentation
 * @module chit
 */

// Import types for local use in interfaces
import type { DirichletWeights as _DirichletWeights } from './dirichlet-weights';
import type { HyperbolicEncoder as _HyperbolicEncoder } from './hyperbolic-encoder';
import type { ShapeAttribution as _ShapeAttribution, MerkleConfig as _MerkleConfig } from './shape-attribution';
import type { CGPGenerator as _CGPGenerator, CGPGeneratorConfig as _CGPGeneratorConfig, CGPDocument as _CGPDocument } from './cgp-generator';
import type { SwarmAttribution as _SwarmAttribution, SwarmAttributionConfig as _SwarmAttributionConfig } from './swarm-attribution';
import type { ZetaInspiredFilter as _ZetaInspiredFilter, ZetaFilterConfig as _ZetaFilterConfig } from './zeta-filter';

// Dirichlet Weights - Probabilistic attribution
export {
  DirichletWeights,
  DirichletConfig,
  ContributionWeight,
  CategoryContributions,
  AttributionExport,
} from './dirichlet-weights';

// Hyperbolic Encoder - Poincaré disk geometry
export {
  HyperbolicEncoder,
  EncoderConfig,
  PoincarePoint,
  HierarchyNode,
  CGPSuperNode,
  CGPConstellation,
  CGPPoint,
} from './hyperbolic-encoder';

// Shape Attribution - Merkle proofs and record tracking
export {
  ShapeAttribution,
  ShapeAttributionConfig,
  MerkleConfig,
  MerkleTreeStrategy,
  AttributionRecord,
  AttributionAction,
  AttributionProof,
} from './shape-attribution';

// CGP Generator - CHIT Geometry Packet generation
export {
  CGPGenerator,
  CGPGeneratorConfig,
  CGPDocument,
  CGPSuperNodeExtended,
  CGPAttribution,
  CGPContributor,
  CGPMerkleProof,
  CGPHyperbolicEncoding,
  CGPPoincarePoint,
  CGPSignature,
  WeeklySimulationData,
  TransactionRecord,
  ToKenismModality,
  ContractType,
} from './cgp-generator';

// Swarm Attribution - swarm.meta.v1 integration
export {
  SwarmAttribution,
  SwarmAttributionConfig,
  SwarmMeta,
  ToKenismMetrics,
  OptimizationTarget,
  FitnessWeights,
  Population,
  GenerationRecord,
} from './swarm-attribution';

// Zeta-Inspired Filter - Spectral analysis using Riemann zeta zeros
export {
  ZetaInspiredFilter,
  ZetaFilterConfig,
  SpectralAnalysis,
} from './zeta-filter';

/**
 * Create a fully configured CHIT attribution system
 *
 * @example
 * ```typescript
 * const chit = createCHITSystem({
 *   dirichlet: { smoothingAlpha: 0.1 },
 *   hyperbolic: { curvature: -1 },
 *   merkle: { strategy: 'per_week' },
 *   cgp: { namespace: 'pmoves.tokenism' },
 *   swarm: { optimizationTarget: 'gini_reduction' }
 * });
 *
 * // Record attribution
 * const chitId = chit.attribution.recordAction({
 *   address: '0xABC...',
 *   action: 'spending',
 *   amount: 50,
 *   week: 1,
 *   category: 'groceries'
 * });
 *
 * // Generate CGP document
 * const cgp = chit.generator.generateWeeklyCGP(weekData, chit.attribution);
 *
 * // Get swarm meta
 * const meta = chit.swarm.createSwarmMeta(weekData);
 * ```
 */
export interface CHITSystem {
  /** Dirichlet weights calculator */
  dirichlet: _DirichletWeights;
  /** Hyperbolic space encoder */
  encoder: _HyperbolicEncoder;
  /** Shape attribution tracker */
  attribution: _ShapeAttribution;
  /** CGP document generator */
  generator: _CGPGenerator;
  /** Swarm optimization tracker */
  swarm: _SwarmAttribution;
  /** Zeta-inspired spectral filter */
  zeta: _ZetaInspiredFilter;
}

/**
 * Configuration for CHIT system creation
 */
export interface CHITSystemConfig {
  dirichlet?: Partial<import('./dirichlet-weights').DirichletConfig>;
  hyperbolic?: Partial<import('./hyperbolic-encoder').EncoderConfig>;
  merkle?: Partial<_MerkleConfig>;
  cgp?: Partial<_CGPGeneratorConfig>;
  swarm?: Partial<_SwarmAttributionConfig>;
  zeta?: Partial<_ZetaFilterConfig>;
}

/**
 * Factory function to create a complete CHIT attribution system
 */
export function createCHITSystem(config: CHITSystemConfig = {}): CHITSystem {
  const { DirichletWeights } = require('./dirichlet-weights');
  const { HyperbolicEncoder } = require('./hyperbolic-encoder');
  const { ShapeAttribution } = require('./shape-attribution');
  const { CGPGenerator } = require('./cgp-generator');
  const { SwarmAttribution } = require('./swarm-attribution');
  const { ZetaInspiredFilter } = require('./zeta-filter');

  const dirichlet = new DirichletWeights(config.dirichlet);
  const encoder = new HyperbolicEncoder(config.hyperbolic);

  // Build attribution config, only including defined properties to preserve defaults
  const attributionConfig: Record<string, unknown> = {};
  if (config.dirichlet) attributionConfig.dirichlet = config.dirichlet;
  if (config.hyperbolic) attributionConfig.encoder = config.hyperbolic;
  if (config.merkle) attributionConfig.merkle = config.merkle;

  const attribution = new ShapeAttribution(attributionConfig);
  const generator = new CGPGenerator(config.cgp);
  const swarm = new SwarmAttribution(config.swarm);
  const zeta = new ZetaInspiredFilter(config.zeta);

  return {
    dirichlet,
    encoder,
    attribution,
    generator,
    swarm,
    zeta,
  };
}

/**
 * Version information for the CHIT module
 */
export const CHIT_VERSION = {
  module: '1.0.0',
  cgpSchema: 'chit.cgp.v0.2',
  swarmSchema: 'swarm.meta.v1',
};

/**
 * Default NATS subjects for CHIT events
 */
export const CHIT_NATS_SUBJECTS = {
  /** Attribution recorded event */
  attributionRecorded: 'tokenism.attribution.recorded.v1',
  /** Weekly CGP export event */
  cgpWeekly: 'tokenism.cgp.weekly.v1',
  /** CGP ready for consumption */
  cgpReady: 'tokenism.cgp.ready.v1',
  /** Direct geometry bus event */
  geometryEvent: 'tokenism.geometry.event.v1',
  /** Swarm population update */
  swarmPopulation: 'tokenism.swarm.population.v1',
};

/**
 * Utility to validate CGP document
 */
export function validateCGPDocument(cgp: _CGPDocument): { valid: boolean; errors: string[] } {
  const { CGPGenerator } = require('./cgp-generator');
  const generator = new CGPGenerator();
  return generator.validateCGP(cgp);
}
