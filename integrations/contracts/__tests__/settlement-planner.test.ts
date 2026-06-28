import {
  createSettlementRequestedEvent,
  planTokenSettlement,
} from '../settlement-planner';
import type { CGPDocument } from '../chit';

const MERKLE_ROOT = `0x${'a'.repeat(64)}`;

function sampleCgp(weights = [0.6, 0.4]): CGPDocument {
  return {
    spec: 'chit.cgp.v1.0',
    summary: 'weekly settlement sample',
    created_at: '2026-05-22T00:00:00Z',
    meta: {
      namespace: 'pmoves.tokenism',
      simulation_week: 12,
    },
    attribution: {
      dirichlet_alpha: [60.1, 40.1],
      total_alpha: 100.2,
      merkle_root: MERKLE_ROOT,
      week: 12,
      timestamp: '2026-05-22T00:00:00Z',
      contributors: [
        {
          address: '0xALICE',
          weight: weights[0],
          raw_contribution: 60,
          action_type: 'token_received',
          category: 'grotoken',
          proof: {
            leaf_hash: `0x${'b'.repeat(64)}`,
            path: [],
            root: MERKLE_ROOT,
          },
        },
        {
          address: '0xBOB',
          weight: weights[1],
          raw_contribution: 40,
          action_type: 'token_received',
          category: 'grotoken',
          proof: {
            leaf_hash: `0x${'c'.repeat(64)}`,
            path: [],
            root: MERKLE_ROOT,
          },
        },
      ],
    },
    super_nodes: [],
  };
}

describe('settlement planner', () => {
  it('creates deterministic settlement instructions with idempotency keys', () => {
    const config = {
      totalRewardPool: 1000,
      createdAt: '2026-05-22T01:00:00Z',
      sourceId: 'weekly-cgp-12',
    };

    const first = planTokenSettlement(sampleCgp(), config);
    const second = planTokenSettlement(sampleCgp(), config);

    expect(first).toEqual(second);
    expect(first.settlement_id).toMatch(/^settlement_[a-f0-9]{16}$/);
    expect(first.cgp_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.week).toBe(12);
    expect(first.source_subject).toBe('tokenism.cgp.weekly.v1');
    expect(first.totals).toEqual({
      instruction_count: 2,
      amount: 1000,
      asset: 'GRO',
    });
    expect(first.instructions.map((instruction) => instruction.amount)).toEqual([600, 400]);
    expect(first.instructions[0].idempotency_key).toContain('tokenism:weekly-grotoken-v1:week-12:0xalice');
    expect(new Set(first.instructions.map((instruction) => instruction.idempotency_key)).size).toBe(2);
  });

  it('normalizes contributor weights and allocates rounding residue deterministically', () => {
    const batch = planTokenSettlement(sampleCgp([6, 4]), {
      totalRewardPool: 1,
      precision: 2,
      createdAt: '2026-05-22T01:00:00Z',
    });

    expect(batch.instructions.map((instruction) => instruction.amount)).toEqual([0.6, 0.4]);
    expect(batch.totals.amount).toBe(1);
  });

  it('requires a Merkle root when configured for proof-backed settlement', () => {
    const cgp = sampleCgp();
    delete cgp.attribution?.merkle_root;
    cgp.attribution?.contributors.forEach((contributor) => {
      if (contributor.proof) delete contributor.proof.root;
    });

    expect(() =>
      planTokenSettlement(cgp, {
        totalRewardPool: 100,
        requireMerkleRoot: true,
      })
    ).toThrow('Cannot plan settlement without a CGP Merkle root');
  });

  it('wraps a planned batch in a signed requested event', () => {
    const batch = planTokenSettlement(sampleCgp(), {
      totalRewardPool: 100,
      createdAt: '2026-05-22T01:00:00Z',
    });

    const event = createSettlementRequestedEvent(batch, {
      agentId: 'PMOVES-AGENT-ZERO-CODEX',
      signature: {
        alg: 'HMAC-SHA256',
        kid: 'agent-zero-test',
        hmac: 'abc123',
      },
    });

    expect(event.agent_id).toBe('PMOVES-AGENT-ZERO-CODEX');
    expect(event.signature.kid).toBe('agent-zero-test');
    expect(event.instructions).toHaveLength(2);
  });
});
