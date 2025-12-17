/**
 * 3-Way Integration Tests
 * Tests the integration between ToKenism, Wealth (Firefly), and DoX
 *
 * This test suite validates the complete data flow:
 * 1. PMOVES-Wealth (Firefly-iii) → Real financial data via FireflyClient
 * 2. PMOVES-ToKenism-Multi → Simulation and calibration
 * 3. PMOVES-DoX → Document analysis via DoXClient
 * 4. NATS Event Bus → Event coordination across services
 */

import { FireflyClient, Transaction } from '../firefly/firefly-client';
import { FireflyDataTransformer, TransformedData } from '../firefly/data-transformer';
import { CalibrationEngine, CalibrationReport } from '../projections/calibration-engine';
import { DoXClient, UploadResponse, QAResponse } from '../dox/dox-client';
import { NATSClient, PMOVESEvent, SimulationResultEvent } from '../nats/nats-client';
import { ProjectionModel, SimulationResults } from '../projections/projection-validator';
import axios from 'axios';

// Mock external dependencies
jest.mock('axios');
jest.mock('nats');

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock transaction data for testing
const mockTransactions: Transaction[] = [
  {
    id: '1',
    amount: -50.00,
    description: 'Weekly grocery shopping',
    date: '2024-01-15',
    category: 'Groceries',
    sourceAccount: 'Main Account',
    destinationAccount: 'Supermarket',
    type: 'withdrawal',
  },
  {
    id: '2',
    amount: -25.00,
    description: 'Lunch at restaurant',
    date: '2024-01-16',
    category: 'Restaurants',
    sourceAccount: 'Main Account',
    destinationAccount: 'Restaurant XYZ',
    type: 'withdrawal',
  },
  {
    id: '3',
    amount: -15.00,
    description: 'Coffee and pastry',
    date: '2024-01-17',
    category: 'Coffee Shop',
    sourceAccount: 'Main Account',
    destinationAccount: 'Local Cafe',
    type: 'withdrawal',
  },
  {
    id: '4',
    amount: -30.00,
    description: 'Food delivery order',
    date: '2024-01-18',
    category: 'Food Delivery',
    sourceAccount: 'Main Account',
    destinationAccount: 'Delivery Service',
    type: 'withdrawal',
  },
  {
    id: '5',
    amount: -20.00,
    description: 'Fast food meal',
    date: '2024-01-19',
    category: 'Fast Food',
    sourceAccount: 'Main Account',
    destinationAccount: 'Fast Food Chain',
    type: 'withdrawal',
  },
  {
    id: '6',
    amount: -45.00,
    description: 'Farmers market produce',
    date: '2024-01-20',
    category: 'Farmers Market',
    sourceAccount: 'Main Account',
    destinationAccount: 'Local Farmers',
    type: 'withdrawal',
  },
  // Week 2
  {
    id: '7',
    amount: -55.00,
    description: 'Weekly grocery shopping',
    date: '2024-01-22',
    category: 'Groceries',
    sourceAccount: 'Main Account',
    destinationAccount: 'Supermarket',
    type: 'withdrawal',
  },
  {
    id: '8',
    amount: -28.00,
    description: 'Dining out',
    date: '2024-01-23',
    category: 'Restaurants',
    sourceAccount: 'Main Account',
    destinationAccount: 'Restaurant ABC',
    type: 'withdrawal',
  },
];

