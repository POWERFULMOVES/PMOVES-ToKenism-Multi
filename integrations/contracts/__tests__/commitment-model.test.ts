/**
 * Commitment primitive tests (token-structure refresh §4.4).
 *
 * A commitment: parties agree a deliverable and their shares UP FRONT, and only
 * when the commitment is KEPT does attribution accrue to them — credit flows
 * from kept commitments, not from capital or mere participation. Generalizes the
 * GroupPurchase escrow from "pool money to buy goods" to "agree a deliverable,
 * keep it, earn attribution". See pmoves/docs/architecture/TOKEN_STRUCTURE_REFRESH.md.
 */

import { CommitmentModel } from '../commitment-model';
import { DirichletWeights } from '../chit/dirichlet-weights';

describe('CommitmentModel', () => {
  it('attributes a kept commitment to each party by their agreed share', () => {
    const commitments = new CommitmentModel();
    const id = commitments.createCommitment({
      deliverable: 'run the block lemonade stand on Saturday',
      parties: [
        { address: '0xALICE', share: 3 },
        { address: '0xBOB', share: 1 },
      ],
      category: 'popup',
      deadline: 2000,
      week: 1,
    });

    // Kept on time (now <= deadline).
    const records = commitments.markKept(id, 1000);

    const alice = records.find((r) => r.address === '0xALICE')!;
    const bob = records.find((r) => r.address === '0xBOB')!;
    // Attribution is proportional to the share agreed at creation.
    expect(alice.amount / bob.amount).toBeCloseTo(3, 6);
  });

  it('rejects keeping a commitment after its deadline (a broken commitment earns nothing)', () => {
    const commitments = new CommitmentModel();
    const id = commitments.createCommitment({
      deliverable: 'x',
      parties: [{ address: '0xA', share: 1 }],
      category: 'popup',
      deadline: 500,
      week: 1,
    });

    // now (1000) is past the deadline (500) — the commitment was not kept in time.
    expect(() => commitments.markKept(id, 1000)).toThrow(/deadline/i);
  });

  it('rejects a commitment with no parties or a non-positive share', () => {
    const commitments = new CommitmentModel();
    const base = { deliverable: 'x', category: 'popup', deadline: 1000, week: 1 };

    expect(() => commitments.createCommitment({ ...base, parties: [] })).toThrow();
    expect(() =>
      commitments.createCommitment({ ...base, parties: [{ address: '0xA', share: 0 }] })
    ).toThrow();
  });

  it('rejects a NaN or Infinity share (would poison the whole attribution category)', () => {
    const commitments = new CommitmentModel();
    const base = { deliverable: 'x', category: 'popup', deadline: 1000, week: 1 };

    expect(() =>
      commitments.createCommitment({ ...base, parties: [{ address: '0xA', share: NaN }] })
    ).toThrow();
    expect(() =>
      commitments.createCommitment({ ...base, parties: [{ address: '0xA', share: Infinity }] })
    ).toThrow();
  });

  it('rejects duplicate party addresses in one commitment (anti-gaming)', () => {
    const commitments = new CommitmentModel();
    expect(() =>
      commitments.createCommitment({
        deliverable: 'x',
        parties: [
          { address: '0xA', share: 1 },
          { address: '0xA', share: 2 },
        ],
        category: 'popup',
        deadline: 1000,
        week: 1,
      })
    ).toThrow(/duplicate/i);
  });

  it('cannot be kept twice (no double credit)', () => {
    const commitments = new CommitmentModel();
    const id = commitments.createCommitment({
      deliverable: 'x',
      parties: [{ address: '0xA', share: 1 }],
      category: 'popup',
      deadline: 2000,
      week: 1,
    });

    commitments.markKept(id, 1000);
    expect(() => commitments.markKept(id, 1000)).toThrow(/already|kept/i);
  });

  it('attributes at the commitment agreed week (no caller-supplied week to decouple)', () => {
    const commitments = new CommitmentModel();
    const id = commitments.createCommitment({
      deliverable: 'x',
      parties: [{ address: '0xA', share: 1 }],
      category: 'popup',
      deadline: 2000,
      week: 7,
    });

    const records = commitments.markKept(id, 1000);

    // Attribution belongs to the week the commitment was agreed, not to anything
    // the caller could pass in independently.
    expect(records[0].week).toBe(7);
  });

  // Integration: the kept commitment IS the contribution source that feeds
  // Dirichlet attribution — which (per PR #53) drives token distribution.
  it('feeds Dirichlet attribution proportionally when its records are recorded', () => {
    const commitments = new CommitmentModel();
    const id = commitments.createCommitment({
      deliverable: 'staff the stand',
      parties: [
        { address: '0xALICE', share: 3 },
        { address: '0xBOB', share: 1 },
      ],
      category: 'popup',
      deadline: 2000,
      week: 1,
    });
    const records = commitments.markKept(id, 1000);

    const dirichlet = new DirichletWeights();
    for (const r of records) dirichlet.addContribution(r.address, r.amount, r.category, r.week);

    const attribution = dirichlet.getExpectedAttribution('popup');
    const alice = attribution.find((a) => a.address === '0xALICE')!;
    const bob = attribution.find((a) => a.address === '0xBOB')!;
    expect(alice.weight).toBeGreaterThan(bob.weight);
    // Weights are a valid distribution and everyone who committed gets a share (D12).
    expect(alice.weight + bob.weight).toBeCloseTo(1, 6);
    expect(bob.weight).toBeGreaterThan(0);
  });
});
