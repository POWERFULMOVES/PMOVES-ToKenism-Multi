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
      // Contribute enough to execute
      for (let i = 1; i <= 10; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 60);
      }

      groupPurchase.executeOrder(orderId);

      expect(() => {
        groupPurchase.contribute(1, orderId, '0xMEMBER15', 100);
      }).toThrow('Order already executed');
    });
  });

  describe('order execution', () => {
    let orderId: number;

    beforeEach(() => {
      orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');
    });

    it('should execute order when target reached with enough participants', () => {
      // Get 6 participants to contribute (more than minimum 5)
      for (let i = 1; i <= 6; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 100);
      }

      const result = groupPurchase.executeOrder(orderId);

      expect(result).toBeDefined();
      expect(result?.executed).toBe(true);
      expect(result?.savingsAmount).toBeCloseTo(90, 2); // 15% of 600
      expect(result?.finalCost).toBeCloseTo(510, 2); // 600 - 90

      const order = groupPurchase.getOrder(orderId);
      expect(order?.status).toBe('executed');
    });

    it('should distribute savings proportionally to participants', () => {
      // Different contribution amounts
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 200); // 40%
      groupPurchase.contribute(1, orderId, '0xMEMBER2', 150); // 30%
      groupPurchase.contribute(1, orderId, '0xMEMBER3', 100); // 20%
      groupPurchase.contribute(1, orderId, '0xMEMBER4', 50);  // 10%
      groupPurchase.contribute(1, orderId, '0xMEMBER5', 50);  // (added for minimum participants)
      groupPurchase.contribute(1, orderId, '0xMEMBER6', 50);

      const balanceBefore1 = foodUSD.balanceOf('0xMEMBER1');
      const balanceBefore2 = foodUSD.balanceOf('0xMEMBER2');

      void groupPurchase.executeOrder(orderId);

      // Savings should be refunded proportionally
      const balanceAfter1 = foodUSD.balanceOf('0xMEMBER1');
      const balanceAfter2 = foodUSD.balanceOf('0xMEMBER2');

      const refund1 = balanceAfter1 - balanceBefore1;
      const refund2 = balanceAfter2 - balanceBefore2;

      // Member1 contributed more, should get more savings
      expect(refund1).toBeGreaterThan(refund2);
    });

    it('should fail execution without minimum participants', () => {
      // Only 3 participants (less than minimum 5)
      groupPurchase.contribute(1, orderId, '0xMEMBER1', 200);
      groupPurchase.contribute(1, orderId, '0xMEMBER2', 200);
      groupPurchase.contribute(1, orderId, '0xMEMBER3', 200);

      expect(() => {
        groupPurchase.executeOrder(orderId);
      }).toThrow('Minimum participants not met');
    });

    it('should fail execution when target not reached', () => {
      // 5 participants but only contributed 250 total (target is 500)
      for (let i = 1; i <= 5; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 50);
      }

      expect(() => {
        groupPurchase.executeOrder(orderId);
      }).toThrow('Target amount not reached');
    });
  });

  describe('savings validation', () => {
    beforeEach(() => {
      // Execute several orders
      for (let i = 0; i < 10; i++) {
        const orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

        for (let j = 1; j <= 6; j++) {
          groupPurchase.contribute(1, orderId, `0xMEMBER${j}`, 100);
        }

        groupPurchase.executeOrder(orderId);
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

      for (let i = 1; i <= 6; i++) {
        groupPurchase.contribute(1, orderId1, `0xMEMBER${i}`, 100);
      }

      groupPurchase.executeOrder(orderId1);

      const orderId2 = groupPurchase.createOrder(2, '0xMEMBER0', '0xSUPPLIER', 300, 'dining');

      for (let i = 1; i <= 6; i++) {
        groupPurchase.contribute(2, orderId2, `0xMEMBER${i}`, 60);
      }

      groupPurchase.executeOrder(orderId2);
    });

    it('should track individual participant savings', () => {
      const savings = groupPurchase.getParticipantSavings('0xMEMBER1');

      expect(savings.totalSaved).toBeGreaterThan(0);
      expect(savings.ordersParticipated).toBe(2);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // Create and execute multiple orders
      for (let i = 0; i < 5; i++) {
        const orderId = groupPurchase.createOrder(1, '0xMEMBER0', '0xSUPPLIER', 500, 'groceries');

        for (let j = 1; j <= 6; j++) {
          groupPurchase.contribute(1, orderId, `0xMEMBER${j}`, 100);
        }

        groupPurchase.executeOrder(orderId);
      }

      // Create some pending orders
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

      for (let i = 1; i <= 6; i++) {
        groupPurchase.contribute(1, orderId, `0xMEMBER${i}`, 100);
      }

      groupPurchase.executeOrder(orderId);
    });

    it('should export complete data', () => {
      const data = groupPurchase.exportData();

      expect(data.totalOrders).toBe(1);
      expect(data.executedOrders).toBe(1);
      expect(data.orders).toBeInstanceOf(Array);
      expect(data.orders[0].status).toBe('executed');
      expect(data.orders[0].participantCount).toBe(6);
    });
  });
});
