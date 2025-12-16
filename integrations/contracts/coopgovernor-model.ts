/**
 * CoopGovernor Voting Model
 * Implements quadratic voting with time-locked GroVault voting power
 */

import { GroVaultModel } from './grovault-model';

export interface GovernanceConfig {
  votingPeriodWeeks: number; // Duration of voting period (default 2 weeks)
  proposalThreshold: number; // Minimum votes needed to pass
  quorumPercentage: number; // % of total voting power needed (0.10 = 10%)
  chairperson: string; // Governance chairperson
}

export interface Proposal {
  id: number;
  description: string;
  proposer: string;
  startWeek: number;
  endWeek: number;
  executed: boolean;
  category: string;
  forVotes: number;
  againstVotes: number;
  voters: Set<string>;
  // Computed properties for backward compatibility
  votingDeadline: number;
  status: 'active' | 'executed' | 'expired';
  votesFor: number;
  votesAgainst: number;
  voterCount: number;
}

export interface Vote {
  proposalId: number;
  voter: string;
  support: boolean; // true = for, false = against
  rawVotes: number; // Number of votes cast
  votingPowerUsed: number; // Quadratic cost (rawVotes^2)
  week: number;
  timestamp: number;
}

export interface ProposalResult {
  proposalId: number;
  passed: boolean;
  forVotes: number;
  againstVotes: number;
  totalVotes: number;
  participationRate: number;
  quorumMet: boolean;
  executed: boolean;
  reason?: string;
}

export class CoopGovernorModel {
  private config: GovernanceConfig;
  private vault: GroVaultModel;
  private proposals: Map<number, Proposal> = new Map();
  private nextProposalId: number = 1;
  private votes: Vote[] = [];
  private spentVotingPower: Map<number, Map<string, number>> = new Map(); // proposalId => (voter => spent power)
  private _currentWeek: number = 0;

  constructor(
    vault: GroVaultModel,
    config: Partial<GovernanceConfig> = {}
  ) {
    this.vault = vault;

    this.config = {
      votingPeriodWeeks: 2,
      proposalThreshold: 100,
      quorumPercentage: 0.10,
      chairperson: '0xCHAIRPERSON',
      ...config,
    };
  }

  /**
   * Create a new proposal
   */
  createProposal(
    week: number,
    proposer: string,
    description: string,
    category: string = 'general'
  ): number {
    this._currentWeek = week;

    const proposalId = this.nextProposalId++;
    const startWeek = week;
    const endWeek = week + this.config.votingPeriodWeeks;

    const proposal: Proposal = {
      id: proposalId,
      description,
      proposer,
      startWeek,
      endWeek,
      executed: false,
      category,
      forVotes: 0,
      againstVotes: 0,
      voters: new Set(),
      votingDeadline: endWeek,
      status: 'active',
      votesFor: 0,
      votesAgainst: 0,
      voterCount: 0,
    };

    this.proposals.set(proposalId, proposal);
    this.spentVotingPower.set(proposalId, new Map());

    // console.log(
    //   `[CoopGovernor] Proposal ${proposalId} created: "${description}"`
    // );

    return proposalId;
  }

  /**
   * Cast a quadratic vote
   * Quadratic voting: cost = rawVotes^2
   */
  castVote(
    week: number,
    proposalId: number,
    voter: string,
    rawVotes: number,
    support: boolean
  ): boolean {
    this._currentWeek = week;

    const proposal = this.proposals.get(proposalId);

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (week < proposal.startWeek) {
      throw new Error(`Voting not started for proposal ${proposalId}`);
    }

    if (week > proposal.endWeek) {
      throw new Error(`Voting period ended for proposal ${proposalId}`);
    }

    // Get voter's voting power from vault
    const availablePower = this.vault.getVotingPower(voter);

    if (availablePower === 0) {
      throw new Error(`${voter} has no voting power (no active lock in vault)`);
    }

    // Calculate quadratic cost
    const cost = rawVotes * rawVotes;

    // Check if voter has enough voting power
    const spent = this.spentVotingPower.get(proposalId)?.get(voter) || 0;
    const totalNeeded = spent + cost;

    if (totalNeeded > availablePower) {
      throw new Error(
        `Insufficient voting power for ${voter}. Available: ${availablePower}, Needed: ${totalNeeded}`
      );
    }

    // Record vote
    const voteRecord: Vote = {
      proposalId,
      voter,
      support,
      rawVotes,
      votingPowerUsed: cost,
      week,
      timestamp: Date.now(),
    };

    this.votes.push(voteRecord);

    // Update proposal tally
    if (support) {
      proposal.forVotes += rawVotes;
      proposal.votesFor += rawVotes;
    } else {
      proposal.againstVotes += rawVotes;
      proposal.votesAgainst += rawVotes;
    }

    proposal.voters.add(voter);
    proposal.voterCount = proposal.voters.size;

    // Update spent voting power
    this.spentVotingPower.get(proposalId)!.set(voter, totalNeeded);

    // console.log(
    //   `[CoopGovernor] ${voter} voted ${support ? 'FOR' : 'AGAINST'} proposal ${proposalId} with ${rawVotes} votes (cost: ${cost})`
    // );

    return true;
  }

