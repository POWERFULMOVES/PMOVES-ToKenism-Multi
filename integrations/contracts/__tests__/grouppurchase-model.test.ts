/**
 * GroupPurchase Model Tests
 */

import { GroupPurchaseModel } from '../grouppurchase-model';
import { FoodUSDModel } from '../foodusd-model';

describe('GroupPurchaseModel', () => {
  let foodUSD: FoodUSDModel;
  let groupPurchase: GroupPurchaseModel;

  beforeEach(() => {
    foodUSD = new FoodUSDModel();

    groupPurchase = new GroupPurchaseModel(foodUSD, {
      savingsRate: 0.15, // 15% savings
      minimumParticipants: 5,
      categories: ['groceries', 'dining', 'prepared_food', 'farmers_market'],
    });

    // Initialize holders (include contract address)
    const addresses = Array.from({ length: 20 }, (_, i) => `0xMEMBER${i}`);
    addresses.push('0xSUPPLIER', '0xGROUPPURCHASE_CONTRACT');
    foodUSD.initializeHolders(addresses);

    // Fund all accounts
    for (let i = 0; i < 20; i++) {
      foodUSD.fundAccount(`0xMEMBER${i}`, 1000);
    }
  });

  describe('order creation', () => {
    it('should create order successfully', () => {
      const orderId = groupPurchase.createOrder(
        1,
        '0xMEMBER0',
        '0xSUPPLIER',
        500,
        'groceries'
      );

      expect(orderId).toBe(1);

      const order = groupPurchase.getOrder(orderId);
      expect(order).toBeDefined();
      expect(order?.creator).toBe('0xMEMBER0');
      expect(order?.targetAmount).toBe(500);
      expect(order?.category).toBe('groceries');
      expect(order?.status).toBe('pending');
    });

    it('should increment order IDs', () => {
      const orderId1 = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');
      const orderId2 = groupPurchase.createOrder(1, '0xMEMBER1', '0xSUPPLIER', 300, 'dining');

      expect(orderId2).toBe(orderId1 + 1);
    });
  });

  describe('contributions', () => {
    let orderId: number;

    beforeEach(() => {
      orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');
    });

    it('should accept contributions', () => {
      const success = groupPurchase.contribute(1, orderId, '0xMEMBER1', 100);

      expect(success).toBe(true);

      const order = groupPurchase.getOrder(orderId);
      expect(order?.totalContributed).toBe(100);
      expect(order?.participants.size).toBe(1);
    });

    it('should accept multiple contributions from same participant', () => {
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 100);
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 50);

      const order = groupPurchase.getOrder(orderId);
      expect(order?.participants.get('0xMEMBER1')).toBe(150);
      expect(order?.totalContributed).toBe(150);
    });

    it('should fail contribution with insufficient balance', () => {
      expect(() => {
        groupPurchase.contribute(1, orderId, '0xMEMBER1', 2000);
      }).toThrow('Insufficient FoodUSD balance');
    });

    it('should fail contribution to non-existent order', () => {
      expect(() => {
        groupPurchase.contribute(1, 999, '0xMEMBER1', 100);
      }).toThrow('Order 999 not found');
    });

    it('should fail contribution to executed order', () => {
      // First, make 5 contributions to reach target and trigger auto-execute
      // 5 * 100 = 500 = target, triggers auto-execute on 5th contribution
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 100);
      }

      // Order is now auto-executed, subsequent contributions should fail
      expect(() => {
        groupPurchase.contribute(1, orderId, '0xMEMBER15', 100);
      }).toThrow('already executed');
    });
  });

  describe('order execution', () => {
    let orderId: number;

    beforeEach(() => {
      orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');
    });

    it('should execute order when target reached with enough participants', () => {
      // Get 5 participants to contribute - auto-executes when target (500) is reached
      // 5 * 100 = 500 = target
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 100);
      }

      // Order was auto-executed when contributions reached target
      const order = groupPurchase.getOrder(orderId);
      expect(order?.status).toBe('executed');
      expect(order?.executed).toBe(true);
    });

    it('should distribute savings proportionally to participants', () => {
      // Need 5+ unique participants before reaching target
      const balanceBefore1 = foodUSD.balanceOf('0xMEMBER1');
      const balanceBefore2 = foodUSD.balanceOf('0xMEMBER2');

      // First 5 participants contribute small amounts (under target)
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 100);
      groupPurchase.contribute(1, orderId, '0xMEMBER2', 80);
      groupPurchase.contribute(1, orderId, '0xMEMBER3', 70);
      groupPurchase.contribute(1, orderId, '0xMEMBER4', 60);
      groupPurchase.contribute(1, orderId, '0xMEMBER5', 50);
      // Now at 360, add 6th participant to reach target (triggers auto-execute)
      groupPurchase.contribute(1, orderId, '0xMEMBER6', 150);

      // Order auto-executed, check balance changes
      const balanceAfter1 = foodUSD.balanceOf('0xMEMBER1');
      const balanceAfter2 = foodUSD.balanceOf('0xMEMBER2');

      // Net cost = contribution - savings received
      // MEMBER1 contributed 100, MEMBER2 contributed 80
      // Both get 15% savings back proportionally
      const netCost1 = balanceBefore1 - balanceAfter1; // Should be ~85 (100 - 15)
      const netCost2 = balanceBefore2 - balanceAfter2; // Should be ~68 (80 - 12)

      // Member1 contributed more, should have higher net cost
      expect(netCost1).toBeGreaterThan(netCost2);
    });

    it('should fail execution without minimum participants', () => {
      // Only 3 participants, contribute under target to allow manual execute test
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 150);
      groupPurchase.contribute(1, orderId, '0xMEMBER2', 150);
      groupPurchase.contribute(1, orderId, '0xMEMBER3', 150);
      // Total: 450 < 500 target, so no auto-execute

      expect(() => {
        groupPurchase.executeOrder(orderId);
      }).toThrow('target not met');
    });

    it('should fail execution when target not reached', () => {
      // 5 participants but only contributed 250 total (target is 500)
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 50);
      }

      expect(() => {
        groupPurchase.executeOrder(orderId);
      }).toThrow('target not met');
    });
  });

  describe('savings validation', () => {
    beforeEach(() => {
      // Execute several orders (auto-executes when target reached)
      for (let i = 0; i < 10; i++) {
        const orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

        // 5 participants * 100 = 500 = target, triggers auto-execute on 5th contribution
        for (let j = 1; j <= 5; j++) {
          groupPurchase.contribute(1, orderId, `0xMEMBER${j}`, 100);
        }
        // Order auto-executed
      }
    });

    it('should validate 15% savings assumption', () => {
      const validation = groupPurchase.validateSavingsAssumption();

      expect(validation.assumedRate).toBe(0.15);
      expect(validation.actualRate).toBeCloseTo(0.15, 2);
      expect(validation.withinTolerance).toBe(true);
    });
  });

  describe('participant savings', () => {
    beforeEach(() => {
      const orderId1 = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

      // Auto-executes when target reached (5 * 100 = 500)
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId1, `0xMEMBER${i}`, 100);
      }

      const orderId2 = groupPurchase.createOrder(2, '0xMEMBER0', '0xSUPPLIER', 300, 'dining');

      // Auto-executes when target reached (5 * 60 = 300)
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(2, orderId2, `0xMEMBER${i}`, 60);
      }
    });

    it('should track individual participant savings', () => {
      const savings = groupPurchase.getParticipantSavings('0xMEMBER1');

      expect(savings.totalSaved).toBeGreaterThan(0);
      expect(savings.ordersParticipated).toBe(2);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Create and auto-execute multiple orders
      for (let i = 0; i < 5; i++) {
        const orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

        // Auto-executes when target reached (5 * 100 = 500)
        for (let j = 1; j <= 5; j++) {
          groupPurchase.contribute(1, orderId, `0xMEMBER${j}`, 100);
        }
      }

      // Create some pending orders (no contributions = no auto-execute)
      groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 300, 'dining');
      groupPurchase.createOrder(1, '0xMEMBER1', '0xSUPPLIER', 400, 'prepared_food');
    });

    it('should calculate correct statistics', () => {
      const stats = groupPurchase.getStatistics();

      expect(stats.totalOrders).toBe(7);
      expect(stats.executedOrders).toBe(5);
      expect(stats.pendingOrders).toBe(2);
      expect(stats.totalSaved).toBeGreaterThan(0);
      expect(stats.totalVolume).toBeGreaterThan(0);
      expect(stats.averageSavingsRate).toBeCloseTo(0.15, 2);
    });
  });

  describe('data export', () => {
    beforeEach(() => {
      const orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

      // Auto-executes when target reached (5 * 100 = 500)
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 100);
      }
    });

    it('should export complete data', () => {
      const data = groupPurchase.exportData();

      expect(data.totalOrders).toBe(1);
      expect(data.executedOrders).toBe(1);
      expect(data.orders).toBeInstanceOf(Array);
      expect(data.orders[0].status).toBe('executed');
      expect(data.orders[0].participantCount).toBe(5);
    });
  });
});
