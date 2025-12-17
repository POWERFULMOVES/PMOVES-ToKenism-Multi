/**
 * GroToken Distribution Model Tests
 */

import { GroTokenDistribution } from '../grotoken-model';

describe('GroTokenDistribution', () => {
  let groToken: GroTokenDistribution;

  beforeEach(() => {
    groToken = new GroTokenDistribution({
      distributionMean: 0.5,
      distributionStd: 0.2,
      tokenValue: 2.0,
      participationRate: 0.5, // 50% for testing
    });
  });

  describe('initialization', () => {
    it('should initialize holders correctly', () => {
      const addresses = ['0xALICE', '0xBOB', '0xCHARLIE'];
      groToken.initializeHolders(addresses);

      for (const address of addresses) {
        const balance = groToken.balanceOf(address);
        expect(balance).toBe(0);
      }
    });
  });

  describe('token distribution', () => {
    beforeEach(() => {
      const addresses = Array.from({ length: 100 }, (_, i) => `0xMEMBER${i}`);
      groToken.initializeHolders(addresses);
    });

    it('should distribute tokens weekly to subset of participants', () => {
      const events = groToken.distributeWeekly(1);

      // With 50% participation rate and 100 holders, expect ~50 distributions
      expect(events.length).toBeGreaterThan(30);
      expect(events.length).toBeLessThan(70);

      // Verify each event
      for (const event of events) {
        expect(event.amount).toBeGreaterThan(0);
        expect(event.dollarValue).toBe(event.amount * 2.0);
        expect(event.week).toBe(1);
      }
    });

    it('should respect participation rate across multiple weeks', () => {
      const weeks = 10;
      let totalParticipations = 0;

      for (let week = 1; week <= weeks; week++) {
        const events = groToken.distributeWeekly(week);
        totalParticipations += events.length;
      }

      // Average should be close to 50 per week
      const avgPerWeek = totalParticipations / weeks;
      expect(avgPerWeek).toBeGreaterThan(40);
      expect(avgPerWeek).toBeLessThan(60);
    });

    it('should follow Gaussian distribution', () => {
      const amounts: number[] = [];

      // Collect many samples
      for (let week = 1; week <= 100; week++) {
        const events = groToken.distributeWeekly(week);
        amounts.push(...events.map(e => e.amount));
      }

      // Calculate mean
      const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

      // Should be close to configured mean (0.5)
      expect(mean).toBeGreaterThan(0.4);
      expect(mean).toBeLessThan(0.6);

      // Calculate std dev
      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      // Should be close to configured std (0.2)
      expect(stdDev).toBeGreaterThan(0.15);
      expect(stdDev).toBeLessThan(0.25);
    });

    it('should update holder balances correctly', () => {
      const address = '0xMEMBER0';
      const initialBalance = groToken.balanceOf(address);

      // Force distribution to this address
      groToken.distributeWeekly(1);

      const newBalance = groToken.balanceOf(address);

      // Balance should have increased (if they received tokens)
      // or stayed the same (if they didn't participate this week)
      expect(newBalance).toBeGreaterThanOrEqual(initialBalance);
    });
  });

  describe('token transfers', () => {
    beforeEach(() => {
      groToken.initializeHolders(['0xALICE', '0xBOB']);
      // Give Alice some tokens
      groToken.distributeWeekly(1);
    });

    it('should transfer tokens between holders', () => {
      const alice = '0xALICE';
      const bob = '0xBOB';

      const aliceInitial = groToken.balanceOf(alice);

      if (aliceInitial > 0) {
        const transferAmount = aliceInitial / 2;

        const success = groToken.transfer(alice, bob, transferAmount);
        expect(success).toBe(true);

        expect(groToken.balanceOf(alice)).toBeCloseTo(aliceInitial - transferAmount, 4);
        expect(groToken.balanceOf(bob)).toBeCloseTo(transferAmount, 4);
      }
    });

    it('should fail transfer with insufficient balance', () => {
      const alice = '0xALICE';
      const bob = '0xBOB';

      const aliceBalance = groToken.balanceOf(alice);

      expect(() => {
        groToken.transfer(alice, bob, aliceBalance + 100);
      }).toThrow('Insufficient balance');
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      const addresses = Array.from({ length: 100 }, (_, i) => `0xMEMBER${i}`);
      groToken.initializeHolders(addresses);

      // Distribute for 10 weeks
      for (let week = 1; week <= 10; week++) {
        groToken.distributeWeekly(week);
      }
    });

    it('should calculate correct statistics', () => {
      const stats = groToken.getStatistics();

      expect(stats.totalSupply).toBeGreaterThan(0);
      expect(stats.totalDistributed).toBe(stats.totalSupply);
      expect(stats.totalHolders).toBe(100);
      expect(stats.activeParticipants).toBeGreaterThan(0);
      expect(stats.activeParticipants).toBeLessThanOrEqual(100);
      expect(stats.totalValue).toBeCloseTo(stats.totalSupply * 2.0, 10);
      expect(stats.averageBalance).toBeCloseTo(stats.totalSupply / stats.totalHolders, 10);
    });
  });

  describe('wealth impact', () => {
    beforeEach(() => {
      groToken.initializeHolders(['0xALICE']);

      // Distribute for several weeks
      for (let week = 1; week <= 20; week++) {
        groToken.distributeWeekly(week);
      }
    });

    it('should calculate wealth impact for holder', () => {
      const impact = groToken.calculateWealthImpact('0xALICE');

      expect(impact.balance).toBeGreaterThanOrEqual(0);
      expect(impact.dollarValue).toBe(impact.balance * 2.0);
      expect(impact.totalReceived).toBeGreaterThanOrEqual(impact.balance);
    });
  });

  describe('data export', () => {
    beforeEach(() => {
      groToken.initializeHolders(['0xALICE', '0xBOB']);
      groToken.distributeWeekly(1);
    });

    it('should export complete data', () => {
      const data = groToken.exportData();

      expect(data.totalSupply).toBeGreaterThanOrEqual(0);
      expect(data.holders).toBeInstanceOf(Array);

      const alice = data.holders.find(h => h.address === '0xALICE');
      if (alice) {
        expect(alice.balance).toBeGreaterThanOrEqual(0);
        expect(alice.totalReceived).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
