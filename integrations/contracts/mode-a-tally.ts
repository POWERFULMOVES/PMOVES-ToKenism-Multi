// contracts/mode-a-tally.ts
// Mode-A (secret-ballot) tally ingestion math: pure outcome computation shared by
// the governor's ingestSecretTally and the abstention-policy contrast sweep.
// Self-contained (no governor import) so there is no import cycle. See
// docs/superpowers/specs/2026-07-18-mode-a-tally-ingestion-design.md.

export type AbstentionPolicy = 'quorum' | 'excluded';

// Provenance: which ballot's evidence a tally claims to summarize. receiptLogDigest
// is a caller-supplied hash of the sorted sealed receiptHash list (the proof that
// counts CORRESPOND to receipts is stage 4b — this only binds which ballot).
export interface BallotRef {
  ballotId: string;
  receiptLogDigest: string;
}

export interface SecretTallyCounts {
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  ballotRef?: BallotRef;
}

export interface SecretOutcome {
  votesFor: number;
  votesAgainst: number;
  eligibleCount: number;
  voterCount: number;
  turnout: number;
  quorumMet: boolean;
  passed: boolean;
}

interface OutcomeConfig {
  abstentionPolicy: AbstentionPolicy;
  quorumPercentage: number;
  passThreshold: number;
}

function assertCount(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`invalid ${label}: ${n}`);
  }
}

// Pure. Hard integrity guards (safe-integer/non-negative counts, voterCount <=
// eligibleCount) live here so every caller inherits them. abstentionPolicy
// selects whether abstentions count toward turnout; the for/against decision
// always excludes them.
export function computeSecretOutcome(
  counts: { votesFor: number; votesAgainst: number; abstentions: number },
  eligibleCount: number,
  cfg: OutcomeConfig
): SecretOutcome {
  assertCount(counts.votesFor, 'votesFor');
  assertCount(counts.votesAgainst, 'votesAgainst');
  assertCount(counts.abstentions, 'abstentions');
  const voterCount = counts.votesFor + counts.votesAgainst + counts.abstentions;
  if (voterCount > eligibleCount) {
    throw new Error(`voterCount ${voterCount} exceeds eligibleCount ${eligibleCount}`);
  }
  const participating =
    cfg.abstentionPolicy === 'excluded'
      ? counts.votesFor + counts.votesAgainst
      : voterCount;
  const turnout = eligibleCount > 0 ? participating / eligibleCount : 0;
  const quorumMet = eligibleCount > 0 && turnout >= cfg.quorumPercentage;
  const decided = counts.votesFor + counts.votesAgainst;
  const forShare = decided > 0 ? counts.votesFor / decided : 0;
  const passed = quorumMet && forShare >= cfg.passThreshold;
  return {
    votesFor: counts.votesFor,
    votesAgainst: counts.votesAgainst,
    eligibleCount,
    voterCount,
    turnout,
    quorumMet,
    passed,
  };
}

// The "where the chips land" surface: same counts under both policies.
export function sweepAbstentionPolicy(
  counts: { votesFor: number; votesAgainst: number; abstentions: number },
  eligibleCount: number,
  cfg: { quorumPercentage: number; passThreshold: number }
): { quorum: SecretOutcome; excluded: SecretOutcome } {
  return {
    quorum: computeSecretOutcome(counts, eligibleCount, { ...cfg, abstentionPolicy: 'quorum' }),
    excluded: computeSecretOutcome(counts, eligibleCount, { ...cfg, abstentionPolicy: 'excluded' }),
  };
}
