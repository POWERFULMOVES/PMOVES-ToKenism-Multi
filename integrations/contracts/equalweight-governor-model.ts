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

  constructor(config: Partial<EqualWeightGovernorConfig> = {}) {
    this.config = {
      votingBasis: 'member',
      quorumPercentage: 0.5,
      passThreshold: 0.5,
      committeeSize: 3,
      committeeThreshold: 2,
      ...config,
    };
  }

  setRoll(members: EligibleMember[]): void {
    this.roll = new Map(members.map((m) => [m.id, m]));
  }

  createProposal(id: string, title: string, closesAtWeek?: number): void {
    this.proposals.set(id, { id, title, closesAtWeek, votes: new Map() });
  }

  private weightOf(member: EligibleMember): number {
    switch (this.config.votingBasis) {
      case 'unit':
        return member.units ?? 1;
      case 'share':
        return member.shares ?? 1;
      case 'member':
      default:
        return 1;
    }
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
    for (const [voter, support] of proposal.votes) {
      const member = this.roll.get(voter);
      if (!member) continue;
      const w = this.weightOf(member);
      if (support) votesFor += w;
      else votesAgainst += w;
    }

    const eligibleCount = this.roll.size;
    const voterCount = proposal.votes.size;
    const turnout = eligibleCount > 0 ? voterCount / eligibleCount : 0;

    return {
      proposalId,
      votesFor,
      votesAgainst,
      eligibleCount,
      voterCount,
      turnout,
      quorumMet: false,
      passed: false,
      finalized: false,
    };
  }
}
