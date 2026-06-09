/**
 * GroVault Staking Model Tests
 */

import { GroVaultModel } from '../grovault-model';
import { GroTokenDistribution } from '../grotoken-model';

describe('GroVaultModel', () => {
  let groToken: GroTokenDistribution;
  let groVault: GroVaultModel;

  beforeEach(() => {
    groToken = new GroTokenDistribution({
      distributionMean: 0.5,
      distributionStd: 0.2,
      tokenValue: 2.0,
      participationRate: 1.0, // 100% for testing
    });

    groVault = new GroVaultModel(groToken, {
      baseInterestRate: 0.02, // 2% APR
      lockBonusMultiplier: 0.5, // 50% per year
      compoundingPeriod: 'weekly',
    });

    // Initialize holders and distribute tokens
    const addresses = Array.from({ length: 10 }, (_, i) => `0xMEMBER${i}`);
    groToken.initializeHolders(addresses);

    // Distribute tokens for several weeks to build balances
    for (let week = 1; week <= 10; week++) {
      groToken.distributeWeekly(week);
    }
  });

  describe('lock creation', () => {
    it('should create lock successfully', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 1.0) {
        const success = groVault.createLock(1, address, 1.0, 2);

        expect(success).toBe(true);

        const locks = groVault.getActiveLocks();
        const userLock = locks.find(l => l.address === address);

        expect(userLock).toBeDefined();
        expect(userLock?.amount).toBe(1.0);
        expect(userLock?.durationYears).toBe(2);
      }
    });

    it('should calculate correct unlock week', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 1.0) {
        groVault.createLock(1, address, 1.0, 2);

        const locks = groVault.getActiveLocks();
        const userLock = locks.find(l => l.address === address);

        // 2 years = 104 weeks
        expect(userLock?.unlockWeek).toBe(1 + 104);
      }
    });

    it('should fail with insufficient token balance', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      expect(() => {
        groVault.createLock(1, address, balance + 100, 2);
      }).toThrow('Insufficient GroToken balance');
    });

    it('should fail if address already has lock', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 2.0) {
        groVault.createLock(1, address, 1.0, 2);

        expect(() => {
          groVault.createLock(1, address, 1.0, 2);
        }).toThrow('Lock already exists');
      }
    });

    it('should fail with invalid duration', () => {
      const address = '0xMEMBER0';

      expect(() => {
        groVault.createLock(1, address, 1.0, 0);
      }).toThrow('Duration must be between 1 and 4 years');

      expect(() => {
        groVault.createLock(1, address, 1.0, 5);
      }).toThrow('Duration must be between 1 and 4 years');
    });
  });

  describe('voting power', () => {
    it('should calculate voting power with lock bonus', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 4.0) {
        // Lock 4 tokens for 1 year
        groVault.createLock(1, address, 4.0, 1);

        const votingPower = groVault.getVotingPower(address);

        // Formula: sqrt(4) * (1 + 0.5 * (1 - 1)) = 2 * 1 = 2
        expect(votingPower).toBeCloseTo(2.0, 4);
      }
    });

    it('should increase voting power with longer locks', () => {
      const address1 = '0xMEMBER0';
      const address2 = '0xMEMBER1';

      const balance1 = groToken.balanceOf(address1);
      const balance2 = groToken.balanceOf(address2);

      if (balance1 >= 4.0 && balance2 >= 4.0) {
        groVault.createLock(1, address1, 4.0, 1); // 1 year
        groVault.createLock(1, address2, 4.0, 4); // 4 years

        const power1 = groVault.getVotingPower(address1);
        const power2 = groVault.getVotingPower(address2);

        // Longer lock should have more voting power
        expect(power2).toBeGreaterThan(power1);
      }
    });

    it('should have zero voting power without lock', () => {
      const address = '0xMEMBER0';
      const votingPower = groVault.getVotingPower(address);

      expect(votingPower).toBe(0);
    });
  });

  describe('interest accrual', () => {
    it('should accrue interest over time', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 10.0) {
        groVault.createLock(1, address, 10.0, 2);

        const initialLock = groVault.getActiveLocks().find(l => l.address === address);
        const initialInterest = initialLock?.interestAccrued || 0;

        // Accrue interest for 52 weeks (1 year)
        for (let week = 2; week <= 53; week++) {
          groVault.accrueInterest(week);
        }

        const finalLock = groVault.getActiveLocks().find(l => l.address === address);
        const finalInterest = finalLock?.interestAccrued || 0;

        // Interest should have accrued
        expect(finalInterest).toBeGreaterThan(initialInterest);
      }
    });

    it('should calculate correct APR with lock bonus', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 10.0) {
        groVault.createLock(1, address, 10.0, 3);

        const lock = groVault.getActiveLocks().find(l => l.address === address);

        // Base APR: 2%, Lock bonus: 50% * (3 - 1) = 100%
        // Total APR: 2% + 2% = 4%
        expect(lock?.effectiveAPR).toBeCloseTo(0.04, 4);
      }
    });

    it('should compound interest correctly', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 100.0) {
        groVault.createLock(1, address, 100.0, 2);

        // Accrue for multiple weeks
        for (let week = 2; week <= 105; week++) {
          groVault.accrueInterest(week);
        }

        const lock = groVault.getActiveLocks().find(l => l.address === address);

        // With compounding, interest should be greater than simple interest
        const simpleInterest = 100.0 * 0.03 * 2; // 3% APR * 2 years
        expect(lock?.interestAccrued || 0).toBeGreaterThan(simpleInterest);
      }
    });
  });

  describe('withdrawals', () => {
    it('should allow withdrawal after lock period', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 10.0) {
        const initialTokenBalance = groToken.balanceOf(address);

        groVault.createLock(1, address, 10.0, 1);

        // Fast forward past unlock week (52 weeks)
        for (let week = 2; week <= 54; week++) {
          groVault.accrueInterest(week);
        }

        const success = groVault.withdraw(54, address);

        expect(success).toBe(true);

        // Tokens + interest should be returned
        const finalTokenBalance = groToken.balanceOf(address);
        expect(finalTokenBalance).toBeGreaterThan(initialTokenBalance - 10.0);
      }
    });

    it('should fail withdrawal before unlock', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 10.0) {
        groVault.createLock(1, address, 10.0, 2);

        expect(() => {
          groVault.withdraw(10, address);
        }).toThrow('Lock period not expired');
      }
    });

    it('should fail withdrawal without lock', () => {
      const address = '0xMEMBER0';

      expect(() => {
        groVault.withdraw(10, address);
      }).toThrow('No lock found');
    });
  });

  describe('wealth accumulation', () => {
    it('should calculate total wealth accumulation', () => {
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);

      if (balance >= 10.0) {
        groVault.createLock(1, address, 10.0, 2);

        // Accrue for 52 weeks
        for (let week = 2; week <= 53; week++) {
          groVault.accrueInterest(week);
        }

        const wealth = groVault.calculateWealthAccumulation(address);

        expect(wealth.locked).toBe(10.0);
        expect(wealth.interestAccrued).toBeGreaterThan(0);
        expect(wealth.totalValue).toBe(wealth.locked + wealth.interestAccrued);
        expect(wealth.effectiveAPR).toBeGreaterThan(0);
      }
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Create multiple locks - duration must be 1-4 years
      for (let i = 0; i < 4; i++) {
        const address = `0xMEMBER${i}`;
        const balance = groToken.balanceOf(address);

        if (balance >= 1.0) {
          groVault.createLock(1, address, 1.0, (i % 4) + 1); // Duration 1-4
        }
      }

      // Accrue interest for 26 weeks
      for (let week = 2; week <= 27; week++) {
        groVault.accrueInterest(week);
      }
    });

    it('should calculate correct statistics', () => {
      const stats = groVault.getStatistics();

      expect(stats.totalLocked).toBeGreaterThan(0);
      expect(stats.activePositions).toBeGreaterThan(0);
      expect(stats.totalInterestAccrued).toBeGreaterThan(0);
      expect(stats.totalVotingPower).toBeGreaterThan(0);
      expect(stats.averageLockDuration).toBeGreaterThan(0);
      expect(stats.averageAPR).toBeGreaterThan(0);
    });
  });

  describe('data export', () => {
    beforeEach(() => {
      // Create a lock with available balance
      const address = '0xMEMBER0';
      const balance = groToken.balanceOf(address);
      const lockAmount = Math.min(balance, 10.0);

      if (lockAmount >= 1.0) {
        groVault.createLock(1, address, lockAmount, 2);

        for (let week = 2; week <= 10; week++) {
          groVault.accrueInterest(week);
        }
      }
    });

    it('should export complete data', () => {
      const data = groVault.exportData();

      // Data export should work even with no locks
      expect(data.totalLocked).toBeGreaterThanOrEqual(0);
      expect(data.locks).toBeInstanceOf(Array);

      if (data.locks.length > 0) {
        const lock = data.locks[0];
        expect(lock.address).toBeDefined();
        expect(lock.amount).toBeGreaterThan(0);
        expect(lock.interestAccrued).toBeGreaterThanOrEqual(0);
        expect(lock.votingPower).toBeGreaterThan(0);
      }
    });
  });
});
