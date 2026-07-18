// contracts/__tests__/member-registry-model.test.ts
import { MemberRegistryModel } from '../member-registry-model';

describe('MemberRegistryModel', () => {
  const withCommittee = (config = {}) => {
    const r = new MemberRegistryModel(config);
    r.setCommittee(['0xC1', '0xC2', '0xC3']);
    return r;
  };

  it('enrol requires k-of-n committee approval', () => {
    const r = withCommittee();
    expect(() => r.enrol({ id: '0xA' }, ['0xC1'])).toThrow(/threshold|approv/i);
    const cred = r.enrol({ id: '0xA' }, ['0xC1', '0xC2']);
    expect(cred.status).toBe('active');
    expect(r.isEligible('0xA')).toBe(true);
  });

  it('rejects a duplicate approver (dedupe below threshold)', () => {
    const r = withCommittee();
    expect(() => r.enrol({ id: '0xA' }, ['0xC1', '0xC1'])).toThrow(/threshold/i);
  });

  it('rejects an approver not on the committee', () => {
    const r = withCommittee();
    expect(() => r.enrol({ id: '0xA' }, ['0xC1', '0xSTRANGER'])).toThrow(/committee/i);
  });

  it('validates committee config bounds', () => {
    expect(() => new MemberRegistryModel({ committeeThreshold: 0 })).toThrow();
    expect(() => new MemberRegistryModel({ committeeThreshold: 4, committeeSize: 3 })).toThrow();
  });

  it('revoke requires k-of-n and removes the member from the roll', () => {
    const r = withCommittee();
    r.enrol({ id: '0xA' }, ['0xC1', '0xC2']);
    expect(() => r.revoke('0xA', ['0xC1'])).toThrow(/threshold/i);
    r.revoke('0xA', ['0xC1', '0xC2']);
    expect(r.isEligible('0xA')).toBe(false);
    expect(r.roll().map((m) => m.id)).not.toContain('0xA');
  });

  it('rejects revoking a non-member', () => {
    const r = withCommittee();
    expect(() => r.revoke('0xNOBODY', ['0xC1', '0xC2'])).toThrow(/not an active member/i);
  });

  it('roll() returns only active members', () => {
    const r = withCommittee();
    r.enrol({ id: '0xA' }, ['0xC1', '0xC2']);
    r.enrol({ id: '0xB' }, ['0xC1', '0xC2']);
    r.revoke('0xB', ['0xC1', '0xC2']);
    expect(r.roll().map((m) => m.id).sort()).toEqual(['0xA']);
  });
});
