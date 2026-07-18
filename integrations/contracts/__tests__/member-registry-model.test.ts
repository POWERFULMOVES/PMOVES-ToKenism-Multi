// contracts/__tests__/member-registry-model.test.ts
import { MemberRegistryModel } from '../member-registry-model';
import { EqualWeightGovernorModel } from '../equalweight-governor-model';

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

  it('roll() returns defensive copies: mutating a returned member does not affect the registry', () => {
    const r = withCommittee();
    const original = { id: '0xA', units: 1 };
    r.enrol(original, ['0xC1', '0xC2']);

    // Mutate the object returned by roll() — this must not corrupt the registry's stored copy.
    const first = r.roll();
    (first[0] as { units: number }).units = 999;
    const second = r.roll();
    expect(second[0].units).toBe(1);

    // Mutate the ORIGINAL object passed into enrol AFTER enrolling — the registry must have
    // already severed its reference to it.
    original.units = 42;
    expect(r.roll()[0].units).toBe(1);
  });

  it('roll() drives the governor: only enrolled members can vote', () => {
    const r = withCommittee();
    r.enrol({ id: '0xA' }, ['0xC1', '0xC2']);
    r.enrol({ id: '0xB' }, ['0xC1', '0xC2']);

    const gov = new EqualWeightGovernorModel();
    gov.setRoll(r.roll());
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', false);

    const t = gov.tally('p');
    expect(t.eligibleCount).toBe(2);
    expect(t.votesFor).toBe(1);
    expect(t.votesAgainst).toBe(1);
    // a member NOT on the registry roll is rejected by the governor
    expect(() => gov.castVote('p', '0xSTRANGER', true)).toThrow(/roll|eligible/i);
  });
});
