/**
 * CGP Generator
 *
 * Generates CHIT Geometry Packets (CGP) v1.0 documents from ToKenism
 * economic simulation data with full attribution tracking.
 *
 * Key capabilities:
 * - Creates super_nodes for each contract type
 * - Embeds Dirichlet attribution weights
 * - Includes hyperbolic encoding metadata
 * - Generates valid CGP v0.2 compliant documents
 *
 * @see cgp.v2.schema.json for schema definition
 * @see shape-attribution.ts for attribution tracking
 */

import { ShapeAttribution, AttributionRecord } from './shape-attribution';
import { HyperbolicEncoder, PoincarePoint, CGPSuperNode, CGPConstellation, CGPPoint } from './hyperbolic-encoder';
import { ContributionWeight } from './dirichlet-weights';

/**
 * CGP Document structure following v0.2 schema
 */
export interface CGPDocument {
  spec: 'chit.cgp.v0.1' | 'chit.cgp.v0.2' | 'chit.cgp.v1.0';
  summary: string;
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  attribution?: CGPAttribution;
  hyperbolic?: CGPHyperbolicEncoding;
  super_nodes: CGPSuperNodeExtended[];
  sig?: CGPSignature | string | null;
  /** v1.0: NATS publishing metadata */
  nats?: {
    subject?: string;
    timestamp?: string;
    publisher_id?: string;
    stream?: string;
  };
}

/**
 * Extended super_node with attribution
 */
export interface CGPSuperNodeExtended extends CGPSuperNode {
  attribution?: CGPAttribution;
  hyperbolic?: CGPHyperbolicEncoding;
}

/**
 * Attribution structure for CGP
 */
export interface CGPAttribution {
  dirichlet_alpha: number[];
  total_alpha?: number;
  contributors: CGPContributor[];
  merkle_root?: string;
  merkle_strategy?: 'per_week' | 'rolling' | 'per_contract';
  week?: number;
  decay_applied?: boolean;
  timestamp: string;
}

/**
 * Contributor record for CGP
 */
export interface CGPContributor {
  address: string;
  weight: number;
  raw_contribution: number;
  alpha_component?: number;
  action_type?: string;
  category?: string;
  proof?: CGPMerkleProof;
}

/**
 * Merkle proof structure
 */
export interface CGPMerkleProof {
  leaf_hash: string;
  path: string[];
  path_indices?: number[];
  root?: string;
  signature?: string;
}

/**
 * Hyperbolic encoding metadata
 */
export interface CGPHyperbolicEncoding {
  space: 'poincare_disk' | 'lorentz' | 'klein' | 'hyperboloid';
  curvature: number;
  base_radius?: number;
  max_radius?: number;
  points?: CGPPoincarePoint[];
  hierarchy_depth?: number;
}

/**
 * Poincare point in CGP format
 */
export interface CGPPoincarePoint {
  id?: string;
  x: number;
  y: number;
  r?: number;
  theta?: number;
  label?: string;
  depth?: number;
  parent_id?: string;
}

/**
 * CGP Signature structure
 */
export interface CGPSignature {
  alg: string;
  kid?: string;
  ts?: number | string;
  hmac: string;
  meta?: Record<string, unknown>;
}

/**
 * Weekly simulation data interface
 */
export interface WeeklySimulationData {
  week: number;
  populationId?: string;
  gini: number;
  povertyRate: number;
  totalWealth: number;
  totalSpending: number;
  totalSavings: number;
  participantCount: number;
  transactions?: TransactionRecord[];
}

/**
 * Transaction record for CGP points
 */
export interface TransactionRecord {
  id: string;
  address: string;
  action: string;
  amount: number;
  category: string;
  week: number;
  timestamp?: string;
}

/**
 * Generator configuration
 */
export interface CGPGeneratorConfig {
  /** Namespace for generated CGPs */
  namespace: string;
  /** Include proofs in output */
  includeProofs: boolean;
  /** Include hyperbolic encoding */
  includeHyperbolic: boolean;
  /** Sign generated documents */
  signDocuments: boolean;
  /** Signing key (if signDocuments is true) */
  signingKey?: string;
}

