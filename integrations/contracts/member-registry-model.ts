// contracts/member-registry-model.ts
import { EligibleMember } from './equalweight-governor-model';

export interface MemberRegistryConfig {
  // NOTE: `committeeSize` is only a constructor-time bound-check input for `committeeThreshold`
  // (see the constructor: threshold must be <= this value). It does NOT constrain the actual
  // committee membership installed later via `setCommittee` — that set's size can differ from
  // (and is not validated against) `committeeSize`.
  committeeSize: number;
  committeeThreshold: number;
}

export interface MembershipCredential {
  member: EligibleMember;
  status: 'active' | 'revoked';
  approvers: string[];
  signature: string;
}

export class MemberRegistryModel {
  private config: MemberRegistryConfig;
  private committee: Set<string> = new Set();
  private members: Map<string, MembershipCredential> = new Map();

  constructor(config: Partial<MemberRegistryConfig> = {}) {
    this.config = { committeeSize: 3, committeeThreshold: 2, ...config };
    if (this.config.committeeThreshold < 1) {
      throw new Error('committeeThreshold must be >= 1');
    }
    if (this.config.committeeThreshold > this.config.committeeSize) {
      throw new Error('committeeThreshold must be <= committeeSize');
    }
  }

  // TRUSTED GENESIS: this constitutes the election committee. The anti-chokepoint
  // (no-single-party) guarantee this registry provides holds GIVEN a trustworthily-constituted
  // committee — it does not itself vet or bootstrap trust in the committee membership.
  // Runtime committee rotation (adding/removing committee members under M-of-N approval of the
  // existing committee) is a later arc stage and is intentionally out of scope here.
  setCommittee(ids: string[]): void {
    this.committee = new Set(ids);
  }

  private assertCommitteeApproval(approvers: string[]): string[] {
    const unique = Array.from(new Set(approvers));
    for (const a of unique) {
      if (!this.committee.has(a)) {
        throw new Error(`Approver ${a} is not on the committee`);
      }
    }
    if (unique.length < this.config.committeeThreshold) {
      throw new Error(
        `Below committee threshold: ${unique.length} approvers < ${this.config.committeeThreshold}`
      );
    }
    return unique;
  }

  // Enrolling an already-active member intentionally OVERWRITES its existing credential. This is
  // also the mechanism for a committee-approved re-enrol/update (e.g. changed units/shares) and
  // for reactivating a member after revoke — there is no separate "update" or "reactivate" path.
  enrol(member: EligibleMember, approvers: string[]): MembershipCredential {
    const unique = this.assertCommitteeApproval(approvers);
    // Shallow-copy the member so the registry does not hold a live reference to the caller's
    // object — mutating the caller's original after enrolling must not affect the registry.
    const credential: MembershipCredential = {
      member: { ...member },
      status: 'active',
      approvers: unique,
      signature: `stub-mofn:${member.id}`,
    };
    this.members.set(member.id, credential);
    return credential;
  }

  isEligible(id: string): boolean {
    return this.members.get(id)?.status === 'active';
  }

  revoke(memberId: string, approvers: string[]): void {
    const existing = this.members.get(memberId);
    if (!existing || existing.status !== 'active') {
      throw new Error(`${memberId} is not an active member`);
    }
    this.assertCommitteeApproval(approvers);
    existing.status = 'revoked';
  }

  roll(): EligibleMember[] {
    // Return shallow copies, not the stored references — callers mutating the returned array's
    // entries must not be able to corrupt the registry's internal state.
    return Array.from(this.members.values())
      .filter((c) => c.status === 'active')
      .map((c) => ({ ...c.member }));
  }
}
