# New Smart Contracts Proposal

Proposed additions to the PMOVES ToKenism contract ecosystem to enhance functionality and user engagement.

## Current Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ContractCoordinator                         │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│  GroToken   │  FoodUSD    │ GroupBuying │  GroVault   │Gov  │
│ (Rewards)   │ (Spending)  │  (Savings)  │ (Staking)   │     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────┘
```

## Proposed New Contracts

### 1. RewardsPool (`rewardspool-model.ts`)

**Purpose:** Distributes ecosystem fees back to active participants

**Key Features:**
- Collects fees from transactions (0.1-0.5%)
- Distributes rewards proportionally to GroToken stakers
- Epoch-based distribution (weekly)
- Boosted rewards for long-term stakers

**Interface:**
```typescript
export interface RewardsPoolConfig {
  feePercentage: number;        // 0.001 = 0.1%
  distributionFrequency: number; // weeks
  stakingBoostMultiplier: number;
  minStakeForRewards: number;
}

export interface RewardsClaim {
  address: string;
  epoch: number;
  amount: number;
  boostApplied: number;
}
```

**Integration Points:**
- Receives fees from FoodUSD transactions
- Reads staking data from GroVault
- Coordinates with CoopGovernor for policy changes

---

### 2. MembershipNFT (`membership-nft-model.ts`)

**Purpose:** Non-fungible membership tokens with tier-based benefits

**Key Features:**
- Bronze/Silver/Gold/Platinum tiers
- Tier upgrades based on participation
- Transferable with cooldown period
- Special voting weights for higher tiers

**Interface:**
```typescript
export interface MembershipTier {
  name: 'bronze' | 'silver' | 'gold' | 'platinum';
  minParticipationWeeks: number;
  minTokenBalance: number;
  votingMultiplier: number;
  rewardsBoost: number;
  groupBuyingPriority: number;
}

export interface MembershipNFT {
  tokenId: number;
  owner: string;
  tier: MembershipTier;
  mintedAt: number;
  lastUpgrade: number;
  transferCooldown: number;
}
```

**Benefits by Tier:**
| Tier | Min Weeks | Min GRO | Vote Boost | Rewards Boost |
|------|-----------|---------|------------|---------------|
| Bronze | 4 | 1 | 1.0x | 0% |
| Silver | 12 | 5 | 1.25x | 10% |
| Gold | 26 | 15 | 1.5x | 25% |
| Platinum | 52 | 50 | 2.0x | 50% |

---

### 3. LoyaltyPoints (`loyalty-points-model.ts`)

**Purpose:** Time-weighted loyalty rewards system

**Key Features:**
- Earn points for every FoodUSD transaction
- Bonus points for consecutive weekly activity
- Points never expire but decay if inactive
- Redeemable for GroToken or GroupBuying discounts

**Interface:**
```typescript
export interface LoyaltyConfig {
  pointsPerDollar: number;       // 1 point per $10 spent
  streakBonusMultiplier: number; // 1.1x per week streak
  maxStreakBonus: number;        // 2.0x max
  decayRatePerWeek: number;      // 5% decay if inactive
  redemptionRate: number;        // 100 points = 1 GRO
}

export interface LoyaltyAccount {
  address: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityWeek: number;
  totalRedeemed: number;
}
```

**Point Earning:**
```
points = (spending / 10) * (1 + min(streak * 0.1, maxBonus))
```

---

### 4. ReferralNetwork (`referral-network-model.ts`)

**Purpose:** Track and reward member referrals for network growth

**Key Features:**
- Unique referral codes per member
- Two-tier referral rewards (direct + indirect)
- Anti-gaming protections (activity requirements)
- Network visualization data

**Interface:**
```typescript
export interface ReferralConfig {
  directRewardGRO: number;       // 0.5 GRO per active referral
  indirectRewardGRO: number;     // 0.1 GRO for referral's referrals
  activationThreshold: number;   // 4 weeks active to count
  maxRewardsPerWeek: number;     // Cap gaming
}

export interface ReferralNode {
  address: string;
  referralCode: string;
  referredBy: string | null;
  referrals: string[];
  totalRewardsEarned: number;
  activeReferralCount: number;
}
```

**Reward Distribution:**
```
Direct:   Referrer gets 0.5 GRO when referral completes 4 weeks
Indirect: Referrer gets 0.1 GRO when referral's referral activates
```

---

### 5. InsuranceFund (`insurance-fund-model.ts`)

**Purpose:** Emergency fund for price stability and member protection

**Key Features:**
- Treasury-managed reserve fund
- Automatic deposits from transaction fees
- Triggers during high volatility events
- Covers member losses during system issues

**Interface:**
```typescript
export interface InsuranceFundConfig {
  targetReserveRatio: number;    // 5% of total value locked
  feeContribution: number;       // 0.05% of transactions
  triggerThreshold: number;      // 10% price deviation
  maxPayoutPerEvent: number;     // 1000 FoodUSD per member
}

export interface InsuranceEvent {
  eventId: number;
  eventType: 'price_deviation' | 'system_failure' | 'fraud';
  totalPayout: number;
  affectedMembers: string[];
  timestamp: number;
}
```

---

### 6. SeasonalChallenges (`seasonal-challenges-model.ts`)

**Purpose:** Gamified seasonal events to boost engagement

**Key Features:**
- Quarterly challenges with bonus rewards
- Team-based and individual goals
- Leaderboards with prizes
- Special limited NFTs for winners

**Interface:**
```typescript
export interface Challenge {
  id: number;
  name: string;
  description: string;
  startWeek: number;
  endWeek: number;
  type: 'spending' | 'saving' | 'governance' | 'referral';
  target: number;
  rewardPool: number;
}

export interface ChallengeProgress {
  challengeId: number;
  participantAddress: string;
  currentProgress: number;
  percentComplete: number;
  rank: number;
  rewardEarned: number;
}
```

---

## Implementation Priority

| Priority | Contract | Complexity | Impact | Dependencies |
|----------|----------|------------|--------|--------------|
| 1 | RewardsPool | Medium | High | GroVault, FoodUSD |
| 2 | LoyaltyPoints | Low | High | FoodUSD |
| 3 | MembershipNFT | Medium | Medium | All contracts |
| 4 | ReferralNetwork | Medium | Medium | GroToken |
| 5 | InsuranceFund | High | Low | Treasury |
| 6 | SeasonalChallenges | Medium | Medium | All contracts |

## Integration with Existing Coordinator

```typescript
// Updated ContractCoordinatorConfig
export interface ContractCoordinatorConfig {
  // Existing
  groToken: GroTokenConfig;
  foodUSD: FoodUSDConfig;
  groupPurchase: GroupPurchaseConfig;
  groVault: GroVaultConfig;
  governance: GovernanceConfig;

  // New
  rewardsPool?: RewardsPoolConfig;
  loyaltyPoints?: LoyaltyConfig;
  membershipNFT?: MembershipNFTConfig;
  referralNetwork?: ReferralConfig;
  insuranceFund?: InsuranceFundConfig;
  seasonalChallenges?: ChallengesConfig;
}
```

## Testing Strategy

Each new contract should include:
1. Unit tests for all public methods
2. Integration tests with coordinator
3. Edge case tests (overflow, underflow, gaming)
4. Simulation tests for economic impact

## Next Steps

1. Review and approve contract designs
2. Implement RewardsPool (highest priority)
3. Add to ContractCoordinator
4. Update dashboard to display new metrics
5. Document in API Reference
