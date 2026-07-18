// contracts/equalweight-governor-model.ts
import { AbstentionPolicy, BallotRef, SecretTallyCounts, computeSecretOutcome } from './mode-a-tally';

export type VotingBasis = 'member' | 'unit' | 'share';

export interface EligibleMember {
  id: string;
  units?: number;
  shares?: number;
}

export interface EqualWeightGovernorConfig {
  abstentionPolicy: AbstentionPolicy;
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
  ballotRef?: BallotRef;
}

export interface TallyAttestation {
  algo: string;
  approvers: string[];
  signature?: string;
  signatures?: Record<string, string>;
}

export interface TallySigner {
  sign(
    tally: TallyResult,
    approvers: string[],
    committee: string[],
    threshold: number
  ): TallyAttestation;
}

// Shared anti-forgery gate: dedupe approvers, require all on the committee,
// require >= threshold DISTINCT approvers. One definition, used by the mock
// and by the real Ed25519 signer.
export function assertCommitteeThreshold(
  approvers: string[],
  committee: string[],
  threshold: number
): string[] {
  if (!Number.isSafeInteger(threshold) || threshold < 1) {
    throw new Error(`invalid threshold: ${threshold}`);
  }
  const unique = Array.from(new Set(approvers));
  for (const a of unique) {
    if (!committee.includes(a)) {
      throw new Error(`Approver ${a} is not on the committee`);
    }
  }
  if (unique.length < threshold) {
    throw new Error(`Below committee threshold: ${unique.length} approvers < ${threshold}`);
  }
  return unique;
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
    const unique = assertCommitteeThreshold(approvers, committee, threshold);
    return { algo: 'stub-mofn', approvers: unique, signature: `stub:${tally.proposalId}` };
  }
}

interface Proposal {
  id: string;
  title: string;
  closesAtWeek?: number;
  votes: Map<string, boolean>; // voter -> support
  mode?: 'named' | 'secret';       // set on first intake; locks the proposal to one path
  ingestedTally?: TallyResult;     // secret proposals: the precomputed result tally() returns
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
      abstentionPolicy: 'quorum',
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

  private cloneTally(t: TallyResult): TallyResult {
    return { ...t, ...(t.ballotRef ? { ballotRef: { ...t.ballotRef } } : {}) };
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
    if (proposal.mode === 'secret') {
      throw new Error(`Proposal ${proposalId} is in secret mode; named castVote is not allowed`);
    }
    if (!this.roll.has(voter)) {
      throw new Error(`${voter} is not on the eligible roll`);
    }
    if (proposal.votes.has(voter)) {
      throw new Error(`${voter} has already voted on ${proposalId}`);
    }
    // lock on first SUCCESSFUL named vote — a rejected attempt does not lock the mode
    proposal.mode = 'named';
    proposal.votes.set(voter, support);
  }

  ingestSecretTally(proposalId: string, counts: SecretTallyCounts): TallyResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (proposal.mode === 'named') {
      throw new Error(`Proposal ${proposalId} is in named mode; secret ingestion is not allowed`);
    }
    const outcome = computeSecretOutcome(
      { votesFor: counts.votesFor, votesAgainst: counts.votesAgainst, abstentions: counts.abstentions },
      this.roll.size,
      {
        abstentionPolicy: this.config.abstentionPolicy,
        quorumPercentage: this.config.quorumPercentage,
        passThreshold: this.config.passThreshold,
      }
    );
    const result: TallyResult = {
      proposalId,
      votesFor: outcome.votesFor,
      votesAgainst: outcome.votesAgainst,
      eligibleCount: outcome.eligibleCount,
      voterCount: outcome.voterCount,
      turnout: outcome.turnout,
      quorumMet: outcome.quorumMet,
      passed: outcome.passed,
      finalized: false,
      ...(counts.ballotRef ? { ballotRef: { ...counts.ballotRef } } : {}),
    };
    // lock on first SUCCESSFUL ingest — a rejected attempt does not lock the mode
    proposal.mode = 'secret';
    proposal.ingestedTally = result;
    return this.cloneTally(result);
  }

  tally(proposalId: string): TallyResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (proposal.mode === 'secret' && proposal.ingestedTally) {
      return this.cloneTally(proposal.ingestedTally);
    }

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
