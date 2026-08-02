# Stage 4b — Tiered Verifiable Tally + `voter-card.v1`

**Date:** 2026-08-02 · **Status:** DESIGN — nothing here is built · **Supersedes:** nothing
**Continues:** `2026-07-18-mode-a-tally-ingestion-design.md` (stage 4a)
**Informs:** `pmoves/docs/pilots/fordham-hill/08-voter-identity-key-custody.md`
**Legal:** every binding-vote clause routes to counsel. This document decides
architecture, not authority.

## 0. The gap this closes

Stage 4a landed `ingestSecretTally(proposalId, counts, currentWeek)`. It accepts
**caller-supplied counts**. `ballotRef.receiptLogDigest` binds *which* ballot the
counts claim to summarize, but nothing proves the counts *derive* from those
receipts. `mode-a-tally.ts:11` says so outright:

> the proof that counts CORRESPOND to receipts is stage 4b — this only binds
> which ballot

So today whoever runs the tallying browser can assert any numbers with a
valid-looking digest. Stage 4b makes the counts provable.

## 1. Scope — a framework, not a Fordham feature

This is **not** a co-op voting feature. It is the primitive by which any group —
two coworkers organizing, a household picking dinner, a tenants' association, a
swarm of agents — can hold a decision and know the result was not fabricated.

The design must therefore serve, without forking:

- **2 voters** and **500 voters**
- **zero stakes** (dinner) and **maximum stakes** (union card an employer wants
  to see, board election an incumbent wants to win)
- **humans and agents** as voters

## 2. The load-bearing idea: constant contract, tiered evidence

`computeSecretOutcome` already consumes exactly three public facts —
`votesFor`, `votesAgainst`, and `voterCount`/`eligibleCount`. **Those never
change.** What changes with stakes is only *what evidence backs those numbers*.

> **The tally contract is constant. The assurance tier is a parameter.**

| Tier | Evidence | Ceremony | Fits |
|------|----------|----------|------|
| **T0 open** | Plaintext ballots, all public | none | dinner, agent poll, rehearsal |
| **T1 attested** | M-of-N committee threshold-signs the tally | choose a committee | club, team, small co-op |
| **T2 verifiable** | Homomorphic sum + threshold decryption + ZK well-formedness proofs | key ceremony | union card, board election, anything adversarial |

T1 exists today (`tally-signer-ed25519.ts`). T0 is nearly free. **4b builds T2 and
the tier parameter that makes all three one system.**

### 2.1 Tier is carried, never inferred

Every `TallyResult` carries its tier. A verifier can always tell which tier
produced a number, and a consumer can *require* a tier and refuse a weaker one.

This is non-negotiable: a T0 result must never be mistakable for a T2 one. The
failure mode this prevents is the whole reason the ladder is safe to offer.

### 2.2 Why tiering, rather than "just do T2"

A protocol that demands a threshold-key ceremony for every decision is used for
no decisions. The two coworkers never reach T2 because they never start at T0.
The ramp is the product: a household that has voted on dinner fifty times
already understands ballots, credentials, and "check that your vote counted"
*before* the stakes are real.

This mirrors machinery PMOVES already has — `rehearsal → live` is a tier
transition, and P7's gated promotion is the shape of "this room has earned T2."

## 3. T2 protocol (approach A — homomorphic, threshold-decrypted)

1. **Encrypt.** The voter's device encrypts the choice under the committee's
   **threshold public key**.
2. **Prove.** It attaches a zero-knowledge proof that the ciphertext is
   well-formed — a valid choice, not an arbitrary integer. Without this a single
   voter can add 1,000,000 to a total.
3. **Sign + publish.** The encrypted ballot is signed by the voter's
   `voter-card.v1` credential and posted to a public bulletin board.
4. **Sum.** *Anyone* homomorphically sums the ciphertexts. No trust required.
5. **Decrypt the sum only.** The committee threshold-decrypts the **total** and
   publishes a proof of correct decryption. No individual ballot is ever
   decrypted.

### 3.1 The counter-intuitive part: voter identity is public

T2 does **not** hide *who voted*. It hides *how they voted*. That is the
distinction that makes everything else work:

- `voterCount` = distinct credentials on the board — **publicly countable**
- `eligibleCount` = `MemberRegistry` size — **publicly countable**
- one-vote-per-member — **publicly enforceable**, no trusted party

…all while choices stay encrypted. Attempting to hide the voter *too* forces
blind-signature designs, which cannot support revoting (§4.1).

### 3.2 What a colluding committee can and cannot do

- **Cannot** forge counts — the sum is recomputable by anyone from published
  ciphertexts, and the decryption proof is checkable.
- **Can** refuse to decrypt (denial of service, visible and attributable).
- **Can** lie about the **paper** slice (§5) — which is why that slice is
  labelled separately.

## 4. Coercion resistance: revoting

A voter may recast during the open window; **only the final ballot counts.**

A coerced ballot can be silently superseded, so a receipt proves nothing about
the voter's *final* choice and a coercer gains no reliable leverage. This is the
Helios/Belenios lineage and needs no crypto beyond what T2 already requires.

### 4.1 Why this rules out blind-signature tokens

Blind-signed eligibility tokens are single-use by construction. Supporting
revoting means linking the new ballot to the old one — destroying the
unlinkability the token existed to provide. Revoting and token-unlinkability are
incompatible; revoting wins because coercion is the live threat.

### 4.2 Implementation

Supersession is a **bulletin-board rule**, not new cryptography: retain the
latest ballot per credential. Superseded ballots stay published (so the board
remains auditable) but are excluded from the sum by a publicly-checkable rule.

