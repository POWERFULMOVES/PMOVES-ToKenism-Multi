// contracts/equalweight-governor-model.ts
export type VotingBasis = 'member' | 'unit' | 'share';

export interface EligibleMember {
  id: string;
  units?: number;
  shares?: number;
}

export interface EqualWeightGovernorConfig {
  votingBasis: VotingBasis;
  quorumPercentage: number;
  passThreshold: number;
  committeeSize: number;
  committeeThreshold: number;
}

export interface TallyResult {
  proposalId: string;
  votesFor: number;
  votesAgainst: number;
  eligibleCount: number;
  voterCount: number;
  turnout: number;
  quorumMet: boolean;
  passed: boolean;
  finalized: boolean;
  attestation?: TallyAttestation;
}

export interface TallyAttestation {
  algo: string;
  approvers: string[];
  signature: string;
}

export interface TallySigner {
  sign(
    tally: TallyResult,
    approvers: string[],
    committee: string[],
    threshold: number
  ): TallyAttestation;
}

// Sim stub: models the k-of-n GATE (the anti-forgery property); the signature
// bytes are stubbed. Real Ed25519/FROST implements this same interface later.
export class MockThresholdSigner implements TallySigner {
  sign(
    tally: TallyResult,
    approvers: string[],
    committee: string[],
    threshold: number
  ): TallyAttestation {
    const unique = Array.from(new Set(approvers));
    for (const a of unique) {
      if (!committee.includes(a)) {
        throw new Error(`Approver ${a} is not on the committee`);
      }
    }
    if (unique.length < threshold) {
      throw new Error(
        `Below committee threshold: ${unique.length} approvers < ${threshold}`
      );
    }
    return { algo: 'stub-mofn', approvers: unique, signature: `stub:${tally.proposalId}` };
  }
}

interface Proposal {
  id: string;
  title: string;
  closesAtWeek?: number;
  votes: Map<string, boolean>; // voter -> support
}

export class EqualWeightGovernorModel {
  private config: EqualWeightGovernorConfig;
  private roll: Map<string, EligibleMember> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private committee: Set<string> = new Set();
  private signer: TallySigner;

  constructor(
    config: Partial<EqualWeightGovernorConfig> = {},
    signer: TallySigner = new MockThresholdSigner()
  ) {
    this.config = {
      votingBasis: 'member',
      quorumPercentage: 0.5,
      passThreshold: 0.5,
      committeeSize: 3,
      committeeThreshold: 2,
      ...config,
    };
    if (this.config.committeeThreshold < 1) {
      throw new Error(
        `committeeThreshold must be >= 1 (got ${this.config.committeeThreshold})`
      );
    }
    if (this.config.committeeThreshold > this.config.committeeSize) {
      throw new Error(
        `committeeThreshold (${this.config.committeeThreshold}) cannot exceed committeeSize (${this.config.committeeSize})`
      );
    }
    this.signer = signer;
  }

  setCommittee(memberIds: string[]): void {
    this.committee = new Set(memberIds);
  }

  finalize(proposalId: string, approvers: string[]): TallyResult {
    const result = this.tally(proposalId);
    const attestation = this.signer.sign(
      result,
      approvers,
      Array.from(this.committee),
      this.config.committeeThreshold
    );
    return { ...result, finalized: true, attestation };
  }

  setRoll(members: EligibleMember[]): void {
    this.roll = new Map(members.map((m) => [m.id, m]));
  }

  createProposal(id: string, title: string, closesAtWeek?: number): void {
    this.proposals.set(id, { id, title, closesAtWeek, votes: new Map() });
  }

  private weightOf(member: EligibleMember): number {
    let raw: number;
    switch (this.config.votingBasis) {
      case 'unit':
        raw = member.units ?? 1;
        break;
      case 'share':
        raw = member.shares ?? 1;
        break;
      case 'member':
      default:
        return 1;
    }
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  }

  castVote(proposalId: string, voter: string, support: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (!this.roll.has(voter)) {
      throw new Error(`${voter} is not on the eligible roll`);
    }
    if (proposal.votes.has(voter)) {
      throw new Error(`${voter} has already voted on ${proposalId}`);
    }
    proposal.votes.set(voter, support);
  }

  tally(proposalId: string): TallyResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);

    let votesFor = 0;
    let votesAgainst = 0;
    let voterCount = 0;
    for (const [voter, support] of proposal.votes) {
      const member = this.roll.get(voter);
      if (!member) continue;
      voterCount += 1;
      const w = this.weightOf(member);
      if (support) votesFor += w;
      else votesAgainst += w;
    }

    const eligibleCount = this.roll.size;
    const turnout = eligibleCount > 0 ? voterCount / eligibleCount : 0;
    const quorumMet = turnout >= this.config.quorumPercentage;
    const decided = votesFor + votesAgainst;
    const forShare = decided > 0 ? votesFor / decided : 0;
    const passed = quorumMet && forShare >= this.config.passThreshold;

    return {
      proposalId,
      votesFor,
      votesAgainst,
      eligibleCount,
      voterCount,
      turnout,
      quorumMet,
      passed,
      finalized: false,
    };
  }
}
