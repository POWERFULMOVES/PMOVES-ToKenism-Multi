/**
 * Shape Attribution Model
 *
 * Combines Dirichlet weighting and hyperbolic encoding with Merkle tree proofs
 * for verifiable, provable credit attribution in economic simulations.
 *
 * Features:
 * - Records every action with attribution metadata
 * - Generates Merkle proofs for inclusion verification
 * - Supports multiple tree strategies (per-week, rolling, per-contract)
 * - Exports to CGP format
 */

import { createHash } from 'crypto';
import { keccak256, toUtf8Bytes } from 'ethers';
import { DirichletWeights, ContributionWeight } from './dirichlet-weights';
import { HyperbolicEncoder, PoincarePoint, CGPSuperNode, CGPConstellation, CGPPoint } from './hyperbolic-encoder';

export type AttributionAction =
  | 'token_received'
  | 'spending'
  | 'group_contribution'
  | 'staking'
  | 'voting'
  | 'loyalty_earned'
  | 'reward_claimed';

export type MerkleTreeStrategy =
  | 'per_week'      // New tree each week
  | 'rolling'       // Single tree across all weeks
  | 'per_contract'; // Separate tree per contract type

export interface MerkleConfig {
  strategy: MerkleTreeStrategy;
  hashAlgorithm: 'sha256' | 'keccak256';
  signProofs: boolean;
}

export interface AttributionProof {
  merkleRoot: string;
  leafHash: string;
  path: string[];
  pathIndices: number[];
  signature?: string;
}

export interface AttributionRecord {
  chitId: string;
  address: string;
  action: AttributionAction;
  amount: number;
  week: number;
  category: string;
  timestamp: string;
  proof: AttributionProof;
}

export interface ShapeAttributionConfig {
  merkle: MerkleConfig;
  dirichlet?: Partial<{
    smoothingAlpha: number;
    concentrationK: number;
    decayHalfLife: number;
  }>;
  hyperbolic?: Partial<{
    curvature: number;
    baseRadius: number;
    radiusGrowth: number;
  }>;
}

export interface CGPDocument {
  spec: string;
  summary: string;
  meta?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  super_nodes: CGPSuperNode[];
  sig?: string | null;
}

interface MerkleTree {
  leaves: string[];
  root: string;
  layers: string[][];
}

export class ShapeAttribution {
  private config: ShapeAttributionConfig;
  private dirichlet: DirichletWeights;
  private encoder: HyperbolicEncoder;
  private records: Map<string, AttributionRecord> = new Map();
  private recordsByWeek: Map<number, string[]> = new Map();
  private recordsByContract: Map<string, string[]> = new Map();
  private recordsByAddress: Map<string, string[]> = new Map();
  private merkleTreesByWeek: Map<number, MerkleTree> = new Map();
  private merkleTreesByContract: Map<string, MerkleTree> = new Map();
  private rollingMerkleTree: MerkleTree | null = null;
  private chitIdCounter: number = 0;

  constructor(config: Partial<ShapeAttributionConfig> = {}) {
    this.config = {
      merkle: {
        strategy: 'per_week',
        hashAlgorithm: 'sha256',
        signProofs: false,
      },
      ...config,
    };

    this.dirichlet = new DirichletWeights(this.config.dirichlet);
    this.encoder = new HyperbolicEncoder(this.config.hyperbolic);
  }

  /**
   * Generate a unique CHIT ID
   */
  private generateChitId(): string {
    this.chitIdCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.chitIdCounter.toString(36).padStart(4, '0');
    return `chit-${timestamp}-${counter}`;
  }

  /**
   * Hash data using the configured Merkle hash algorithm.
   */
  private hash(data: string): string {
    switch (this.config.merkle.hashAlgorithm) {
      case 'sha256':
        return `0x${createHash('sha256').update(data, 'utf8').digest('hex')}`;
      case 'keccak256':
        return keccak256(toUtf8Bytes(data));
    }
    const exhaustive: never = this.config.merkle.hashAlgorithm;
    throw new Error(`Unsupported Merkle hash algorithm: ${exhaustive}`);
  }

  /**
   * Hash a leaf node (action record)
   */
  private hashLeaf(record: Omit<AttributionRecord, 'chitId' | 'proof' | 'timestamp'>): string {
    return this.hash(JSON.stringify({
      address: record.address,
      action: record.action,
      amount: record.amount,
      week: record.week,
      category: record.category,
    }));
  }

