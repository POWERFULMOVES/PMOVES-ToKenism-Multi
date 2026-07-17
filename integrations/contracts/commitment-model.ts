/**
 * Commitment Model — the commitment-first primitive (token-structure refresh §4.4).
 *
 * Parties agree a deliverable and their shares UP FRONT. Attribution accrues
 * only when the commitment is KEPT (on time), so credit flows from kept
 * commitments — not from capital held/locked/traded, nor from mere
 * participation. Generalizes the GroupPurchase escrow from "pool money to buy
 * goods" to "agree a deliverable, keep it, earn attribution".
 *
 * Timestamps are passed in explicitly (never read from the clock) so the model
 * is deterministic and auditable — the same ethos as the distribution refresh.
 */

export interface CommitmentParty {
  address: string;
  /** Agreed share of the deliverable, set at creation. Must be > 0. */
  share: number;
}

export interface CreateCommitmentParams {
  deliverable: string;
  parties: CommitmentParty[];
  category: string;
  deadline: number;
  week: number;
}

export type CommitmentState = 'agreed' | 'kept' | 'broken';

export interface Commitment {
  id: number;
  deliverable: string;
  parties: CommitmentParty[];
  category: string;
  deadline: number;
  week: number;
  state: CommitmentState;
}

/** A contribution record — feedable straight into DirichletWeights.addContribution. */
export interface AttributionRecord {
  address: string;
  amount: number;
  category: string;
  week: number;
}

export class CommitmentModel {
  private commitments: Map<number, Commitment> = new Map();
  private nextId: number = 1;

  createCommitment(params: CreateCommitmentParams): number {
    // Commitment-first: real parties with agreed positive shares, up front.
    if (params.parties.length === 0) {
      throw new Error('Commitment needs at least one party');
    }
    if (params.parties.some((p) => p.share <= 0)) {
      throw new Error('Every party must have a positive agreed share');
    }
    const id = this.nextId++;
    this.commitments.set(id, { id, ...params, state: 'agreed' });
    return id;
  }

  /**
   * Mark a commitment kept. Attribution accrues to each party proportional to
   * the share agreed at creation.
   */
  markKept(id: number, week: number, now: number): AttributionRecord[] {
    const commitment = this.commitments.get(id);
    if (!commitment) {
      throw new Error(`Commitment ${id} not found`);
    }
    if (commitment.state !== 'agreed') {
      // No double credit: a commitment already kept (or broken) cannot be kept again.
      throw new Error(`Commitment ${id} already ${commitment.state}`);
    }
    if (now > commitment.deadline) {
      // Kept late = broken. Credit accrues only to commitments kept on time.
      commitment.state = 'broken';
      throw new Error(
        `Commitment ${id} deadline passed (${now} > ${commitment.deadline}) — broken, no attribution`
      );
    }
    commitment.state = 'kept';
    return commitment.parties.map((party) => ({
      address: party.address,
      amount: party.share,
      category: commitment.category,
      week,
    }));
  }
}

export default CommitmentModel;