**Open sub-question for implementation:** whether revote *counts* per voter are
public. A voter who revoted 6 times is conspicuous, which is itself a weak
coercion signal. Recommend publishing only "superseded: yes/no", not a count.

## 5. Paper ballots — first-class franchise, labelled evidence

Doc 08 makes paper a first-class equal path ("a lost device is not a lost
franchise"). Paper cannot produce ciphertexts or ZK proofs.

**Resolution:** paper ballots are counted by the committee and entered as **one
attested aggregate**, published as a distinct, clearly-labelled input to the
final result.

- The electronic portion remains **end-to-end verifiable**.
- The paper portion is **committee-attested only**, and says so.
- Anyone can see exactly how many votes rest on the committee's word.

This is deliberately an honest partial guarantee. Paper remains an equal
**franchise**; it is not an equal **proof**. Any UI or report that renders a
mixed result MUST show the split. Collapsing them into one number would launder
committee-attested votes as universally-verified ones.

## 6. `voter-card.v1` (folds in carry-over 4)

Today `MemberRegistry` stores the literal string stub `stub-mofn:${member.id}`
(`member-registry-model.ts:74`). `voter-card.v1` replaces it. Repo-wide it
currently has **zero code references** — it exists only in prose.

### 6.1 One format, three issuance ceremonies

The card format never changes; only how strongly it is bound to a human.

| Tier | Issuance |
|------|----------|
| T0 | self-asserted device key |
| T1 | committee-issued, M-of-N, remote acceptable |
| T2 | committee-issued, human-witnessed, in person, recorded on an append-only committee-signed log |

### 6.2 Invariants

- **Public material only** — public key, election scope, issuance attestation.
  No private key is ever custodied by an operator or a server (doc 08 §3).
- **Distinct from `signing-card.v1`**, which identifies *agents*. An agent
  signing card can never establish resident voting eligibility
  (`04-governance-bylaws-scaffold.md:69`).
- **Election-scoped.** The same person's cards in two different elections are
  cryptographically unlinkable. This matters when one organizing body would like
  the membership list of another.
- **Decoupled from contribution and tokens.** Mode-A eligibility never derives
  from Mode-B holdings. Deriving the roll from holdings would re-couple
  governance to wealth and break doc 08's unlinkability invariant.

## 7. Downstream consumers (seam only — not designed here)

Recorded so the tally record is *shaped* to serve these later without
re-issuing credentials. **None of this is built by 4b.**

- **Smart contracts.** A T2 tally is self-verifying — ciphertexts, proofs,
  threshold signature. That is what an on-chain contract needs as a trustworthy
  input, and it is the honest replacement for `CoopGovernor.sol`'s quadratic
  stake voting, which cannot express one-member-one-vote
  (`CoopGovernor.sol:72`) or a roll-percentage quorum (`:96`). Because the tier
  travels with the tally, a contract can require T2 and reject T0.
- **Verifiable contribution attribution.** "Traceable to real work" is a
  *verifiability* claim: it holds only if a hostile outsider can recompute the
  attribution. That is this same ladder applied to contribution rather than
  choice. At T1 an attribution claim is only as honest as its committee.
- **Commitment, not vote-weight.** Any "skin in the game" mechanism sits
  *beside* the ballot, never inside it. Stake-weighted voting is plutocracy and
  contradicts `EqualWeightGovernor`.

**Regulatory note.** Monetary instruments built on top (stablecoins, treasury-
backed assets) are regulated financial products gated on counsel, not on this
design. Doc 08's legal register already lists securities/token characterization
as counsel-gated. The verification layer ships without asking anyone; the
monetary layer does not. Keeping them separate is what protects the former.

## 8. Testing

Follows the stage 1–4a pattern (`__tests__/*.test.ts`, currently 116 passing).

- **Tier isolation** — a T0 result can never present as T1/T2; consumers
  requiring T2 reject lower tiers.
- **Homomorphic correctness** — sum of ciphertexts decrypts to sum of
  plaintexts, across the 2-voter and 500-voter extremes.
- **Well-formedness** — a ballot encrypting an out-of-range value is rejected;
  the "add 1,000,000" attack fails.
- **Revoting** — only the final ballot counts; superseded ballots stay published
  but are excluded by a publicly-checkable rule; ordering is deterministic.
- **Paper split** — mixed results always report electronic and paper
  separately; no path collapses them.
- **Adversarial** — forged counts fail verification; a colluding committee
  cannot alter the electronic sum; a wrong-election `voter-card` is rejected.
- **Degenerate scale** — 2 eligible / 1 voter, and unanimous / zero-turnout,
  produce correct quorum outcomes.

## 9. Explicitly NOT in scope

- The coin, the stablecoin, treasury access (§7 regulatory note)
- Wiring Dirichlet attribution into token distribution (known open gap)
- Replacing `CoopGovernor.sol` on-chain
- Ranked-choice or multi-seat elections (T2 here is single-question;
  a mix-net would be the primitive for those)
- Any claim of legal authority for a binding election

## 10. Open questions for the operator

1. **Committee composition at T2** — who holds threshold key shares, and what
   is the M-of-N? Nobody can compute a result if too many shares are lost.
2. **Revote visibility** (§4.2) — publish counts, or only a superseded flag?
3. **Tier promotion authority** — who decides a room has earned T2? P7's gated
   promotion is the natural mechanism, but the *authority* is a governance
   question.
4. **Agent voters** — do agents vote in the same roll as humans, or a separate
   chamber? Affects whether `eligibleCount` mixes them.
