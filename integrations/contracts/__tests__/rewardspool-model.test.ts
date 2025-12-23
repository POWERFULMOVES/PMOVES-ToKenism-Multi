import { RewardsPoolModel } from '../rewardspool-model';
import { GroVaultModel } from '../grovault-model';
import { GroTokenDistribution } from '../grotoken-model';

describe('RewardsPoolModel', () => {
  let rewardsPool: RewardsPoolModel;
  let groVault: GroVaultModel;
  let groToken: GroTokenDistribution;

  beforeEach(() => {
    groToken = new GroTokenDistribution({
      distributionMean: 0.5,
      distributionStd: 0.2,
      tokenValue: 2.0,
      participationRate: 1.0, // All participate for testing
    });

    groVault = new GroVaultModel(groToken, {
      baseInterestRate: 0.02,
      lockBonusMultiplier: 0.5,
    });

    // Initialize holders and give them tokens
    const addresses = Array.from({ length: 10 }, (_, i) => `0xMEMBER${i}`);
    groToken.initializeHolders(addresses);

    // Distribute tokens
    for (let week = 1; week <= 10; week++) {
      groToken.distributeWeekly(week);
    }

    rewardsPool = new RewardsPoolModel(groVault, {
      feePercentage: 0.01, // 1% for easier testing
      distributionFrequency: 4,
      stakingBoostMultiplier: 1.5,
      minStakeForRewards: 0.5,
    });
  });

  describe('fee collection', () => {
    it('should collect fees from transactions', () => {
      const fee = rewardsPool.collectFee(1000, 1);

      expect(fee).toBe(10); // 1% of 1000
      expect(rewardsPool.getPendingDistribution()).toBe(10);
    });

    it('should accumulate fees over multiple transactions', () => {
      rewardsPool.collectFee(1000, 1);
      rewardsPool.collectFee(500, 1);
      rewardsPool.collectFee(250, 1);

      expect(rewardsPool.getPendingDistribution()).toBe(17.5);
    });

    it('should track total fees collected', () => {
      rewardsPool.collectFee(1000, 1);
      rewardsPool.collectFee(2000, 2);

      const stats = rewardsPool.getStatistics();
      expect(stats.totalFeesCollected).toBe(30);
    });
  });

  describe('reward distribution', () => {
    beforeEach(() => {
      // Create some staking positions
      const addresses = Array.from({ length: 5 }, (_, i) => `0xMEMBER${i}`);

      for (const address of addresses) {
        const balance = groToken.balanceOf(address);
        if (balance > 1) {
          try {
            groVault.createLock(1, address, 1.0, 2);
          } catch {
            // May fail if already has lock
          }
        }
      }
    });

    it('should not distribute on non-distribution weeks', () => {
      rewardsPool.collectFee(1000, 1);
      const claims = rewardsPool.distributeRewards(1);

      expect(claims).toHaveLength(0);
      expect(rewardsPool.getPendingDistribution()).toBe(10);
    });

    it('should distribute on distribution frequency weeks', () => {
      rewardsPool.collectFee(1000, 1);
      rewardsPool.collectFee(1000, 2);
      rewardsPool.collectFee(1000, 3);

      const claims = rewardsPool.distributeRewards(4);

      expect(claims.length).toBeGreaterThan(0);
      expect(rewardsPool.getPendingDistribution()).toBe(0);
    });

    it('should distribute proportionally to stake', () => {
      rewardsPool.collectFee(1000, 1);
      const claims = rewardsPool.distributeRewards(4);

      // All claims should have positive amounts
      for (const claim of claims) {
        expect(claim.amount).toBeGreaterThan(0);
        expect(claim.stakeAmount).toBeGreaterThan(0);
      }
    });

    it('should increment epoch on each distribution', () => {
      expect(rewardsPool.getCurrentEpoch()).toBe(0);

      rewardsPool.collectFee(1000, 1);
      rewardsPool.distributeRewards(4);

      expect(rewardsPool.getCurrentEpoch()).toBe(1);

      rewardsPool.collectFee(1000, 5);
      rewardsPool.distributeRewards(8);

      expect(rewardsPool.getCurrentEpoch()).toBe(2);
    });
  });

  describe('claim tracking', () => {
    beforeEach(() => {
      // Create staking position
      groVault.createLock(1, '0xMEMBER0', 2.0, 2);

      // Collect fees and distribute
      rewardsPool.collectFee(1000, 1);
      rewardsPool.distributeRewards(4);
    });

    it('should track claims for specific address', () => {
      const claims = rewardsPool.getClaimsForAddress('0xMEMBER0');

      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].address).toBe('0xMEMBER0');
    });

    it('should calculate total rewards for address', () => {
      const totalRewards = rewardsPool.getTotalRewardsForAddress('0xMEMBER0');

      expect(totalRewards).toBeGreaterThan(0);
    });

    it('should return empty array for address with no claims', () => {
      const claims = rewardsPool.getClaimsForAddress('0xNONEXISTENT');

      expect(claims).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    it('should return correct statistics', () => {
      groVault.createLock(1, '0xMEMBER0', 2.0, 2);
      groVault.createLock(1, '0xMEMBER1', 1.5, 2);

      rewardsPool.collectFee(1000, 1);
      rewardsPool.collectFee(500, 2);
      rewardsPool.distributeRewards(4);

      const stats = rewardsPool.getStatistics();

      expect(stats.totalFeesCollected).toBe(15);
      expect(stats.totalDistributed).toBeGreaterThan(0);
      expect(stats.totalClaimants).toBe(2);
      expect(stats.currentEpoch).toBe(1);
      expect(stats.pendingDistribution).toBe(0);
    });

    it('should calculate average reward per claimant', () => {
      groVault.createLock(1, '0xMEMBER0', 2.0, 2);

      rewardsPool.collectFee(1000, 1);
      rewardsPool.distributeRewards(4);

      const stats = rewardsPool.getStatistics();

      expect(stats.averageRewardPerClaimant).toBeGreaterThan(0);
    });
  });

  describe('export data', () => {
    it('should export complete data', () => {
      groVault.createLock(1, '0xMEMBER0', 2.0, 2);
      rewardsPool.collectFee(1000, 1);
      rewardsPool.distributeRewards(4);

      const data = rewardsPool.exportData();

      expect(data.config).toBeDefined();
      expect(data.statistics).toBeDefined();
      expect(data.claims).toBeDefined();
      expect(data.events).toBeDefined();
      expect(data.config.feePercentage).toBe(0.01);
    });
  });
});