  /**
   * Execute a proposal (after voting period ends)
   */
  executeProposal(week: number, proposalId: number): ProposalResult {
    const proposal = this.proposals.get(proposalId);

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (week <= proposal.endWeek) {
      throw new Error(
        `Voting period not ended for proposal ${proposalId}. Ends at week ${proposal.endWeek}`
      );
    }

    if (proposal.executed) {
      throw new Error(`Proposal ${proposalId} already executed`);
    }

    // Calculate total voting power in system
    const stats = this.vault.getStatistics();
    const totalVotingPower = stats.totalVotingPower;

    // Check quorum
    const totalVotes = proposal.forVotes + proposal.againstVotes;
    const quorumNeeded = totalVotingPower * this.config.quorumPercentage;
    const quorumMet = totalVotes >= quorumNeeded;

    // Check if passed
    const passed =
      quorumMet &&
      proposal.forVotes >= this.config.proposalThreshold &&
      proposal.forVotes > proposal.againstVotes;

    // Mark as executed
    proposal.executed = true;
    proposal.status = 'executed';

    const result: ProposalResult = {
      proposalId,
      passed,
      forVotes: proposal.forVotes,
      againstVotes: proposal.againstVotes,
      totalVotes,
      participationRate: totalVotingPower > 0 ? totalVotes / totalVotingPower : 0,
      quorumMet,
      executed: true,
      reason: !quorumMet ? 'Quorum not met' : !passed ? 'Proposal did not pass' : undefined,
    };

    // console.log(
    //   `[CoopGovernor] Proposal ${proposalId} ${passed ? 'PASSED' : 'FAILED'}. For: ${proposal.forVotes}, Against: ${proposal.againstVotes}`
    // );

    return result;
  }

  /**
   * Get proposal details
   */
  getProposal(proposalId: number): Proposal | null {
    const proposal = this.proposals.get(proposalId);

    if (!proposal) {
      return null;
    }

    return {
      ...proposal,
      voters: new Set(proposal.voters),
    };
  }

  /**
   * Get active proposals
   */
  getActiveProposals(week: number): Proposal[] {
    return Array.from(this.proposals.values())
      .filter((p) => week >= p.startWeek && week <= p.endWeek)
      .map((p) => ({
        ...p,
        voters: new Set(p.voters),
      }));
  }

  /**
   * Get all votes for a proposal
   */
  getProposalVotes(proposalId: number): Vote[] {
    return this.votes.filter((v) => v.proposalId === proposalId);
  }

  /**
   * Get voting statistics for a voter
   */
  getVoterStats(voter: string): {
    proposalsVotedOn: number;
    totalVotesCast: number;
    averageVotingPowerUsed: number;
  } {
    const voterVotes = this.votes.filter((v) => v.voter === voter);
    const totalPowerUsed = voterVotes.reduce((sum, v) => sum + v.votingPowerUsed, 0);

    return {
      proposalsVotedOn: new Set(voterVotes.map((v) => v.proposalId)).size,
      totalVotesCast: voterVotes.reduce((sum, v) => sum + v.rawVotes, 0),
      averageVotingPowerUsed:
        voterVotes.length > 0 ? totalPowerUsed / voterVotes.length : 0,
    };
  }