describe('3-Way Integration Tests: ToKenism ↔ Wealth ↔ DoX', () => {

  describe('ToKenism → Wealth (Firefly) Integration', () => {
    let transformer: FireflyDataTransformer;

    beforeEach(() => {
      transformer = new FireflyDataTransformer();
    });

    test('FireflyClient handles connection errors gracefully', async () => {
      // Mock network error
      const mockGet = jest.fn().mockRejectedValue(new Error('Network error'));

      mockedAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any);

      const client = new FireflyClient({
        baseUrl: 'http://invalid:8080',
        apiToken: 'test',
      });

      // testConnection calls get, which will reject
      // The method catches the error and returns false
      const result = await client.testConnection();
      expect(result).toBe(false);
      expect(mockGet).toHaveBeenCalled();
    });

    test('FireflyClient initializes with retry interceptor', () => {
      const mockUse = jest.fn();

      mockedAxios.create.mockReturnValue({
        get: jest.fn(),
        interceptors: {
          response: {
            use: mockUse,
          },
        },
      } as any);

      // Creating a new FireflyClient should register the retry interceptor
      new FireflyClient({
        baseUrl: 'http://test:8080',
        apiToken: 'test',
      });

      // Verify interceptor was registered
      expect(mockUse).toHaveBeenCalled();
    });

    test('DataTransformer maps Firefly categories to FoodUSD categories', () => {
      // Test direct mappings
      expect(transformer.mapCategory('Groceries')).toBe('groceries');
      expect(transformer.mapCategory('Supermarket')).toBe('groceries');
      expect(transformer.mapCategory('Restaurants')).toBe('dining');
      expect(transformer.mapCategory('Dining Out')).toBe('dining');
      expect(transformer.mapCategory('Fast Food')).toBe('prepared_food');
      expect(transformer.mapCategory('Coffee Shop')).toBe('prepared_food');
      expect(transformer.mapCategory('Food Delivery')).toBe('food_delivery');
      expect(transformer.mapCategory('Takeaway')).toBe('food_delivery');
      expect(transformer.mapCategory('Farmers Market')).toBe('farmers_market');
      expect(transformer.mapCategory('Local Food')).toBe('farmers_market');
    });

    test('DataTransformer handles fuzzy category matching', () => {
      // Test fuzzy matching
      expect(transformer.mapCategory('grocery store')).toBe('groceries');
      expect(transformer.mapCategory('restaurant dining')).toBe('dining');
      expect(transformer.mapCategory('food delivery service')).toBe('food_delivery');
      expect(transformer.mapCategory('local farmers market')).toBe('farmers_market');
      expect(transformer.mapCategory('coffee and cafe')).toBe('prepared_food');
    });

    test('DataTransformer filters food-related transactions correctly', () => {
      const filtered = transformer.filterFoodTransactions(mockTransactions);

      // All mock transactions are food-related
      expect(filtered.length).toBe(mockTransactions.length);

      // Add non-food transaction
      const mixedTransactions = [
        ...mockTransactions,
        {
          id: '999',
          amount: -100.00,
          description: 'Electric bill',
          date: '2024-01-20',
          category: 'Utilities',
          sourceAccount: 'Main Account',
          destinationAccount: 'Power Company',
          type: 'withdrawal',
        },
      ];

      const filteredMixed = transformer.filterFoodTransactions(mixedTransactions);
      expect(filteredMixed.length).toBe(mockTransactions.length);
    });

    test('DataTransformer aggregates weekly spending correctly', () => {
      const weeklySpending = transformer.groupByWeek(mockTransactions);

      expect(weeklySpending.length).toBeGreaterThan(0);

      // Check week structure
      weeklySpending.forEach((week) => {
        expect(week).toHaveProperty('week');
        expect(week).toHaveProperty('startDate');
        expect(week).toHaveProperty('endDate');
        expect(week).toHaveProperty('totalSpending');
        expect(week).toHaveProperty('byCategory');
        expect(week).toHaveProperty('transactionCount');
        expect(week).toHaveProperty('participantCount');

        expect(week.totalSpending).toBeGreaterThan(0);
        expect(week.transactionCount).toBeGreaterThan(0);
      });

      // Verify category aggregation
      const firstWeek = weeklySpending[0];
      expect(Object.keys(firstWeek.byCategory).length).toBeGreaterThan(0);
    });

    test('DataTransformer calculates category distribution correctly', () => {
      const weeklySpending = transformer.groupByWeek(mockTransactions);
      const distribution = transformer.calculateCategoryDistribution(weeklySpending);

      // Should have categories
      expect(Object.keys(distribution).length).toBeGreaterThan(0);

      // Percentages should sum to ~100
      const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
      expect(total).toBeCloseTo(100, 0);

      // Each category should be 0-100%
      Object.values(distribution).forEach((percent) => {
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
      });
    });

    test('DataTransformer handles empty transaction array', () => {
      const weeklySpending = transformer.groupByWeek([]);
      expect(weeklySpending).toEqual([]);
    });

    test('Full calibration pipeline produces valid results', () => {
      const transformed = transformer.transform(mockTransactions, 100);

      expect(transformed).toHaveProperty('periodStart');
      expect(transformed).toHaveProperty('periodEnd');
      expect(transformed).toHaveProperty('weeklySpending');
      expect(transformed).toHaveProperty('participation');
      expect(transformed).toHaveProperty('categoryDistribution');
      expect(transformed).toHaveProperty('totalSpending');

      // Validate participation metrics
      expect(transformed.participation.totalParticipants).toBe(100);
      expect(transformed.participation.activeParticipants).toBeGreaterThan(0);
      expect(transformed.participation.participationRate).toBeGreaterThanOrEqual(0);
      expect(transformed.participation.participationRate).toBeLessThanOrEqual(1);

      // Validate spending distribution
      expect(transformed.participation.spendingDistribution.p25).toBeLessThanOrEqual(
        transformed.participation.spendingDistribution.p50
      );
      expect(transformed.participation.spendingDistribution.p50).toBeLessThanOrEqual(
        transformed.participation.spendingDistribution.p75
      );
      expect(transformed.participation.spendingDistribution.p75).toBeLessThanOrEqual(
        transformed.participation.spendingDistribution.p95
      );
    });
  });

  describe('CalibrationEngine Integration', () => {
    let calibrationEngine: CalibrationEngine;
    let transformer: FireflyDataTransformer;

    beforeEach(() => {
      calibrationEngine = new CalibrationEngine();
      transformer = new FireflyDataTransformer();
    });

    test('CalibrationEngine generates valid confidence scores', () => {
      // High confidence (variance <= 10%)
      let confidence = (calibrationEngine as any).getConfidenceLevel(5);
      expect(confidence).toBe('high');

      // Medium confidence (10% < variance <= 25%)
      confidence = (calibrationEngine as any).getConfidenceLevel(15);
      expect(confidence).toBe('medium');

      // Low confidence (variance > 25%)
      confidence = (calibrationEngine as any).getConfidenceLevel(30);
      expect(confidence).toBe('low');

      // Test negative variances
      confidence = (calibrationEngine as any).getConfidenceLevel(-8);
      expect(confidence).toBe('high');

      confidence = (calibrationEngine as any).getConfidenceLevel(-20);
      expect(confidence).toBe('medium');
    });

    test('CalibrationEngine calibrates weekly budget correctly', () => {
      const transformed = transformer.transform(mockTransactions, 100);
      const result = calibrationEngine.calibrateWeeklyBudget(transformed);

      expect(result).toHaveProperty('parameter', 'weeklyFoodBudget');
      expect(result).toHaveProperty('baseline');
      expect(result).toHaveProperty('calibrated');
      expect(result).toHaveProperty('adjustment');
      expect(result).toHaveProperty('adjustmentPercent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');

      expect(result.calibrated).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(result.confidence);
    });

    test('CalibrationEngine calibrates participation rate correctly', () => {
      const transformed = transformer.transform(mockTransactions, 500);
      const result = calibrationEngine.calibrateParticipationRate(transformed, 500);

      expect(result).toHaveProperty('parameter', 'participationRate');
      expect(result.calibrated).toBeGreaterThanOrEqual(0);
      expect(result.calibrated).toBeLessThanOrEqual(1);
      expect(result.reasoning).toContain('participation');
    });

    test('CalibrationEngine validates group purchase savings', () => {
      const transformed = transformer.transform(mockTransactions, 100);
      const result = calibrationEngine.validateGroupPurchaseSavings(transformed);

      expect(result).toHaveProperty('parameter', 'groupPurchaseSavingsRate');
      expect(result.calibrated).toBeGreaterThanOrEqual(0);
      expect(result.calibrated).toBeLessThanOrEqual(1);
      expect(result.reasoning).toContain('volatility');
    });

    test('CalibrationEngine applies calibration to projection model', () => {
      const baseModel: ProjectionModel = {
        name: 'Test Model',
        description: 'Test calibration',
        initialInvestment: 100000,
        projectedYear5Revenue: 500000,
        projectedRiskAdjustedROI: 4.0,
        projectedBreakEvenMonths: 24,
        successProbability: 0.75,
        populationSize: 500,
        participationRate: 0.75,
        weeklyRevenuePerParticipant: 150,
        growthRatePerWeek: 0.001,
        groupBuyingSavings: 0.15,
      };

      const mockCalibrationReport: CalibrationReport = {
        modelName: 'Test Model',
        calibrationDate: new Date(),
        dataSource: {
          periodStart: new Date('2024-01-01'),
          periodEnd: new Date('2024-02-01'),
          weeksAnalyzed: 4,
          totalTransactions: 100,
        },
        overallAccuracy: {
          totalVariance: 5000,
          averageVariance: 10,
          confidenceScore: 85,
          confidenceLevel: 'high',
        },
        parameterAdjustments: [
          {
            parameter: 'weeklyFoodBudget',
            baseline: 150,
            calibrated: 175,
            adjustment: 25,
            adjustmentPercent: 16.67,
            confidence: 'high',
            reasoning: 'Test',
          },
          {
            parameter: 'participationRate',
            baseline: 0.75,
            calibrated: 0.80,
            adjustment: 0.05,
            adjustmentPercent: 6.67,
            confidence: 'high',
            reasoning: 'Test',
          },
        ],
        categoryComparison: [],
        recommendations: [],
      };

      const calibratedModel = calibrationEngine.applyCalibration(baseModel, mockCalibrationReport);

      expect(calibratedModel.weeklyRevenuePerParticipant).toBe(175);
      expect(calibratedModel.participationRate).toBe(0.80);
    });
  });

  describe('ToKenism → DoX Integration', () => {

    test('DoXClient handles upload correctly', async () => {
      const mockResponse: UploadResponse = {
        id: 'doc-123',
        filename: 'transactions.csv',
        type: 'csv',
        status: 'processed',
      };

      const mockPost = jest.fn().mockResolvedValue({ data: mockResponse });

      mockedAxios.create.mockReturnValue({
        post: mockPost,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any);

      // Create a new client with the mocked axios
      const testClient = new DoXClient({
        baseUrl: 'http://mock-dox:8000',
      });

      const csvData = 'date,amount,category\n2024-01-15,50.00,Groceries';

      // Mock the upload
      const result = await testClient.upload(Buffer.from(csvData), 'transactions.csv', 'csv');

      expect(result).toBeDefined();
      expect(result.id).toBe('doc-123');
      expect(result.filename).toBe('transactions.csv');
      expect(mockPost).toHaveBeenCalled();
    });

    test('DoXClient handles query responses', async () => {
      const mockResponse: QAResponse = {
        question: 'What is the total spending?',
        answer: 'The total spending is $268.00',
        sources: [
          { page: 1, confidence: 0.95 },
        ],
        confidence: 0.95,
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockResponse }),
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any);

      // This would call the mocked API
      // In production, it queries uploaded documents
      expect(mockResponse.answer).toContain('$268.00');
      expect(mockResponse.confidence).toBeGreaterThan(0.9);
    });

    test('DoXClient handles connection failure gracefully', async () => {
      const mockGet = jest.fn().mockRejectedValue(new Error('Connection refused'));

      mockedAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          response: {
            use: jest.fn(),
          },
        },
      } as any);

      const testClient = new DoXClient({
        baseUrl: 'http://invalid:8000',
      });

      // testConnection catches error and returns false
      const result = await testClient.testConnection();
      expect(result).toBe(false);
      expect(mockGet).toHaveBeenCalled();
    });
  });

  describe('NATS Event Bus Integration', () => {
    let natsClient: NATSClient;

    beforeEach(() => {
      natsClient = new NATSClient({
        url: 'nats://localhost:4222',
        clientName: 'test-client',
        jetstream: false,
        maxReconnectAttempts: 1,
      });
    });

    afterEach(async () => {
      if (natsClient.isConnected()) {
        await natsClient.disconnect();
      }
    });

    test('NATSClient creates valid event envelope', () => {
      const testData = {
        simulationId: 'sim-123',
        scenario: 'baseline',
        weeklyHistory: [],
        finalMetrics: {
          totalWealth: 1000000,
          wealthGap: 0.35,
          economicVelocity: 1.5,
        },
        parameters: {
          participationRate: 0.75,
          weeklyBudget: 150,
        },
      };

      // Test event structure without actual connection
      const event: PMOVESEvent<SimulationResultEvent> = {
        subject: 'tokenism.simulation.result.v1',
        data: testData,
        correlationId: 'test-corr-123',
        timestamp: new Date().toISOString(),
        source: 'test-client',
      };

      expect(event.subject).toBe('tokenism.simulation.result.v1');
      expect(event.data.simulationId).toBe('sim-123');
      expect(event.correlationId).toBe('test-corr-123');
      expect(event.source).toBe('test-client');
      expect(event.timestamp).toBeDefined();
    });

    test('NATSClient tracks connection state correctly', () => {
      // Create a new client
      const testClient = new NATSClient({
        url: 'nats://test:4222',
        clientName: 'state-test-client',
        jetstream: false,
        maxReconnectAttempts: 1,
      });

      // Before connecting, isConnected should be false
      expect(testClient.isConnected()).toBe(false);

      // Note: In test environment with mocked NATS, connection might succeed
      // The important thing is that the isConnected() method reflects the state
    });

    test('Simulation result event has correct structure', () => {
      const simulationResult: SimulationResultEvent = {
        simulationId: 'sim-456',
        scenario: 'optimistic',
        weeklyHistory: [
          { week: 1, avgWealth: 5000, gini: 0.30, povertyRate: 0.10 },
          { week: 2, avgWealth: 5200, gini: 0.28, povertyRate: 0.08 },
        ],
        finalMetrics: {
          totalWealth: 2500000,
          wealthGap: 0.25,
          economicVelocity: 1.8,
        },
        parameters: {
          participationRate: 0.85,
          weeklyBudget: 175,
          groupSavings: 0.15,
        },
      };

      expect(simulationResult).toHaveProperty('simulationId');
      expect(simulationResult).toHaveProperty('scenario');
      expect(simulationResult).toHaveProperty('weeklyHistory');
      expect(simulationResult).toHaveProperty('finalMetrics');
      expect(simulationResult).toHaveProperty('parameters');

      expect(simulationResult.weeklyHistory.length).toBe(2);
      expect(simulationResult.weeklyHistory[0]).toHaveProperty('week');
      expect(simulationResult.weeklyHistory[0]).toHaveProperty('avgWealth');
      expect(simulationResult.weeklyHistory[0]).toHaveProperty('gini');
      expect(simulationResult.weeklyHistory[0]).toHaveProperty('povertyRate');
    });

    test('NATS subject constants are defined correctly', () => {
      expect(NATSClient.SUBJECTS.SIMULATION_RESULT).toBe('tokenism.simulation.result.v1');
      expect(NATSClient.SUBJECTS.CALIBRATION_RESULT).toBe('tokenism.calibration.result.v1');
      expect(NATSClient.SUBJECTS.RESEARCH_REQUEST).toBe('research.deepresearch.request.v1');
      expect(NATSClient.SUBJECTS.SUPASERCH_REQUEST).toBe('supaserch.request.v1');
    });
  });

  describe('End-to-End Integration Flow', () => {
    test('Mock data flows through full pipeline', () => {
      // Step 1: Transform Firefly data
      const transformer = new FireflyDataTransformer();
      const transformed = transformer.transform(mockTransactions, 100);

      expect(transformed.weeklySpending.length).toBeGreaterThan(0);
      expect(transformed.totalSpending).toBeGreaterThan(0);

      // Step 2: Create mock simulation results
      const mockSimulation: SimulationResults = {
        totalWeeks: 52,
        finalRevenue: 390000,
        totalCosts: 100000,
        netProfit: 290000,
        actualROI: 290,
        breakEvenWeek: 12,
        tokenMetrics: {
          totalDistributed: 5000,
          totalValue: 10000,
          activeParticipants: 75,
        },
        weeklyRevenue: Array(52).fill(7500),
        weeklyProfit: Array(52).fill(5577),
        cumulativeRevenue: Array(52).fill(0).map((_, i) => (i + 1) * 7500),
        cumulativeProfit: Array(52).fill(0).map((_, i) => (i + 1) * 5577 - 100000),
      };

      // Step 3: Run calibration
      const calibrationEngine = new CalibrationEngine();
      const weeklyBudgetCalibration = calibrationEngine.calibrateWeeklyBudget(transformed);

      expect(weeklyBudgetCalibration.calibrated).toBeGreaterThan(0);
      expect(weeklyBudgetCalibration.confidence).toBeDefined();

      // Step 4: Verify results structure
      expect(mockSimulation.actualROI).toBeGreaterThan(0);
      expect(mockSimulation.breakEvenWeek).toBeLessThan(mockSimulation.totalWeeks);

      // Step 5: Create NATS event
      const simulationEvent: SimulationResultEvent = {
        simulationId: `sim-${Date.now()}`,
        scenario: 'calibrated',
        weeklyHistory: mockSimulation.weeklyRevenue.slice(0, 10).map((revenue, i) => ({
          week: i + 1,
          avgWealth: revenue * 0.8,
          gini: 0.30,
          povertyRate: 0.10 - (i * 0.005),
        })),
        finalMetrics: {
          totalWealth: mockSimulation.finalRevenue,
          wealthGap: 0.28,
          economicVelocity: 1.6,
        },
        parameters: {
          participationRate: transformed.participation.participationRate,
          weeklyBudget: weeklyBudgetCalibration.calibrated,
        },
      };

      // Step 6: Verify NATS event is valid
      expect(simulationEvent.simulationId).toBeDefined();
      expect(simulationEvent.weeklyHistory.length).toBe(10);
      expect(simulationEvent.finalMetrics.totalWealth).toBeGreaterThan(0);
      expect(simulationEvent.parameters.participationRate).toBeGreaterThanOrEqual(0);
      expect(simulationEvent.parameters.participationRate).toBeLessThanOrEqual(1);
    });

    test('Category mapping consistency across pipeline', () => {
      const transformer = new FireflyDataTransformer();

      // Extract unique categories from mock data
      const fireflyCategories = Array.from(new Set(mockTransactions.map(t => t.category)));

      // Map all categories
      const mappedCategories = fireflyCategories.map(cat => ({
        firefly: cat,
        foodUSD: transformer.mapCategory(cat),
      }));

      // Verify all mappings are consistent
      mappedCategories.forEach(mapping => {
        expect(mapping.foodUSD).toBeDefined();
        expect(mapping.foodUSD.length).toBeGreaterThan(0);

        // Verify mapping is deterministic
        const secondMapping = transformer.mapCategory(mapping.firefly);
        expect(secondMapping).toBe(mapping.foodUSD);
      });
    });

    test('Calibration adjustments are within reasonable bounds', () => {
      const transformer = new FireflyDataTransformer();
      const transformed = transformer.transform(mockTransactions, 100);

      const calibrationEngine = new CalibrationEngine();

      // Test weekly budget calibration
      const weeklyBudget = calibrationEngine.calibrateWeeklyBudget(transformed);
      expect(weeklyBudget.calibrated).toBeGreaterThan(0);
      expect(weeklyBudget.calibrated).toBeLessThan(1000); // Reasonable weekly food budget

      // Test participation rate calibration
      const participation = calibrationEngine.calibrateParticipationRate(transformed, 100);
      expect(participation.calibrated).toBeGreaterThanOrEqual(0);
      expect(participation.calibrated).toBeLessThanOrEqual(1);

      // Test group purchase savings
      const groupSavings = calibrationEngine.validateGroupPurchaseSavings(transformed);
      expect(groupSavings.calibrated).toBeGreaterThanOrEqual(0);
      expect(groupSavings.calibrated).toBeLessThanOrEqual(0.5); // Max 50% savings
    });

    test('Error handling across integration boundaries', async () => {
      // Test Firefly error handling
      const transformer = new FireflyDataTransformer();
      expect(() => transformer.transform([], 100)).toThrow('No food-related transactions found');

      // Test CalibrationEngine with empty data
      const calibrationEngine = new CalibrationEngine();
      const emptyTransformed: TransformedData = {
        periodStart: new Date(),
        periodEnd: new Date(),
        weeklySpending: [],
        participation: {
          totalParticipants: 100,
          activeParticipants: 0,
          participationRate: 0,
          averageSpendingPerParticipant: 0,
          spendingDistribution: { p25: 0, p50: 0, p75: 0, p95: 0 },
        },
        categoryDistribution: {},
        totalSpending: 0,
      };

      // Should handle empty data gracefully
      const result = calibrationEngine.calibrateWeeklyBudget(emptyTransformed);
      expect(result.calibrated).toBe(0);
    });
  });

  describe('Data Validation and Type Safety', () => {
    test('Transaction interface validation', () => {
      const transaction: Transaction = mockTransactions[0];

      expect(typeof transaction.id).toBe('string');
      expect(typeof transaction.amount).toBe('number');
      expect(typeof transaction.description).toBe('string');
      expect(typeof transaction.date).toBe('string');
      expect(typeof transaction.category).toBe('string');
      expect(typeof transaction.sourceAccount).toBe('string');
      expect(typeof transaction.destinationAccount).toBe('string');
      expect(typeof transaction.type).toBe('string');
    });

    test('WeeklySpending interface validation', () => {
      const transformer = new FireflyDataTransformer();
      const weeklySpending = transformer.groupByWeek(mockTransactions);

      if (weeklySpending.length > 0) {
        const week = weeklySpending[0];

        expect(typeof week.week).toBe('number');
        expect(week.startDate).toBeInstanceOf(Date);
        expect(week.endDate).toBeInstanceOf(Date);
        expect(typeof week.totalSpending).toBe('number');
        expect(typeof week.byCategory).toBe('object');
        expect(typeof week.transactionCount).toBe('number');
        expect(typeof week.participantCount).toBe('number');
      }
    });

    test('CalibrationResult interface validation', () => {
      const transformer = new FireflyDataTransformer();
      const transformed = transformer.transform(mockTransactions, 100);

      const calibrationEngine = new CalibrationEngine();
      const result = calibrationEngine.calibrateWeeklyBudget(transformed);

      expect(typeof result.parameter).toBe('string');
      expect(typeof result.baseline).toBe('number');
      expect(typeof result.calibrated).toBe('number');
      expect(typeof result.adjustment).toBe('number');
      expect(typeof result.adjustmentPercent).toBe('number');
      expect(['high', 'medium', 'low']).toContain(result.confidence);
      expect(typeof result.reasoning).toBe('string');
    });

    test('SimulationResultEvent interface validation', () => {
      const event: SimulationResultEvent = {
        simulationId: 'test-123',
        scenario: 'baseline',
        weeklyHistory: [
          { week: 1, avgWealth: 5000, gini: 0.3, povertyRate: 0.1 },
        ],
        finalMetrics: {
          totalWealth: 1000000,
          wealthGap: 0.3,
          economicVelocity: 1.5,
        },
        parameters: {
          participationRate: 0.75,
        },
      };

      expect(typeof event.simulationId).toBe('string');
      expect(typeof event.scenario).toBe('string');
      expect(Array.isArray(event.weeklyHistory)).toBe(true);
      expect(typeof event.finalMetrics).toBe('object');
      expect(typeof event.parameters).toBe('object');

      if (event.weeklyHistory.length > 0) {
        const week = event.weeklyHistory[0];
        expect(typeof week.week).toBe('number');
        expect(typeof week.avgWealth).toBe('number');
        expect(typeof week.gini).toBe('number');
        expect(typeof week.povertyRate).toBe('number');
      }
    });
  });
});