/**
 * ToKenism modality types for economic events
 */
export type ToKenismModality =
  | 'economic_transaction'
  | 'token_distribution'
  | 'group_savings'
  | 'staking_position'
  | 'governance_vote'
  | 'loyalty_event'
  | 'reward_claim';

/**
 * Map action types to modalities
 */
const ACTION_TO_MODALITY: Record<string, ToKenismModality> = {
  token_received: 'token_distribution',
  spending: 'economic_transaction',
  group_contribution: 'group_savings',
  staking: 'staking_position',
  voting: 'governance_vote',
  loyalty_earned: 'loyalty_event',
  reward_claimed: 'reward_claim',
};

/**
 * Contract type identifiers
 */
export type ContractType =
  | 'grotoken'
  | 'foodusd'
  | 'grouppurchase'
  | 'grovault'
  | 'coopgovernor'
  | 'rewardspool'
  | 'loyaltypoints';

/**
 * CGP Generator class
 *
 * Generates valid CGP v0.2 documents from ToKenism economic simulation
 * data with attribution tracking.
 *
 * @example
 * ```typescript
 * const generator = new CGPGenerator({
 *   namespace: 'pmoves.tokenism',
 *   includeProofs: true,
 *   includeHyperbolic: true,
 *   signDocuments: false
 * });
 *
 * const cgp = generator.generateWeeklyCGP(
 *   weekData,
 *   shapeAttribution,
 *   hyperbolicEncoder
 * );
 * ```
 */
export class CGPGenerator {
  private config: CGPGeneratorConfig;

  constructor(config: Partial<CGPGeneratorConfig> = {}) {
    this.config = {
      namespace: 'pmoves.tokenism',
      includeProofs: true,
      includeHyperbolic: true,
      signDocuments: false,
      ...config,
    };
  }

  /**
   * Generate a CGP document for a single week's simulation data
   */
  generateWeeklyCGP(
    weekData: WeeklySimulationData,
    attribution: ShapeAttribution,
    encoder?: HyperbolicEncoder
  ): CGPDocument {
    const now = new Date().toISOString();
    const weekAttribution = attribution.getWeekAttribution(weekData.week);

    const cgp: CGPDocument = {
      spec: 'chit.cgp.v1.0',
      summary: `ToKenism Economic Simulation - Week ${weekData.week}`,
      meta: {
        namespace: this.config.namespace,
        simulation_week: weekData.week,
        population_id: weekData.populationId,
        metrics: {
          gini: weekData.gini,
          poverty_rate: weekData.povertyRate,
          total_wealth: weekData.totalWealth,
          total_spending: weekData.totalSpending,
          total_savings: weekData.totalSavings,
          participant_count: weekData.participantCount,
        },
      },
      created_at: now,
      super_nodes: [],
    };

    // Add top-level attribution
    cgp.attribution = this.createAttribution(
      attribution.getExpectedAttribution(),
      attribution.getRecords().filter(r => r.week === weekData.week),
      weekData.week
    );

    // Add hyperbolic encoding if enabled
    if (this.config.includeHyperbolic && encoder) {
      cgp.hyperbolic = this.createHyperbolicEncoding(
        encoder,
        attribution.getExpectedAttribution()
      );
    }

    // Create super_nodes for each contract type
    cgp.super_nodes = this.createContractSuperNodes(
      weekData,
      weekAttribution,
      attribution,
      encoder
    );

    return cgp;
  }