  /**
   * Get global governance statistics
   */
  getStatistics(): {
    totalProposals: number;
    activeProposals: number;
    executedProposals: number;
    passedProposals: number;
    failedProposals: number;
    totalVotes: number;
    uniqueVoters: number;
    averageParticipationRate: number;
    averageQuorum: number;
    proposalsByCategory: Record<string, number>;
  } {
    const allProposals = Array.from(this.proposals.values());
    const active = this.getActiveProposals(this._currentWeek);
    const executed = allProposals.filter((p) => p.executed);

    let totalParticipation = 0;
    let totalQuorum = 0;
    let passedCount = 0;

    const stats = this.vault.getStatistics();

    // Count proposals by category
    const proposalsByCategory: Record<string, number> = {};
    for (const proposal of allProposals) {
      proposalsByCategory[proposal.category] = (proposalsByCategory[proposal.category] || 0) + 1;
    }

    for (const proposal of executed) {
      const totalVotes = proposal.forVotes + proposal.againstVotes;
      const participation =
        stats.totalVotingPower > 0 ? totalVotes / stats.totalVotingPower : 0;

      totalParticipation += participation;

      const quorum =
        totalVotes >= stats.totalVotingPower * this.config.quorumPercentage;

      if (quorum) {
        totalQuorum++;
      }

      if (
        quorum &&
        proposal.forVotes >= this.config.proposalThreshold &&
        proposal.forVotes > proposal.againstVotes
      ) {
        passedCount++;
      }
    }

    const uniqueVoters = new Set(this.votes.map((v) => v.voter)).size;

    return {
      totalProposals: allProposals.length,
      activeProposals: active.length,
      executedProposals: executed.length,
      passedProposals: passedCount,
      failedProposals: executed.length - passedCount,
      totalVotes: this.votes.length,
      uniqueVoters,
      averageParticipationRate:
        executed.length > 0 ? totalParticipation / executed.length : 0,
      averageQuorum: executed.length > 0 ? totalQuorum / executed.length : 0,
      proposalsByCategory,
    };
  }

  /**
   * Analyze democratic participation
   */
  analyzeDemocraticEngagement(): {
    voterTurnout: number;
    concentrationOfPower: number;
    quadraticFairness: number;
    averageVotesPerVoter: number;
  } {
    // const _stats = this.vault.getStatistics();
    const uniqueVoters = new Set(this.votes.map((v) => v.voter)).size;

    // Estimate total potential voters (those with vault positions)
    const activeLocks = this.vault.getActiveLocks();
    const potentialVoters = activeLocks.length;

    const voterTurnout = potentialVoters > 0 ? uniqueVoters / potentialVoters : 0;

    // Calculate concentration of power (Gini-like metric for voting power)
    const votingPowers = activeLocks.map((lock) => lock.votingPower);
    const totalPower = votingPowers.reduce((sum, p) => sum + p, 0);

    let concentrationSum = 0;

    for (let i = 0; i < votingPowers.length; i++) {
      for (let j = 0; j < votingPowers.length; j++) {
        concentrationSum += Math.abs(votingPowers[i] - votingPowers[j]);
      }
    }

    const concentrationOfPower =
      votingPowers.length > 0 && totalPower > 0
        ? concentrationSum / (2 * votingPowers.length * totalPower)
        : 0;

    // Quadratic fairness: ratio of unique voters to total voting power used
    const totalVotingPowerUsed = this.votes.reduce(
      (sum, v) => sum + v.votingPowerUsed,
      0
    );

    const quadraticFairness =
      uniqueVoters > 0 ? Math.sqrt(uniqueVoters) / Math.sqrt(totalVotingPowerUsed || 1) : 0;

    const averageVotesPerVoter =
      uniqueVoters > 0 ? this.votes.length / uniqueVoters : 0;

    return {
      voterTurnout,
      concentrationOfPower,
      quadraticFairness,
      averageVotesPerVoter,
    };
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    config: GovernanceConfig;
    proposals: Proposal[];
    votes: Vote[];
    totalProposals: number;
    statistics: {
      totalProposals: number;
      activeProposals: number;
      executedProposals: number;
      passedProposals: number;
      failedProposals: number;
      totalVotes: number;
      uniqueVoters: number;
      averageParticipationRate: number;
      averageQuorum: number;
      proposalsByCategory: Record<string, number>;
    };
    engagement: {
      voterTurnout: number;
      concentrationOfPower: number;
      quadraticFairness: number;
      averageVotesPerVoter: number;
    };
  } {
    const stats = this.getStatistics();
    return {
      config: this.config,
      proposals: Array.from(this.proposals.values()).map((p) => ({
        ...p,
        voters: new Set(p.voters),
      })),
      votes: [...this.votes],
      totalProposals: stats.totalProposals,
      statistics: stats,
      engagement: this.analyzeDemocraticEngagement(),
    };
  }
}

export default CoopGovernorModel;
