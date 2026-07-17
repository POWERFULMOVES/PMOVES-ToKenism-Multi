/**
 * Contract Coordinator Integration Tests
 */

import { ContractCoordinator } from '../contract-coordinator';

describe('ContractCoordinator', () => {
  let coordinator: ContractCoordinator;

  beforeEach(() => {
    coordinator = new ContractCoordinator({
      groToken: {
        distributionMean: 0.5,
        distributionStd: 0.2,
        tokenValue: 2.0,
        participationRate: 0.5,
      },
      foodUSD: {
        pegValue: 1.0,
        foodCategories: ['groceries', 'prepared_food', 'dining'],
      },
      groupPurchase: {
        savingsRate: 0.15,
        minimumParticipants: 5,
      },
      groVault: {
        baseInterestRate: 0.02,
        lockBonusMultiplier: 0.5,
      },
      governance: {
        votingPeriodWeeks: 2,
        proposalThreshold: 100,
      },
    });
  });

  describe('initialization', () => {
    it('should initialize all models with population', () => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      const stats = coordinator.getComprehensiveStats();

      expect(stats.groToken.totalHolders).toBe(50);
      // FoodUSD includes contract addresses (GroupPurchase, Supplier)
      expect(stats.foodUSD.totalHolders).toBe(52);
    });
  });

  describe('weekly simulation', () => {
    beforeEach(() => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });
    });

    it('should process weekly activities correctly', async () => {
      const householdBudgets = new Map();

      for (let i = 0; i < 50; i++) {
        householdBudgets.set(`0xMEMBER${i}`, {
          foodBudget: 150,
          totalIncome: 800,
        });
      }

      await coordinator.processWeek(1, householdBudgets);

      const stats = coordinator.getComprehensiveStats();

      // GroToken should have been distributed
      expect(stats.groToken.totalDistributed).toBeGreaterThan(0);

      // FoodUSD should have been spent
      expect(stats.foodUSD.totalSpent).toBeGreaterThan(0);
    });

    it('should run multi-week simulation', async () => {
      for (let week = 1; week <= 10; week++) {
        const householdBudgets = new Map();

        for (let i = 0; i < 50; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);
      }

      const stats = coordinator.getComprehensiveStats();

      // All systems should have activity
      expect(stats.groToken.totalDistributed).toBeGreaterThan(0);
      expect(stats.foodUSD.totalSpent).toBeGreaterThan(0);
    });
  });

  describe('contribution-based distribution (token-structure refresh)', () => {
    const build = () => {
      const c = new ContractCoordinator({ groToken: { tokenValue: 2.0 } });
      c.initialize({ addresses: ['0xA', '0xB', '0xC'], initialWealth: [0, 0, 0] });
      return c;
    };
    const budgets = () =>
      new Map([
        ['0xA', { foodBudget: 100, totalIncome: 1000 }],
        ['0xB', { foodBudget: 100, totalIncome: 1000 }],
        ['0xC', { foodBudget: 100, totalIncome: 1000 }],
      ]);

    it('distributes GroToken deterministically by contribution, not a random draw', async () => {
      const c1 = build();
      await c1.processWeek(1, budgets());
      const c2 = build();
      await c2.processWeek(1, budgets());

      const b1 = c1.getModels().groToken.balanceOf('0xA');
      const b2 = c2.getModels().groToken.balanceOf('0xA');
      // Every participating household gets a non-zero, IDENTICAL share across runs —
      // the retired Gaussian draw would differ run to run.
      expect(b1).toBeGreaterThan(0);
      expect(b1).toBe(b2);
    });

    it('weights distribution by the configured contribution measure (income)', async () => {
      const c = new ContractCoordinator({
        groToken: { tokenValue: 2.0 },
        contributionMeasure: 'income',
      });
      c.initialize({ addresses: ['0xRICH', '0xPOOR'], initialWealth: [0, 0] });
      const budgets = new Map([
        ['0xRICH', { foodBudget: 100, totalIncome: 3000 }],
        ['0xPOOR', { foodBudget: 100, totalIncome: 1000 }],
      ]);

      await c.processWeek(1, budgets);

      const rich = c.getModels().groToken.balanceOf('0xRICH');
      const poor = c.getModels().groToken.balanceOf('0xPOOR');
      // Contribution-weighted by magnitude, not merely ordered: 3000 vs 1000
      // income → alpha 3000.1 vs 1000.1 → shares in ~3:1 proportion.
      expect(rich / poor).toBeCloseTo(3, 1);
      // ...and D12 still holds — the lower contributor is never zeroed.
      expect(poor).toBeGreaterThan(0);
    });

    it('stays flat (equal shares) by default', async () => {
      const c = new ContractCoordinator({ groToken: { tokenValue: 2.0 } });
      c.initialize({ addresses: ['0xRICH', '0xPOOR'], initialWealth: [0, 0] });
      const budgets = new Map([
        ['0xRICH', { foodBudget: 100, totalIncome: 3000 }],
        ['0xPOOR', { foodBudget: 100, totalIncome: 1000 }],
      ]);

      await c.processWeek(1, budgets);

      const rich = c.getModels().groToken.balanceOf('0xRICH');
      const poor = c.getModels().groToken.balanceOf('0xPOOR');
      // Default measure is flat: equal shares regardless of income.
      expect(rich).toBeCloseTo(poor, 6);
    });
  });

  describe('group purchasing', () => {
    beforeEach(() => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Process a week to fund FoodUSD accounts
      const householdBudgets = new Map();
      for (let i = 0; i < 50; i++) {
        householdBudgets.set(`0xMEMBER${i}`, {
          foodBudget: 1000,
          totalIncome: 1500,
        });
      }

      coordinator.processWeek(1, householdBudgets);

      // Fund accounts with additional FoodUSD for group contributions
      // (processWeek funds then spends, so we need extra for contributions)
      const models = coordinator.getModels();
      for (let i = 0; i < 10; i++) {
        models.foodUSD.fundAccount(`0xMEMBER${i}`, 500);
      }
    });

    it('should create and execute group orders', () => {
      const orderId = coordinator.createGroupOrder(1, '0xMEMBER0', 'groceries', 500);

      expect(orderId).toBe(1);

      // Get contributions (5 participants * 100 = 500 = target, auto-executes)
      for (let i = 1; i <= 5; i++) {
        coordinator.contributeToOrder(1, orderId, `0xMEMBER${i}`, 100);
      }

      const stats = coordinator.getComprehensiveStats();

      expect(stats.groupPurchase.executedOrders).toBe(1);
      expect(stats.groupPurchase.totalSaved).toBeGreaterThan(0);
    });
  });

  describe('staking', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Distribute tokens for several weeks to build balances
      for (let week = 1; week <= 10; week++) {
        const householdBudgets = new Map();
        for (let i = 0; i < 50; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);
      }
    });

    it('should allow token staking', () => {
      const models = coordinator.getModels();
      const balance = models.groToken.balanceOf('0xMEMBER0');

      if (balance >= 2.0) {
        const success = coordinator.stakeTokens(10, '0xMEMBER0', 2.0, 2);

        expect(success).toBe(true);

        const stats = coordinator.getComprehensiveStats();
        expect(stats.staking.activePositions).toBeGreaterThan(0);
        expect(stats.staking.totalLocked).toBeGreaterThanOrEqual(2.0);
      }
    });

    it('should accrue staking interest over time', async () => {
      const models = coordinator.getModels();
      const balance = models.groToken.balanceOf('0xMEMBER0');

      if (balance >= 5.0) {
        coordinator.stakeTokens(10, '0xMEMBER0', 5.0, 2);

        // Continue simulation for 26 more weeks
        for (let week = 11; week <= 36; week++) {
          const householdBudgets = new Map();
          for (let i = 0; i < 50; i++) {
            householdBudgets.set(`0xMEMBER${i}`, {
              foodBudget: 150,
              totalIncome: 800,
            });
          }

          await coordinator.processWeek(week, householdBudgets);
        }

        const stats = coordinator.getComprehensiveStats();
        expect(stats.staking.totalInterestAccrued).toBeGreaterThan(0);
      }
    });
  });

  describe('governance', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Build up tokens and create stakes
      for (let week = 1; week <= 10; week++) {
        const householdBudgets = new Map();
        for (let i = 0; i < 50; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);
      }

      // Create some stakes for voting power
      const models = coordinator.getModels();
      for (let i = 0; i < 10; i++) {
        const balance = models.groToken.balanceOf(`0xMEMBER${i}`);
        if (balance >= 2.0) {
          coordinator.stakeTokens(10, `0xMEMBER${i}`, 2.0, 2);
        }
      }
    });

    it('should create governance proposals', () => {
      const proposalId = coordinator.createProposal(
        10,
        '0xMEMBER0',
        'Increase food budget allocation',
        'budget'
      );

      expect(proposalId).toBeGreaterThan(0);

      const stats = coordinator.getComprehensiveStats();
      expect(stats.governance.totalProposals).toBeGreaterThan(0);
    });

    it('should allow voting on proposals', () => {
      const proposalId = coordinator.createProposal(
        10,
        '0xMEMBER0',
        'Test proposal',
        'general'
      );

      const models = coordinator.getModels();
      const votingPower = models.groVault.getVotingPower('0xMEMBER1');

      if (votingPower >= 4) {
        const success = coordinator.vote(10, proposalId, '0xMEMBER1', 2, true);

        expect(success).toBe(true);

        const stats = coordinator.getComprehensiveStats();
        expect(stats.governance.totalVotes).toBeGreaterThan(0);
      }
    });
  });

  describe('comprehensive statistics', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 100 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Run comprehensive simulation
      for (let week = 1; week <= 20; week++) {
        const householdBudgets = new Map();
        for (let i = 0; i < 100; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);
      }
    });

    it('should provide comprehensive stats across all contracts', () => {
      const stats = coordinator.getComprehensiveStats();

      expect(stats.groToken).toBeDefined();
      expect(stats.foodUSD).toBeDefined();
      expect(stats.groupPurchase).toBeDefined();
      expect(stats.staking).toBeDefined();
      expect(stats.governance).toBeDefined();
      expect(stats.summary).toBeDefined();

      expect(stats.summary.totalValueLocked).toBeGreaterThan(0);
      expect(stats.summary.participationRate).toBeGreaterThan(0);
    });
  });

  describe('wealth impact analysis', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 50 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Run simulation with various activities
      for (let week = 1; week <= 20; week++) {
        const householdBudgets = new Map();
        for (let i = 0; i < 50; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);

        // Group buying every 4 weeks
        if (week % 4 === 0) {
          const orderId = coordinator.createGroupOrder(week, '0xMEMBER0', 'groceries', 500);

          for (let i = 1; i <= 6; i++) {
            try {
              coordinator.contributeToOrder(week, orderId, `0xMEMBER${i}`, 100);
            } catch (error) {
              // May fail if insufficient balance
            }
          }
        }
      }
    });

    it('should calculate individual wealth impact', () => {
      const impact = coordinator.calculateWealthImpact('0xMEMBER1');

      expect(impact.groTokenValue).toBeGreaterThanOrEqual(0);
      expect(impact.totalImpact).toBeGreaterThanOrEqual(0);
      expect(impact.breakdown).toBeDefined();
    });
  });

  describe('economy comparison', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 100 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      // Run 52-week simulation
      for (let week = 1; week <= 52; week++) {
        const householdBudgets = new Map();
        for (let i = 0; i < 100; i++) {
          householdBudgets.set(`0xMEMBER${i}`, {
            foodBudget: 150,
            totalIncome: 800,
          });
        }

        await coordinator.processWeek(week, householdBudgets);
      }
    });

    it('should compare traditional vs token economy', () => {
      const traditionalSpending = {
        groceries: 400 * 52,
        prepared_food: 150 * 52,
        dining: 100 * 52,
      };

      const comparison = coordinator.compareEconomies(traditionalSpending);

      expect(comparison.traditional).toBeDefined();
      expect(comparison.tokenEconomy).toBeDefined();
      expect(comparison.difference).toBeDefined();

      expect(comparison.tokenEconomy.tokenValue).toBeGreaterThan(0);
      expect(comparison.tokenEconomy.totalBenefit).toBeGreaterThan(0);
    });
  });

  describe('data export', () => {
    beforeEach(async () => {
      const addresses = Array.from({ length: 20 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      const householdBudgets = new Map();
      for (let i = 0; i < 20; i++) {
        householdBudgets.set(`0xMEMBER${i}`, {
          foodBudget: 150,
          totalIncome: 800,
        });
      }

      await coordinator.processWeek(1, householdBudgets);
    });

    it('should export all contract data', () => {
      const data = coordinator.exportAllData();

      expect(data.week).toBe(1);
      expect(data.groTokenDistribution).toBeDefined();
      expect(data.foodUSDSpending).toBeDefined();
      expect(data.groupPurchases).toBeDefined();
      expect(data.staking).toBeDefined();
      expect(data.governance).toBeDefined();
    });
  });

  describe('model access', () => {
    it('should provide access to individual models', () => {
      const models = coordinator.getModels();

      expect(models.groToken).toBeDefined();
      expect(models.foodUSD).toBeDefined();
      expect(models.groupPurchase).toBeDefined();
      expect(models.groVault).toBeDefined();
      expect(models.governance).toBeDefined();
    });
  });

  describe('current week tracking', () => {
    it('should track current simulation week', async () => {
      const addresses = Array.from({ length: 10 }, (_, i) => `0xMEMBER${i}`);
      const initialWealth = addresses.map(() => 5000);

      coordinator.initialize({
        addresses,
        initialWealth,
      });

      expect(coordinator.getCurrentWeek()).toBe(0);

      const householdBudgets = new Map();
      for (let i = 0; i < 10; i++) {
        householdBudgets.set(`0xMEMBER${i}`, {
          foodBudget: 150,
          totalIncome: 800,
        });
      }

      await coordinator.processWeek(5, householdBudgets);

      expect(coordinator.getCurrentWeek()).toBe(5);
    });
  });
});