  /**
   * Generate a CGP document aggregating multiple weeks
   */
  generateSimulationCGP(
    weeks: WeeklySimulationData[],
    attribution: ShapeAttribution,
    encoder?: HyperbolicEncoder
  ): CGPDocument {
    const now = new Date().toISOString();

    if (weeks.length === 0) {
      throw new Error('Cannot generate CGP from empty week data');
    }

    const firstWeek = weeks[0].week;
    const lastWeek = weeks[weeks.length - 1].week;

    const cgp: CGPDocument = {
      spec: 'chit.cgp.v1.0',
      summary: `ToKenism Economic Simulation - Weeks ${firstWeek} to ${lastWeek}`,
      meta: {
        namespace: this.config.namespace,
        week_range: [firstWeek, lastWeek],
        total_weeks: weeks.length,
        aggregate_metrics: this.computeAggregateMetrics(weeks),
      },
      created_at: now,
      super_nodes: [],
    };

    // Aggregate attribution across all weeks
    cgp.attribution = this.createAttribution(
      attribution.getExpectedAttribution(),
      attribution.getRecords(),
      lastWeek
    );

    // Add hyperbolic encoding
    if (this.config.includeHyperbolic && encoder) {
      cgp.hyperbolic = this.createHyperbolicEncoding(
        encoder,
        attribution.getExpectedAttribution()
      );
    }

    // Create super_nodes - one per week
    for (const weekData of weeks) {
      const weekNode = this.createWeekSuperNode(weekData, attribution, encoder);
      cgp.super_nodes.push(weekNode);
    }

    return cgp;
  }

