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
});
