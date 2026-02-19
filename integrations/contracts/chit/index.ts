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

// CHIT NATS Publisher - GEOMETRY BUS integration
export {
  CHITNATSPublisher,
  createCHITPublisher,
  SwarmPopulationPayload,
  AttributionRecordedPayload,
  CGPWeeklyPayload,
} from './chit-nats-publisher';

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
  cgpSchema: 'chit.cgp.v1.0',
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
  /** Credential rotation/redaction event */
  credentialRotated: 'tokenism.credential.rotated.v1',
};

/**
 * Utility to validate CGP document
 */
export function validateCGPDocument(cgp: _CGPDocument): { valid: boolean; errors: string[] } {
  const { CGPGenerator } = require('./cgp-generator');
  const generator = new CGPGenerator();
  return generator.validateCGP(cgp);
}

// ---------------------------------------------------------------------------
// Credential Management Types (CGP Archives)
// ---------------------------------------------------------------------------

/** Credential redaction metadata for CGP archives */
export interface CHITRedactionRecord {
  key: string;
  redacted_at: string;  // ISO 8601
  cgp_archive: string;  // relative path to CGP archive
  namespace: string;     // CGP namespace
  encoding: 'hex' | 'cleartext';
}

/** Credential rotation event for NATS */
export interface CredentialRotationEvent {
  keys: string[];
  namespace: string;
  timestamp: string;
  archive_path: string;
}

/** CGP credential archive point structure */
interface CGPArchivePoint {
  label: string;
  value: string;
  anchor: number[];
  encoding: string;
}

/**
 * Lightweight validator for CGP credential archives.
 * Verifies version, namespace, points structure, and encoding fields.
 */
export function validateCGPArchive(
  cgp: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof cgp.version !== 'string') {
    errors.push('Missing or invalid "version" field');
  } else if (!cgp.version.startsWith('chit.cgp.')) {
    errors.push(`Unexpected version prefix: ${cgp.version}`);
  }

  if (typeof cgp.namespace !== 'string' || !cgp.namespace) {
    errors.push('Missing or empty "namespace" field');
  }

  if (!Array.isArray(cgp.points)) {
    errors.push('"points" must be an array');
  } else {
    const points = cgp.points as CGPArchivePoint[];
    if (points.length === 0) {
      errors.push('"points" array is empty');
    }
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (typeof pt.label !== 'string' || !pt.label) {
        errors.push(`points[${i}]: missing or empty "label"`);
      }
      if (typeof pt.value !== 'string') {
        errors.push(`points[${i}]: missing "value"`);
      }
      if (!Array.isArray(pt.anchor) || pt.anchor.length !== 3) {
        errors.push(`points[${i}]: "anchor" must be a 3-element array`);
      }
      if (typeof pt.encoding !== 'string') {
        errors.push(`points[${i}]: missing "encoding" field`);
      } else if (pt.encoding !== 'hex' && pt.encoding !== 'cleartext') {
        errors.push(`points[${i}]: invalid encoding "${pt.encoding}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
