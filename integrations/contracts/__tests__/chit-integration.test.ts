/**
 * CHIT Integration Tests
 *
 * Comprehensive tests for the CHIT (Context-Hybrid Information Token) module:
 * - DirichletWeights: Attribution probability distributions
 * - HyperbolicEncoder: Poincaré disk encoding
 * - ShapeAttribution: Merkle proof generation and verification
 * - CGPGenerator: CGP v2 document generation
 * - SwarmAttribution: swarm.meta.v1 integration
 */

import {
  DirichletWeights,
  HyperbolicEncoder,
  ShapeAttribution,
  CGPGenerator,
  SwarmAttribution,
  createCHITSystem,
  CHIT_VERSION,
  CHIT_NATS_SUBJECTS,
  validateCGPDocument,
} from '../chit';

describe('CHIT Integration Module', () => {
  // ============================================================
  // DirichletWeights Tests
  // ============================================================
  describe('DirichletWeights', () => {
    let weights: DirichletWeights;

    beforeEach(() => {
      weights = new DirichletWeights({
        smoothingAlpha: 0.1,
        concentrationK: 1.0,
        decayHalfLife: 12,
      });
    });

    test('should initialize with default config', () => {
      const defaultWeights = new DirichletWeights();
      const config = defaultWeights['config'];
      expect(config.smoothingAlpha).toBe(0.1);
      expect(config.concentrationK).toBe(1.0);
      expect(config.decayHalfLife).toBe(12);
    });

    test('should add contributions and calculate weights', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xDEF', 50, 'groceries', 1);

      const attribution = weights.getExpectedAttribution('groceries');
      expect(attribution.length).toBe(2);

      // Higher contribution should have higher weight
      const abcWeight = attribution.find(a => a.address === '0xABC')!;
      const defWeight = attribution.find(a => a.address === '0xDEF')!;
      expect(abcWeight.weight).toBeGreaterThan(defWeight.weight);
    });

    test('should have weights sum to 1', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xDEF', 50, 'groceries', 1);
      weights.addContribution('0xGHI', 25, 'groceries', 1);

      const attribution = weights.getExpectedAttribution('groceries');
      const sum = attribution.reduce((acc, a) => acc + a.weight, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-10);
    });

    test('should verify weight sum', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xDEF', 50, 'groceries', 1);

      expect(weights.verifyWeightSum('groceries')).toBe(true);
    });

    test('should apply decay over time', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);

      const before = weights.getExpectedAttribution('groceries')[0];
      weights.applyDecay(5); // 4 weeks of inactivity
      const after = weights.getExpectedAttribution('groceries')[0];

      expect(after.alphaComponent).toBeLessThan(before.alphaComponent);
    });

    test('should handle multiple categories', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xABC', 50, 'utilities', 1);

      const categories = weights.getCategories();
      expect(categories).toContain('groceries');
      expect(categories).toContain('utilities');
    });

    test('should export attribution data', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xDEF', 50, 'groceries', 1);

      const exported = weights.exportAttribution();
      expect(exported.length).toBe(2);
      expect(exported[0]).toHaveProperty('address');
      expect(exported[0]).toHaveProperty('category');
      expect(exported[0]).toHaveProperty('weight');
      expect(exported[0]).toHaveProperty('rawContribution');
      expect(exported[0]).toHaveProperty('alphaComponent');
    });

    test('should sample weights from Dirichlet distribution', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.addContribution('0xDEF', 50, 'groceries', 1);

      // Test Monte Carlo sampling (useMean = false)
      const samples = weights.sampleWeights('groceries', false);
      expect(samples.length).toBe(2);

      const sum = samples.reduce((acc, s) => acc + s.weight, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    test('should reset state', () => {
      weights.addContribution('0xABC', 100, 'groceries', 1);
      weights.reset();

      expect(weights.getCategories().length).toBe(0);
      expect(weights.getCurrentWeek()).toBe(0);
    });
  });

  // ============================================================
  // HyperbolicEncoder Tests
  // ============================================================
  describe('HyperbolicEncoder', () => {
    let encoder: HyperbolicEncoder;

    beforeEach(() => {
      encoder = new HyperbolicEncoder({
        curvature: -1,
        baseRadius: 0.3,
        maxRadius: 0.95,
      });
    });

    test('should create points within Poincaré disk', () => {
      const point = encoder.createPoint(0.5, 0.3);
      expect(point.radius).toBeLessThan(1);
      expect(point.x).toBeGreaterThanOrEqual(-1);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(-1);
      expect(point.y).toBeLessThanOrEqual(1);
    });

    test('should clamp points outside disk to maxRadius', () => {
      const point = encoder.createPoint(1.5, 1.5);
      expect(point.radius).toBeLessThanOrEqual(0.95);
    });

    test('should convert between polar and Cartesian', () => {
      const { x, y } = encoder.toCartesian(0.5, Math.PI / 4);
      const { radius, theta } = encoder.toPolar(x, y);

      expect(Math.abs(radius - 0.5)).toBeLessThan(1e-10);
      expect(Math.abs(theta - Math.PI / 4)).toBeLessThan(1e-10);
    });

    test('should calculate hyperbolic distance', () => {
      const a = encoder.createPoint(0, 0);
      const b = encoder.createPoint(0.5, 0);

      const distance = encoder.hyperbolicDistance(a, b);
      expect(distance).toBeGreaterThan(0);
      expect(isFinite(distance)).toBe(true);
    });

    test('should handle Möbius transformation', () => {
      const point = encoder.createPoint(0.3, 0.3);
      const center = encoder.createPoint(0.2, 0.1);

      const transformed = encoder.mobiusTransform(point, center);
      expect(transformed.radius).toBeLessThan(1);
    });

    test('should encode hierarchy tree', () => {
      const root = {
        id: 'root',
        label: 'Economy',
        value: 1000,
        children: [
          { id: 'grotoken', label: 'GroToken', value: 500, children: [] },
          { id: 'foodusd', label: 'FoodUSD', value: 300, children: [] },
        ],
      };

      const points = encoder.encodeHierarchy(root);
      expect(points.length).toBe(3); // root + 2 children
      expect(encoder.validatePoints(points)).toBe(true);
    });

    test('should encode participants by activity', () => {
      const participants = new Map([
        ['0xABC', { value: 100, category: 'active' }],
        ['0xDEF', { value: 50, category: 'active' }],
        ['0xGHI', { value: 10, category: 'inactive' }],
      ]);

      const points = encoder.encodeParticipants(participants);
      expect(points.length).toBe(3);

      // Higher value = closer to center (smaller radius)
      const abcPoint = points.find(p => p.id === '0xABC')!;
      const ghiPoint = points.find(p => p.id === '0xGHI')!;
      expect(abcPoint.radius).toBeLessThan(ghiPoint.radius);
    });

    test('should create CGP super node', () => {
      const hierarchy = {
        id: 'week-1',
        label: 'Week 1',
        value: 1000,
        children: [
          { id: 'child1', label: 'Child 1', value: 500, children: [] },
        ],
      };

      const superNode = encoder.createCGPSuperNode('sn-1', 'Test SuperNode', hierarchy);
      expect(superNode.id).toBe('sn-1');
      expect(superNode.label).toBe('Test SuperNode');
      expect(superNode.constellations.length).toBe(1);
    });

    test('should apply exponential map', () => {
      const point = encoder.exponentialMap(0.1, 0.1);
      expect(point.radius).toBeLessThan(1);
    });
  });

  // ============================================================
  // ShapeAttribution Tests
  // ============================================================
  describe('ShapeAttribution', () => {
    let attribution: ShapeAttribution;

    beforeEach(() => {
      attribution = new ShapeAttribution({
        merkle: { strategy: 'per_week', hashAlgorithm: 'sha256', signProofs: false },
      });
    });

    test('should record actions and generate CHIT IDs', () => {
      // recordAction takes 5 positional arguments: address, action, amount, week, category
      const chitId = attribution.recordAction(
        '0xABC',
        'spending',
        100,
        1,
        'groceries'
      );

      expect(chitId).toBeDefined();
      expect(chitId.startsWith('chit-')).toBe(true);
    });

    test('should get attribution by address', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const records = attribution.getAddressAttribution('0xABC');
      expect(records.length).toBe(1);
      expect(records[0].address).toBe('0xABC');
    });

    test('should get attribution by week', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');
      attribution.recordAction('0xDEF', 'spending', 50, 2, 'groceries');

      const week1Records = attribution.getWeekAttribution(1);
      const week2Records = attribution.getWeekAttribution(2);

      expect(week1Records.length).toBe(1);
      expect(week2Records.length).toBe(1);
    });

    test('should generate Merkle proofs via getRecord', () => {
      const chitId = attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      // Proof is stored in the record itself - use getRecord to access it
      const record = attribution.getRecord(chitId);
      expect(record).toBeDefined();
      expect(record!.proof.merkleRoot).toBeDefined();
      expect(record!.proof.leafHash).toBeDefined();
      expect(Array.isArray(record!.proof.path)).toBe(true);
    });

    test('should verify attribution records', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const records = attribution.getAddressAttribution('0xABC');
      const isValid = attribution.verifyAttribution(records[0]);
      expect(isValid).toBe(true);
    });

    test('should get Dirichlet attribution weights', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');
      attribution.recordAction('0xDEF', 'spending', 50, 1, 'groceries');

      // Use getDirichletWeights() instead of getExpectedAttribution()
      const weights = attribution.getDirichletWeights('groceries');
      expect(weights.length).toBe(2);

      const sum = weights.reduce((acc, w) => acc + w.weight, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    test('should export CGP document', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const cgp = attribution.exportCGP(1);
      expect(cgp.spec).toBe('chit.cgp.v0.2');
      expect(cgp.super_nodes.length).toBeGreaterThan(0);
    });

    test('should apply decay', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const before = attribution.getDirichletWeights('groceries')[0];
      attribution.applyDecay(5);
      const after = attribution.getDirichletWeights('groceries')[0];

      expect(after.alphaComponent).toBeLessThan(before.alphaComponent);
    });

    test('should support different Merkle strategies', () => {
      const perContract = new ShapeAttribution({
        merkle: { strategy: 'per_contract', hashAlgorithm: 'sha256', signProofs: false },
      });

      const chitId = perContract.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const record = perContract.getRecord(chitId);
      expect(record!.proof.merkleRoot).toBeDefined();
    });
  });

  // ============================================================
  // CGPGenerator Tests
  // ============================================================
  describe('CGPGenerator', () => {
    let generator: CGPGenerator;
    let attribution: ShapeAttribution;
    let encoder: HyperbolicEncoder;

    beforeEach(() => {
      generator = new CGPGenerator({
        namespace: 'test.tokenism',
        includeProofs: true,
        includeHyperbolic: true,
      });

      attribution = new ShapeAttribution();
      encoder = new HyperbolicEncoder();
    });

    test('should generate weekly CGP', () => {
      // Use positional arguments: address, action, amount, week, category
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const weekData = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const cgp = generator.generateWeeklyCGP(weekData, attribution, encoder);

      expect(cgp.spec).toBe('chit.cgp.v0.2');
      expect(cgp.summary).toContain('Week 1');
      expect(cgp.super_nodes.length).toBe(7); // One per contract type
    });

    test('should generate simulation CGP', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');
      attribution.recordAction('0xDEF', 'spending', 50, 2, 'groceries');

      const weeks = [
        { week: 1, gini: 0.4, povertyRate: 0.15, totalWealth: 100000, totalSpending: 5000, totalSavings: 1000, participantCount: 50 },
        { week: 2, gini: 0.38, povertyRate: 0.14, totalWealth: 105000, totalSpending: 5500, totalSavings: 1100, participantCount: 52 },
      ];

      const cgp = generator.generateSimulationCGP(weeks, attribution, encoder);

      expect(cgp.summary).toContain('Weeks 1 to 2');
      expect(cgp.meta?.week_range).toEqual([1, 2]);
    });

    test('should validate generated CGP', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const weekData = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const cgp = generator.generateWeeklyCGP(weekData, attribution, encoder);
      const validation = generator.validateCGP(cgp);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid CGP', () => {
      const invalidCGP = {
        spec: 'invalid',
        super_nodes: [],
      } as any;

      const validation = generator.validateCGP(invalidCGP);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should include hyperbolic encoding when enabled', () => {
      attribution.recordAction('0xABC', 'spending', 100, 1, 'groceries');

      const weekData = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const cgp = generator.generateWeeklyCGP(weekData, attribution, encoder);

      expect(cgp.hyperbolic).toBeDefined();
      expect(cgp.hyperbolic?.space).toBe('poincare_disk');
    });
  });

  // ============================================================
  // SwarmAttribution Tests
  // ============================================================
  describe('SwarmAttribution', () => {
    let swarm: SwarmAttribution;

    beforeEach(() => {
      swarm = new SwarmAttribution({
        namespace: 'test.tokenism',
        modality: 'economic_simulation',
        optimizationTarget: 'gini_reduction',
      });
    });

    test('should create swarm meta from simulation', () => {
      const simulation = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const meta = swarm.createSwarmMeta(simulation);

      expect(meta.namespace).toBe('test.tokenism');
      expect(meta.modality).toBe('economic_simulation');
      expect(meta.status).toBe('active');
      expect(meta.pack_id).toBe('sim-week-1');
      expect(meta.metrics).toBeDefined();
    });

    test('should calculate fitness score', () => {
      const simulation = {
        week: 1,
        gini: 0.3, // At target
        povertyRate: 0.1, // At target
        totalWealth: 100000,
        totalSpending: 7500, // ~7.5% of wealth
        totalSavings: 1125, // ~15% of spending
        participantCount: 50,
      };

      const fitness = swarm.calculateFitness(simulation);

      expect(fitness).toBeGreaterThan(0);
      expect(fitness).toBeLessThanOrEqual(1);
    });

    test('should track best fitness', () => {
      const sim1 = { week: 1, gini: 0.5, povertyRate: 0.2, totalWealth: 100000, totalSpending: 5000, totalSavings: 1000, participantCount: 50 };
      const sim2 = { week: 2, gini: 0.3, povertyRate: 0.1, totalWealth: 110000, totalSpending: 7500, totalSavings: 1125, participantCount: 55 };

      swarm.createSwarmMeta(sim1);
      swarm.createSwarmMeta(sim2);

      const bestFitness = swarm.getBestFitness();
      expect(bestFitness).toBeGreaterThan(-Infinity);
    });

    test('should extract metrics', () => {
      const simulation = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const metrics = swarm.extractMetrics(simulation);

      expect(metrics.gini).toBe(0.4);
      expect(metrics.poverty_rate).toBe(0.15);
      expect(metrics.total_wealth).toBe(100000);
    });

    test('should calculate delta metrics', () => {
      const sim1 = { week: 1, gini: 0.5, povertyRate: 0.2, totalWealth: 100000, totalSpending: 5000, totalSavings: 1000, participantCount: 50 };
      const sim2 = { week: 2, gini: 0.4, povertyRate: 0.15, totalWealth: 110000, totalSpending: 5500, totalSavings: 1100, participantCount: 52 };

      swarm.calculateFitness(sim1);
      const metrics = swarm.extractMetrics(sim2);

      expect(metrics.gini_delta).toBeDefined();
      expect(metrics.gini_delta).toBeCloseTo(-0.1, 10);
    });

    test('should support different optimization targets', () => {
      const wealthSwarm = new SwarmAttribution({
        optimizationTarget: 'wealth_growth',
      });

      const participationSwarm = new SwarmAttribution({
        optimizationTarget: 'participation',
      });

      const simulation = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 200000, // High wealth
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const wealthFitness = wealthSwarm.calculateFitness(simulation);
      const participationFitness = participationSwarm.calculateFitness(simulation);

      // Different targets should produce different scores for same data
      expect(wealthFitness).not.toBe(participationFitness);
    });

    test('should manage populations', () => {
      const population = swarm.createPopulation('pop-1', 'Test Population');

      expect(population.id).toBe('pop-1');
      expect(population.name).toBe('Test Population');
      expect(population.generations).toHaveLength(0);
    });

    test('should record generations in population', () => {
      swarm.createPopulation('pop-1', 'Test Population');

      const simulation = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const record = swarm.recordGeneration('pop-1', 1, simulation);

      expect(record.generation).toBe(1);
      expect(record.fitness).toBeGreaterThan(0);
    });

    test('should get population summary', () => {
      swarm.createPopulation('pop-1', 'Test Population');

      const simulations = [
        { week: 1, gini: 0.5, povertyRate: 0.2, totalWealth: 100000, totalSpending: 5000, totalSavings: 1000, participantCount: 50 },
        { week: 2, gini: 0.4, povertyRate: 0.15, totalWealth: 110000, totalSpending: 5500, totalSavings: 1100, participantCount: 52 },
      ];

      for (let i = 0; i < simulations.length; i++) {
        swarm.recordGeneration('pop-1', i + 1, simulations[i]);
      }

      const summary = swarm.getPopulationSummary('pop-1');

      expect(summary).not.toBeNull();
      expect(summary?.generations).toBe(2);
      expect(summary?.fitnessImprovement).toBeGreaterThan(0);
    });

    test('should reset state', () => {
      swarm.createPopulation('pop-1', 'Test');
      swarm.reset();

      expect(swarm.getBestFitness()).toBe(-Infinity);
      expect(swarm.getPopulationSummary('pop-1')).toBeNull();
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================
  describe('CHIT System Integration', () => {
    test('should create complete CHIT system', () => {
      const system = createCHITSystem({
        dirichlet: { smoothingAlpha: 0.1 },
        hyperbolic: { curvature: -1 },
        merkle: { strategy: 'per_week', hashAlgorithm: 'sha256', signProofs: false },
        cgp: { namespace: 'test.tokenism' },
        swarm: { optimizationTarget: 'gini_reduction' },
      });

      expect(system.dirichlet).toBeDefined();
      expect(system.encoder).toBeDefined();
      expect(system.attribution).toBeDefined();
      expect(system.generator).toBeDefined();
      expect(system.swarm).toBeDefined();
    });

    test('should provide version information', () => {
      expect(CHIT_VERSION.module).toBe('1.0.0');
      expect(CHIT_VERSION.cgpSchema).toBe('chit.cgp.v0.2');
      expect(CHIT_VERSION.swarmSchema).toBe('swarm.meta.v1');
    });

    test('should provide NATS subjects', () => {
      expect(CHIT_NATS_SUBJECTS.attributionRecorded).toBe('tokenism.attribution.recorded.v1');
      expect(CHIT_NATS_SUBJECTS.cgpWeekly).toBe('tokenism.cgp.weekly.v1');
    });

    test('should validate CGP documents via utility function', () => {
      const cgp = {
        spec: 'chit.cgp.v0.2' as const,
        summary: 'Test CGP',
        created_at: new Date().toISOString(),
        super_nodes: [
          {
            id: 'test-node',
            label: 'Test',
            x: 0,
            y: 0,
            r: 0,
            constellations: [
              {
                id: 'test-constellation',
                anchor: [0.5, 0.5, 0.5],
                points: [{ id: 'point-1', x: 0.1, y: 0.2 }],
              },
            ],
          },
        ],
      };

      const result = validateCGPDocument(cgp);
      expect(result.valid).toBe(true);
    });

    test('should flow data through complete system', () => {
      const system = createCHITSystem();

      // 1. Record attribution - use positional args: address, action, amount, week, category
      const chitId = system.attribution.recordAction(
        '0xABC',
        'spending',
        100,
        1,
        'groceries'
      );
      expect(chitId).toBeDefined();

      // 2. Get attribution weights - use getDirichletWeights() not getExpectedAttribution()
      const weights = system.attribution.getDirichletWeights('groceries');
      expect(weights.length).toBe(1);

      // 3. Generate CGP
      const weekData = {
        week: 1,
        gini: 0.4,
        povertyRate: 0.15,
        totalWealth: 100000,
        totalSpending: 5000,
        totalSavings: 1000,
        participantCount: 50,
      };

      const cgp = system.generator.generateWeeklyCGP(
        weekData,
        system.attribution,
        system.encoder
      );
      expect(cgp.spec).toBe('chit.cgp.v0.2');

      // 4. Get swarm meta
      const meta = system.swarm.createSwarmMeta(weekData);
      expect(meta.status).toBe('active');

      // 5. Validate CGP
      const validation = system.generator.validateCGP(cgp);
      expect(validation.valid).toBe(true);
    });
  });
});
