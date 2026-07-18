// contracts/member-registry-model.ts
import { EligibleMember } from './equalweight-governor-model';

export interface MemberRegistryConfig {
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

  enrol(member: EligibleMember, approvers: string[]): MembershipCredential {
    const unique = this.assertCommitteeApproval(approvers);
    const credential: MembershipCredential = {
      member,
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
    return Array.from(this.members.values())
      .filter((c) => c.status === 'active')
      .map((c) => c.member);
  }
}