  /**
   * Hash two nodes together (parent in Merkle tree)
   */
  private hashPair(left: string, right: string): string {
    return this.hash(JSON.stringify([left, right]));
  }

  /**
   * Build Merkle tree from leaves
   */
  private buildMerkleTree(leaves: string[]): MerkleTree {
    if (leaves.length === 0) {
      return { leaves: [], root: this.hash('empty'), layers: [[]] };
    }

    // Pad to power of 2
    const paddedLeaves = [...leaves];
    while (paddedLeaves.length > 1 && (paddedLeaves.length & (paddedLeaves.length - 1)) !== 0) {
      paddedLeaves.push(this.hash('padding'));
    }

    const layers: string[][] = [paddedLeaves];

    while (layers[layers.length - 1].length > 1) {
      const currentLayer = layers[layers.length - 1];
      const nextLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1] ?? left;
        nextLayer.push(this.hashPair(left, right));
      }

      layers.push(nextLayer);
    }

    return {
      leaves: paddedLeaves,
      root: layers[layers.length - 1][0],
      layers,
    };
  }

  /**
   * Get Merkle proof for a leaf
   */
  private getMerkleProof(tree: MerkleTree, leafHash: string): { path: string[]; pathIndices: number[] } {
    const leafIndex = tree.leaves.indexOf(leafHash);
    if (leafIndex === -1) {
      return { path: [], pathIndices: [] };
    }

    const path: string[] = [];
    const pathIndices: number[] = [];
    let index = leafIndex;

    for (let i = 0; i < tree.layers.length - 1; i++) {
      const layer = tree.layers[i];
      const isRight = index % 2 === 1;
      const siblingIndex = isRight ? index - 1 : index + 1;

      if (siblingIndex < layer.length) {
        path.push(layer[siblingIndex]);
        pathIndices.push(isRight ? 0 : 1);
      }

      index = Math.floor(index / 2);
    }

    return { path, pathIndices };
  }

  /**
   * Verify a Merkle proof
   */
  verifyProof(leafHash: string, proof: AttributionProof): boolean {
    let currentHash = leafHash;

    for (let i = 0; i < proof.path.length; i++) {
      const sibling = proof.path[i];
      if (proof.pathIndices[i] === 0) {
        currentHash = this.hashPair(sibling, currentHash);
      } else {
        currentHash = this.hashPair(currentHash, sibling);
      }
    }

    return currentHash === proof.merkleRoot;
  }

  /**
   * Record an action with attribution
   */
  recordAction(
    address: string,
    action: AttributionAction,
    amount: number,
    week: number,
    category: string
  ): string {
    const chitId = this.generateChitId();
    const leafHash = this.hashLeaf({ address, action, amount, week, category });
    const timestamp = new Date().toISOString();

    // Add to Dirichlet model
    this.dirichlet.addContribution(address, amount, category, week);

    // Create initial record (proof will be updated when tree is rebuilt)
    const record: AttributionRecord = {
      chitId,
      address,
      action,
      amount,
      week,
      category,
      timestamp,
      proof: {
        merkleRoot: '',
        leafHash,
        path: [],
        pathIndices: [],
      },
    };

    // Store in all indices
    this.records.set(chitId, record);

    if (!this.recordsByWeek.has(week)) {
      this.recordsByWeek.set(week, []);
    }
    this.recordsByWeek.get(week)!.push(chitId);

    if (!this.recordsByContract.has(category)) {
      this.recordsByContract.set(category, []);
    }
    this.recordsByContract.get(category)!.push(chitId);

    if (!this.recordsByAddress.has(address)) {
      this.recordsByAddress.set(address, []);
    }
    this.recordsByAddress.get(address)!.push(chitId);

    // Rebuild relevant Merkle tree
    this.rebuildMerkleTree(week, category);

    return chitId;
  }

  /**
   * Rebuild Merkle tree based on strategy
   */
  private rebuildMerkleTree(week: number, category: string): void {
    switch (this.config.merkle.strategy) {
      case 'per_week':
        this.rebuildWeekTree(week);
        break;
      case 'per_contract':
        this.rebuildContractTree(category);
        break;
      case 'rolling':
        this.rebuildRollingTree();
        break;
    }
  }

  /**
   * Rebuild tree for a specific week
   */
  private rebuildWeekTree(week: number): void {
    const chitIds = this.recordsByWeek.get(week) ?? [];
    const leaves = chitIds.map(id => this.records.get(id)!.proof.leafHash);
    const tree = this.buildMerkleTree(leaves);
    this.merkleTreesByWeek.set(week, tree);

    // Update proofs for all records in this week
    for (const chitId of chitIds) {
      const record = this.records.get(chitId)!;
      const { path, pathIndices } = this.getMerkleProof(tree, record.proof.leafHash);
      record.proof.merkleRoot = tree.root;
      record.proof.path = path;
      record.proof.pathIndices = pathIndices;
    }
  }

  /**
   * Rebuild tree for a specific contract category
   */
  private rebuildContractTree(category: string): void {
    const chitIds = this.recordsByContract.get(category) ?? [];
    const leaves = chitIds.map(id => this.records.get(id)!.proof.leafHash);
    const tree = this.buildMerkleTree(leaves);
    this.merkleTreesByContract.set(category, tree);

    // Update proofs for all records in this category
    for (const chitId of chitIds) {
      const record = this.records.get(chitId)!;
      const { path, pathIndices } = this.getMerkleProof(tree, record.proof.leafHash);
      record.proof.merkleRoot = tree.root;
      record.proof.path = path;
      record.proof.pathIndices = pathIndices;
    }
  }

  /**
   * Rebuild the single rolling tree
   */
  private rebuildRollingTree(): void {
    const leaves = Array.from(this.records.values()).map(r => r.proof.leafHash);
    const tree = this.buildMerkleTree(leaves);
    this.rollingMerkleTree = tree;

    // Update all proofs
    for (const record of this.records.values()) {
      const { path, pathIndices } = this.getMerkleProof(tree, record.proof.leafHash);
      record.proof.merkleRoot = tree.root;
      record.proof.path = path;
      record.proof.pathIndices = pathIndices;
    }
  }

  /**
   * Get attribution record by CHIT ID
   */
  getRecord(chitId: string): AttributionRecord | undefined {
    return this.records.get(chitId);
  }

  /**
   * Get all attributions for an address
   */
  getAddressAttribution(address: string): AttributionRecord[] {
    const chitIds = this.recordsByAddress.get(address) ?? [];
    return chitIds.map(id => this.records.get(id)!);
  }

  /**
   * Get attribution for a specific week
   */
  getWeekAttribution(week: number): AttributionRecord[] {
    const chitIds = this.recordsByWeek.get(week) ?? [];
    return chitIds.map(id => this.records.get(id)!);
  }

  /**
   * Get attribution for a contract category
   */
  getCategoryAttribution(category: string): AttributionRecord[] {
    const chitIds = this.recordsByContract.get(category) ?? [];
    return chitIds.map(id => this.records.get(id)!);
  }

  /**
   * Verify an attribution claim
   */
  verifyAttribution(record: AttributionRecord): boolean {
    // Verify the proof
    const isProofValid = this.verifyProof(record.proof.leafHash, record.proof);

    // Verify the leaf hash matches the record data
    const expectedLeafHash = this.hashLeaf({
      address: record.address,
      action: record.action,
      amount: record.amount,
      week: record.week,
      category: record.category,
    });

    return isProofValid && expectedLeafHash === record.proof.leafHash;
  }

  /**
   * Get Dirichlet weights for attribution
   */
  getDirichletWeights(category?: string): ContributionWeight[] {
    return this.dirichlet.getExpectedAttribution(category);
  }

  /**
   * Get hyperbolic encoding of participants
   */
  getHyperbolicEncoding(category?: string): PoincarePoint[] {
    const weights = this.getDirichletWeights(category);
    const participants = new Map<string, { value: number; category: string }>();

    for (const w of weights) {
      participants.set(w.address, { value: w.weight, category: w.category });
    }

    return this.encoder.encodeParticipants(participants);
  }

  /**
   * Export week as CGP document
   */
  exportCGP(week: number): CGPDocument {
    const records = this.getWeekAttribution(week);
    const weights = this.getDirichletWeights();

    // Group by category for super_nodes
    const byCategory = new Map<string, AttributionRecord[]>();
    for (const record of records) {
      if (!byCategory.has(record.category)) {
        byCategory.set(record.category, []);
      }
      byCategory.get(record.category)!.push(record);
    }

    const super_nodes: CGPSuperNode[] = [];
    const categories = Array.from(byCategory.keys());
    const anglePerCategory = (2 * Math.PI) / Math.max(categories.length, 1);

    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const categoryRecords = byCategory.get(category)!;
      const categoryWeights = weights.filter(w => w.category === category);

      // Position super_node based on category
      const angle = i * anglePerCategory;
      const radius = 0.3;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      // Create constellation from records
      const points: CGPPoint[] = categoryRecords.map((record, idx) => {
        const recordAngle = angle + (idx / categoryRecords.length - 0.5) * (anglePerCategory * 0.8);
        const recordRadius = 0.5 + (idx / categoryRecords.length) * 0.4;

        return {
          id: record.chitId,
          x: recordRadius * Math.cos(recordAngle),
          y: recordRadius * Math.sin(recordAngle),
          text: record.address,
          proj: record.amount,
          conf: 0.95,
          modality: record.action,
        };
      });

      const constellation: CGPConstellation = {
        id: `${category}-week-${week}`,
        summary: `${category} actions for week ${week}`,
        anchor: categoryWeights.map(w => w.alphaComponent),
        points,
      };

      super_nodes.push({
        id: `${category}-supernode`,
        label: category,
        x,
        y,
        r: radius,
        constellations: [constellation],
        meta: {
          attribution: {
            dirichlet_alpha: categoryWeights.map(w => w.alphaComponent),
            contributors: categoryWeights.map(w => ({
              address: w.address,
              weight: w.weight,
              raw_contribution: w.rawContribution,
              action_type: category,
            })),
            merkle_root: this.getMerkleRoot(week, category),
            timestamp: new Date().toISOString(),
          },
          hyperbolic_encoding: {
            space: 'poincare_disk',
            curvature: -1,
            points: this.getHyperbolicEncoding(category).map(p => ({
              id: p.id ?? '',
              x: p.x,
              y: p.y,
              r: p.radius,
              theta: p.theta,
            })),
          },
        },
      });
    }

    return {
      spec: 'chit.cgp.v1.0',
      summary: `ToKenism Week ${week} Economic Simulation`,
      created_at: new Date().toISOString(),
      super_nodes,
      meta: {
        week,
        total_records: records.length,
        categories: categories.length,
      },
    };
  }

  /**
   * Get Merkle root based on strategy
   */
  private getMerkleRoot(week: number, category: string): string {
    switch (this.config.merkle.strategy) {
      case 'per_week':
        return this.merkleTreesByWeek.get(week)?.root ?? '';
      case 'per_contract':
        return this.merkleTreesByContract.get(category)?.root ?? '';
      case 'rolling':
        return this.rollingMerkleTree?.root ?? '';
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalRecords: number;
    recordsByWeek: Map<number, number>;
    recordsByCategory: Map<string, number>;
    uniqueAddresses: number;
  } {
    return {
      totalRecords: this.records.size,
      recordsByWeek: new Map(
        Array.from(this.recordsByWeek.entries()).map(([k, v]) => [k, v.length])
      ),
      recordsByCategory: new Map(
        Array.from(this.recordsByContract.entries()).map(([k, v]) => [k, v.length])
      ),
      uniqueAddresses: this.recordsByAddress.size,
    };
  }

  /**
   * Get all attribution records
   */
  getRecords(): AttributionRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * Get expected attribution (alias for getDirichletWeights for API compatibility)
   */
  getExpectedAttribution(category?: string): ContributionWeight[] {
    return this.getDirichletWeights(category);
  }

  /**
   * Apply decay to Dirichlet weights
   */
  applyDecay(week: number): void {
    this.dirichlet.applyDecay(week);
  }

  /**
   * Reset all attribution data
   */
  reset(): void {
    this.records.clear();
    this.recordsByWeek.clear();
    this.recordsByContract.clear();
    this.recordsByAddress.clear();
    this.merkleTreesByWeek.clear();
    this.merkleTreesByContract.clear();
    this.rollingMerkleTree = null;
    this.dirichlet.reset();
    this.chitIdCounter = 0;
  }

  /**
   * Get configuration
   */
  getConfig(): ShapeAttributionConfig {
    return { ...this.config };
  }
}
