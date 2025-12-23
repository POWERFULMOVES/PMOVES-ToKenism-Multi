import { LoyaltyPointsModel } from '../loyaltypoints-model';

describe('LoyaltyPointsModel', () => {
  let loyalty: LoyaltyPointsModel;

  beforeEach(() => {
    loyalty = new LoyaltyPointsModel({
      pointsPerDollar: 0.1, // 1 point per $10
      streakBonusMultiplier: 0.1, // 10% per week
      maxStreakBonus: 1.0, // 100% max
      decayRatePerWeek: 0.05, // 5% decay
      redemptionRate: 100, // 100 points = 1 GRO
      minRedemptionPoints: 10, // Low threshold for testing
    });

    // Initialize some accounts
    const addresses = Array.from({ length: 10 }, (_, i) => `0xMEMBER${i}`);
    loyalty.initializeAccounts(addresses);
  });

  describe('point earning', () => {
    it('should earn points from spending', () => {
      const points = loyalty.earnPoints('0xMEMBER0', 100, 1);

      expect(points).toBe(10); // $100 * 0.1 = 10 points
    });

    it('should create account if not exists', () => {
      const points = loyalty.earnPoints('0xNEW_MEMBER', 50, 1);

      expect(points).toBe(5);
      expect(loyalty.getAccount('0xNEW_MEMBER')).not.toBeNull();
    });

    it('should accumulate points over multiple transactions', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      loyalty.earnPoints('0xMEMBER0', 50, 1);

      expect(loyalty.getPointsBalance('0xMEMBER0')).toBe(15);
    });
  });

  describe('streak bonus', () => {
    it('should increment streak on consecutive weeks', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(1);

      loyalty.earnPoints('0xMEMBER0', 100, 2);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(2);

      loyalty.earnPoints('0xMEMBER0', 100, 3);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(3);
    });

    it('should apply streak bonus to points', () => {
      const week1Points = loyalty.earnPoints('0xMEMBER0', 100, 1);
      const week2Points = loyalty.earnPoints('0xMEMBER0', 100, 2);

      // Week 2 should have streak bonus (10% for 2-week streak)
      expect(week2Points).toBeGreaterThan(week1Points);
    });

    it('should reset streak on non-consecutive activity', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      loyalty.earnPoints('0xMEMBER0', 100, 2);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(2);

      // Skip week 3
      loyalty.earnPoints('0xMEMBER0', 100, 4);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(1);
    });

    it('should cap streak bonus at max', () => {
      // Build up a long streak
      for (let week = 1; week <= 20; week++) {
        loyalty.earnPoints('0xMEMBER0', 100, week);
      }

      // Points should be capped at 2x (100% bonus)
      const lastPoints = loyalty.earnPoints('0xMEMBER0', 100, 21);
      expect(lastPoints).toBeLessThanOrEqual(20); // Max 2x of 10 base points
    });

    it('should track longest streak', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      loyalty.earnPoints('0xMEMBER0', 100, 2);
      loyalty.earnPoints('0xMEMBER0', 100, 3);

      // Break streak
      loyalty.earnPoints('0xMEMBER0', 100, 10);

      const account = loyalty.getAccount('0xMEMBER0');
      expect(account?.longestStreak).toBe(3);
      expect(account?.currentStreak).toBe(1);
    });
  });

  describe('decay', () => {
    it('should decay points when inactive', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1); // 100 points
      const initialPoints = loyalty.getPointsBalance('0xMEMBER0');

      loyalty.applyDecay(3); // 2 weeks inactive

      const afterDecay = loyalty.getPointsBalance('0xMEMBER0');
      expect(afterDecay).toBeLessThan(initialPoints);
    });

    it('should not decay active accounts', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      const initialPoints = loyalty.getPointsBalance('0xMEMBER0');

      loyalty.applyDecay(1); // Same week - no decay

      expect(loyalty.getPointsBalance('0xMEMBER0')).toBe(initialPoints);
    });

    it('should compound decay over multiple weeks', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      const initialPoints = loyalty.getPointsBalance('0xMEMBER0');

      loyalty.applyDecay(5); // 4 weeks inactive

      const afterDecay = loyalty.getPointsBalance('0xMEMBER0');
      // 5% decay compounded over 4 weeks: 0.95^4 ≈ 0.8145
      expect(afterDecay).toBeCloseTo(initialPoints * Math.pow(0.95, 4), 1);
    });

    it('should reset streak after prolonged inactivity', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      loyalty.earnPoints('0xMEMBER0', 100, 2);
      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(2);

      loyalty.applyDecay(5); // 3 weeks inactive

      expect(loyalty.getCurrentStreak('0xMEMBER0')).toBe(0);
    });
  });

  describe('redemption', () => {
    beforeEach(() => {
      // Give member some points
      loyalty.earnPoints('0xMEMBER0', 1000, 1); // 100 points
    });

    it('should redeem points for GRO', () => {
      const groReward = loyalty.redeemPoints('0xMEMBER0', 50, 1);

      expect(groReward).toBe(0.5); // 50 points / 100 rate = 0.5 GRO
      expect(loyalty.getPointsBalance('0xMEMBER0')).toBe(50);
    });

    it('should track total redeemed', () => {
      loyalty.redeemPoints('0xMEMBER0', 50, 1);

      const account = loyalty.getAccount('0xMEMBER0');
      expect(account?.totalRedeemed).toBe(50);
    });

    it('should fail if insufficient points', () => {
      expect(() => {
        loyalty.redeemPoints('0xMEMBER0', 200, 1);
      }).toThrow('Insufficient points');
    });

    it('should fail if below minimum redemption', () => {
      expect(() => {
        loyalty.redeemPoints('0xMEMBER0', 5, 1);
      }).toThrow('Minimum redemption');
    });

    it('should fail for non-existent account', () => {
      expect(() => {
        loyalty.redeemPoints('0xNONEXISTENT', 50, 1);
      }).toThrow('Account not found');
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.earnPoints('0xMEMBER1', 500, 1);
      loyalty.earnPoints('0xMEMBER0', 500, 2); // Build streak

      const stats = loyalty.getStatistics();

      expect(stats.totalAccounts).toBe(10); // Initialized accounts
      expect(stats.totalPointsEarned).toBeGreaterThan(0);
      expect(stats.activeAccounts).toBe(2);
    });

    it('should track points in circulation', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.redeemPoints('0xMEMBER0', 30, 1);

      const stats = loyalty.getStatistics();

      expect(stats.totalPointsInCirculation).toBe(70);
      expect(stats.totalPointsRedeemed).toBe(30);
    });

    it('should track decayed points', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.applyDecay(5);

      const stats = loyalty.getStatistics();

      expect(stats.totalPointsDecayed).toBeGreaterThan(0);
    });

    it('should calculate average streak', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);
      loyalty.earnPoints('0xMEMBER0', 100, 2);
      loyalty.earnPoints('0xMEMBER0', 100, 3);
      loyalty.earnPoints('0xMEMBER1', 100, 3);

      const stats = loyalty.getStatistics();

      expect(stats.averageStreak).toBeGreaterThan(0);
      expect(stats.longestStreak).toBe(3);
    });
  });

  describe('events', () => {
    it('should record earn events', () => {
      loyalty.earnPoints('0xMEMBER0', 100, 1);

      const events = loyalty.getEventsForAddress('0xMEMBER0');

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('earn');
    });

    it('should record decay events', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.applyDecay(5);

      const events = loyalty.getEventsForAddress('0xMEMBER0');
      const decayEvents = events.filter(e => e.eventType === 'decay');

      expect(decayEvents.length).toBeGreaterThan(0);
    });

    it('should record redeem events', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.redeemPoints('0xMEMBER0', 50, 1);

      const events = loyalty.getEventsForAddress('0xMEMBER0');
      const redeemEvents = events.filter(e => e.eventType === 'redeem');

      expect(redeemEvents.length).toBe(1);
      expect(redeemEvents[0].points).toBe(-50);
    });
  });

  describe('export data', () => {
    it('should export complete data', () => {
      loyalty.earnPoints('0xMEMBER0', 1000, 1);
      loyalty.redeemPoints('0xMEMBER0', 20, 1);

      const data = loyalty.exportData();

      expect(data.config).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.accounts).toBeDefined();
      expect(data.events).toBeDefined();
      expect(data.config.pointsPerDollar).toBe(0.1);
    });
  });
});