  /**
   * Create attribution structure from weights and records
   */
  private createAttribution(
    weights: ContributionWeight[],
    records: AttributionRecord[],
    week: number
  ): CGPAttribution {
    const alphaValues = weights.map(w => w.alphaComponent);
    const totalAlpha = alphaValues.reduce((sum, a) => sum + a, 0);

    return {
      dirichlet_alpha: alphaValues,
      total_alpha: totalAlpha,
      contributors: weights.map(w => this.weightToContributor(w, records)),
      merkle_root: records.length > 0 ? records[0].proof.merkleRoot : undefined,
      week,
      decay_applied: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Convert weight to CGP contributor
   */
  private weightToContributor(
    weight: ContributionWeight,
    records: AttributionRecord[]
  ): CGPContributor {
    const contributor: CGPContributor = {
      address: weight.address,
      weight: weight.weight,
      raw_contribution: weight.rawContribution,
      alpha_component: weight.alphaComponent,
      category: weight.category,
    };

    // Find matching record for proof
    if (this.config.includeProofs) {
      const record = records.find(r => r.address === weight.address);
      if (record) {
        contributor.action_type = record.action;
        contributor.proof = {
          leaf_hash: record.proof.leafHash,
          path: record.proof.path,
          root: record.proof.merkleRoot,
        };
      }
    }

    return contributor;
  }

  /**
   * Create hyperbolic encoding metadata
   */
  private createHyperbolicEncoding(
    encoder: HyperbolicEncoder,
    weights: ContributionWeight[] = []
  ): CGPHyperbolicEncoding {
    const config = encoder.getConfig();
    return {
      space: 'poincare_disk',
      curvature: config.curvature,
      base_radius: config.baseRadius,
      max_radius: config.maxRadius,
      points: this.encodeContributionWeights(weights, encoder),
    };
  }

  /**
   * Create super_nodes for each contract type
   */
  private createContractSuperNodes(
    weekData: WeeklySimulationData,
    weekAttribution: AttributionRecord[],
    attribution: ShapeAttribution,
    _encoder?: HyperbolicEncoder
  ): CGPSuperNodeExtended[] {
    const contractTypes: ContractType[] = [
      'grotoken',
      'foodusd',
      'grouppurchase',
      'grovault',
      'coopgovernor',
      'rewardspool',
      'loyaltypoints',
    ];

    const superNodes: CGPSuperNodeExtended[] = [];
    const anglePerContract = (2 * Math.PI) / contractTypes.length;

    for (let i = 0; i < contractTypes.length; i++) {
      const contractType = contractTypes[i];
      const contractRecords = weekAttribution.filter(r =>
        this.recordMatchesContract(r, contractType)
      );

      // Calculate position in Poincare disk
      const angle = i * anglePerContract;
      const radius = 0.4; // First ring for contract types
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      const superNode: CGPSuperNodeExtended = {
        id: `${contractType}-week-${weekData.week}`,
        label: this.getContractLabel(contractType),
        x,
        y,
        r: radius,
        constellations: this.createContractConstellations(
          contractType,
          contractRecords,
          weekData.week,
          _encoder
        ),
        meta: {
          contract_type: contractType,
          week: weekData.week,
          record_count: contractRecords.length,
        },
      };

      // Add contract-specific attribution
      if (contractRecords.length > 0) {
        const contractWeights = attribution.getExpectedAttribution()
          .filter(w => this.weightMatchesContract(w, contractType));
        if (contractWeights.length > 0) {
          superNode.attribution = this.createAttribution(
            contractWeights,
            contractRecords,
            weekData.week
          );
        }
      }

      superNodes.push(superNode);
    }

    return superNodes;
  }

  /**
   * Create week super_node for aggregate view
   */
  private createWeekSuperNode(
    weekData: WeeklySimulationData,
    attribution: ShapeAttribution,
    _encoder?: HyperbolicEncoder
  ): CGPSuperNodeExtended {
    const weekRecords = attribution.getWeekAttribution(weekData.week);

    return {
      id: `week-${weekData.week}`,
      label: `Week ${weekData.week}`,
      x: 0,
      y: 0,
      r: 0,
      constellations: [
        {
          id: `summary-week-${weekData.week}`,
          summary: `Economic summary for week ${weekData.week}`,
          anchor: [weekData.gini, weekData.povertyRate, weekData.totalWealth / 1000000],
          points: this.createSummaryPoints(weekData, weekRecords, _encoder),
        },
      ],
      meta: {
        week: weekData.week,
        gini: weekData.gini,
        poverty_rate: weekData.povertyRate,
        total_wealth: weekData.totalWealth,
      },
    };
  }

  /**
   * Create constellations for a contract type
   */
  private createContractConstellations(
    contractType: ContractType,
    records: AttributionRecord[],
    week: number,
    encoder?: HyperbolicEncoder
  ): CGPConstellation[] {
    if (records.length === 0) {
      return [{
        id: `${contractType}-${week}-empty`,
        summary: `No activity for ${contractType} in week ${week}`,
        anchor: [0, 0, 0],
        points: [],
      }];
    }

    // Group records by action type
    const byAction = new Map<string, AttributionRecord[]>();
    for (const record of records) {
      const key = record.action;
      if (!byAction.has(key)) {
        byAction.set(key, []);
      }
      byAction.get(key)!.push(record);
    }

    const constellations: CGPConstellation[] = [];
    const pointLookup = this.createRecordPointLookup(records, encoder);

    for (const [action, actionRecords] of byAction) {
      const totalAmount = actionRecords.reduce((sum, r) => sum + r.amount, 0);
      const avgAmount = totalAmount / actionRecords.length;

      constellations.push({
        id: `${contractType}-${action}-${week}`,
        summary: `${action} activity for ${contractType}`,
        anchor: [
          avgAmount / 1000, // Normalized average
          actionRecords.length / 100, // Normalized count
          totalAmount / 10000, // Normalized total
        ],
        points: actionRecords.map(r => this.recordToPoint(r, pointLookup)),
      });
    }

    return constellations;
  }

  /**
   * Create summary points for aggregate view
   */
  private createSummaryPoints(
    weekData: WeeklySimulationData,
    records: AttributionRecord[],
    encoder?: HyperbolicEncoder
  ): CGPPoint[] {
    const points: CGPPoint[] = [];
    const pointLookup = this.createRecordPointLookup(records, encoder);

    // Add metric points
    points.push({
      id: `gini-${weekData.week}`,
      x: 0.1,
      y: 0.1,
      text: `Gini: ${weekData.gini.toFixed(4)}`,
      proj: weekData.gini,
      conf: 1.0,
      modality: 'economic_transaction',
    });

    points.push({
      id: `poverty-${weekData.week}`,
      x: 0.2,
      y: 0.1,
      text: `Poverty Rate: ${(weekData.povertyRate * 100).toFixed(1)}%`,
      proj: weekData.povertyRate,
      conf: 1.0,
      modality: 'economic_transaction',
    });

    // Add top contributor points (limit to 10)
    const sortedRecords = [...records].sort((a, b) => b.amount - a.amount);
    for (let i = 0; i < Math.min(10, sortedRecords.length); i++) {
      points.push(this.recordToPoint(sortedRecords[i], pointLookup));
    }

    return points;
  }

  /**
   * Convert attribution record to CGP point
   */
  private recordToPoint(
    record: AttributionRecord,
    pointLookup?: Map<string, PoincarePoint>
  ): CGPPoint {
    const modality = ACTION_TO_MODALITY[record.action] || 'economic_transaction';
    const point =
      pointLookup?.get(this.recordPointKey(record)) ??
      this.createDeterministicRecordPoint(record);

    return {
      id: record.chitId,
      x: point.x,
      y: point.y,
      text: `${record.address.substring(0, 8)}...: ${record.action}`,
      proj: point.radius,
      conf: Math.max(0.1, Math.min(0.99, 1 - point.radius * 0.5)),
      modality,
    };
  }

  /**
   * Encode contribution weights into top-level CGP hyperbolic points.
   */
  private encodeContributionWeights(
    weights: ContributionWeight[],
    encoder: HyperbolicEncoder
  ): CGPPoincarePoint[] {
    if (weights.length === 0) {
      return [];
    }

    const participants = new Map<string, { value: number; category: string }>();
    for (const weight of weights) {
      participants.set(
        `${weight.address}:${weight.category}`,
        { value: weight.weight, category: weight.category }
      );
    }

    return encoder.encodeParticipants(participants).map((point) => ({
      id: point.id,
      label: point.label,
      x: point.x,
      y: point.y,
      r: point.radius,
      theta: point.theta,
    }));
  }

  /**
   * Build a deterministic point lookup for records using the hyperbolic encoder.
   */
  private createRecordPointLookup(
    records: AttributionRecord[],
    encoder?: HyperbolicEncoder
  ): Map<string, PoincarePoint> {
    const lookup = new Map<string, PoincarePoint>();
    if (!encoder || records.length === 0) {
      return lookup;
    }

    const participants = new Map<string, { value: number; category: string }>();
    for (const record of records) {
      const key = this.recordPointKey(record);
      const existing = participants.get(key);
      participants.set(key, {
        value: (existing?.value ?? 0) + record.amount,
        category: record.category,
      });
    }

    for (const point of encoder.encodeParticipants(participants)) {
      if (point.id) {
        lookup.set(point.id, point);
      }
    }

    return lookup;
  }

  /**
   * Stable point key for a contributor/category pair.
   */
  private recordPointKey(record: AttributionRecord): string {
    return `${record.address}:${record.category}`;
  }

  /**
   * Deterministic fallback when a caller does not provide a HyperbolicEncoder.
   */
  private createDeterministicRecordPoint(record: AttributionRecord): PoincarePoint {
    const seed = `${record.address}:${record.category}:${record.action}:${record.week}`;
    const angleHash = this.hashString(seed);
    const amountScale = Math.min(1, Math.log10(Math.max(1, record.amount) + 1) / 6);
    const radius = 0.2 + (1 - amountScale) * 0.65;
    const theta = (angleHash / 0xffffffff) * 2 * Math.PI;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);

    return { x, y, radius, theta, id: this.recordPointKey(record), label: record.category };
  }

  /**
   * FNV-1a hash for deterministic coordinate fallback.
   */
  private hashString(value: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /**
   * Check if record matches contract type
   */
  private recordMatchesContract(record: AttributionRecord, contractType: ContractType): boolean {
    const categoryMap: Record<ContractType, string[]> = {
      grotoken: ['grotoken', 'token_received'],
      foodusd: ['groceries', 'utilities', 'transportation', 'healthcare', 'food', 'spending'],
      grouppurchase: ['group_purchase', 'group_savings'],
      grovault: ['staking', 'vault'],
      coopgovernor: ['voting', 'governance'],
      rewardspool: ['rewards', 'reward_claimed'],
      loyaltypoints: ['loyalty', 'loyalty_earned'],
    };

    const categories = categoryMap[contractType] || [];
    return categories.includes(record.category) || categories.includes(record.action);
  }

  /**
   * Check if weight matches contract type
   */
  private weightMatchesContract(weight: ContributionWeight, contractType: ContractType): boolean {
    const categoryMap: Record<ContractType, string[]> = {
      grotoken: ['grotoken'],
      foodusd: ['groceries', 'utilities', 'transportation', 'healthcare', 'food'],
      grouppurchase: ['group_purchase'],
      grovault: ['staking'],
      coopgovernor: ['voting'],
      rewardspool: ['rewards'],
      loyaltypoints: ['loyalty'],
    };

    const categories = categoryMap[contractType] || [];
    return categories.includes(weight.category);
  }

  /**
   * Get human-readable contract label
   */
  private getContractLabel(contractType: ContractType): string {
    const labels: Record<ContractType, string> = {
      grotoken: 'GroToken Distribution',
      foodusd: 'FoodUSD Spending',
      grouppurchase: 'Group Purchase Savings',
      grovault: 'GroVault Staking',
      coopgovernor: 'CoopGovernor Votes',
      rewardspool: 'Rewards Pool Claims',
      loyaltypoints: 'Loyalty Points',
    };
    return labels[contractType];
  }

  /**
   * Compute aggregate metrics across weeks
   */
  private computeAggregateMetrics(weeks: WeeklySimulationData[]): Record<string, unknown> {
    const totalWealth = weeks.reduce((sum, w) => sum + w.totalWealth, 0) / weeks.length;
    const avgGini = weeks.reduce((sum, w) => sum + w.gini, 0) / weeks.length;
    const avgPoverty = weeks.reduce((sum, w) => sum + w.povertyRate, 0) / weeks.length;
    const totalSpending = weeks.reduce((sum, w) => sum + w.totalSpending, 0);
    const totalSavings = weeks.reduce((sum, w) => sum + w.totalSavings, 0);

    // Calculate Gini trend
    const giniStart = weeks[0].gini;
    const giniEnd = weeks[weeks.length - 1].gini;
    const giniTrend = giniEnd - giniStart;

    return {
      avg_wealth: totalWealth,
      avg_gini: avgGini,
      avg_poverty_rate: avgPoverty,
      total_spending: totalSpending,
      total_savings: totalSavings,
      gini_change: giniTrend,
      gini_improved: giniTrend < 0,
    };
  }

  /**
   * Validate generated CGP against schema
   */
  validateCGP(cgp: CGPDocument): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!cgp.spec || !['chit.cgp.v0.1', 'chit.cgp.v0.2', 'chit.cgp.v1.0'].includes(cgp.spec)) {
      errors.push('Invalid or missing spec field');
    }

    if (!cgp.super_nodes || cgp.super_nodes.length === 0) {
      errors.push('super_nodes array is required and must have at least one item');
    }

    // Validate super_nodes
    for (const node of cgp.super_nodes || []) {
      if (!node.constellations) {
        errors.push(`Super node ${node.id} missing constellations array`);
      }

      // Validate constellations
      for (const constellation of node.constellations || []) {
        if (!constellation.id) {
          errors.push('Constellation missing required id field');
        }
        if (!constellation.points) {
          errors.push(`Constellation ${constellation.id} missing points array`);
        }

        // Validate points
        for (const point of constellation.points || []) {
          if (!point.id) {
            errors.push('Point missing required id field');
          }
        }
      }
    }

    // Validate hyperbolic points if present
    if (cgp.hyperbolic?.points) {
      for (const point of cgp.hyperbolic.points) {
        const r = Math.sqrt(point.x * point.x + point.y * point.y);
        if (r >= 1) {
          errors.push(`Poincare point ${point.id} outside unit disk (r=${r.toFixed(4)})`);
        }
      }
    }

    // Validate attribution weights sum
    if (cgp.attribution?.contributors) {
      const weightSum = cgp.attribution.contributors.reduce((sum, c) => sum + c.weight, 0);
      if (Math.abs(weightSum - 1.0) > 1e-6 && cgp.attribution.contributors.length > 0) {
        errors.push(`Attribution weights do not sum to 1 (sum=${weightSum.toFixed(6)})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CGPGeneratorConfig {
    return { ...this.config };
  }
}
