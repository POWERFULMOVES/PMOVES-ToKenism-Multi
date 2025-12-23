/**
 * Hyperbolic Encoder
 *
 * Encodes hierarchical economic data in the Poincaré disk model.
 * In hyperbolic space:
 * - Center (origin) = aggregate/total economy
 * - First ring = contract types (GroToken, FoodUSD, etc.)
 * - Outer rings = individual transactions/participants
 * - Distance from center = specificity/depth/uncertainty
 *
 * Key operations:
 * - Möbius transformation for hierarchical nesting
 * - Hyperbolic distance for similarity measures
 * - Exponential mapping for tree structures
 */

export interface PoincarePoint {
  /** x coordinate in Poincaré disk [-1, 1] */
  x: number;
  /** y coordinate in Poincaré disk [-1, 1] */
  y: number;
  /** Euclidean radius from origin = sqrt(x² + y²) < 1 */
  radius: number;
  /** Angular position in radians [0, 2π] */
  theta: number;
  /** Optional identifier */
  id?: string;
  /** Optional label */
  label?: string;
}

export interface HierarchyNode {
  id: string;
  label: string;
  value: number;
  children: HierarchyNode[];
  metadata?: Record<string, unknown>;
}

export interface EncoderConfig {
  /** Curvature of hyperbolic space (negative, typically -1) */
  curvature: number;
  /** Base radius for first-level nodes */
  baseRadius: number;
  /** Radius growth factor per level */
  radiusGrowth: number;
  /** Angular spread factor */
  angularSpread: number;
  /** Maximum allowed radius (must be < 1) */
  maxRadius: number;
}

export interface CGPSuperNode {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  constellations: CGPConstellation[];
  meta?: Record<string, unknown>;
}

export interface CGPConstellation {
  id: string;
  summary?: string;
  anchor: number[];
  points: CGPPoint[];
}

export interface CGPPoint {
  id: string;
  x: number;
  y: number;
  text?: string;
  proj?: number;
  conf?: number;
  modality?: string;
}

export class HyperbolicEncoder {
  private config: EncoderConfig;

  constructor(config: Partial<EncoderConfig> = {}) {
    this.config = {
      curvature: -1,
      baseRadius: 0.3,
      radiusGrowth: 0.5,
      angularSpread: 0.8,
      maxRadius: 0.95,
      ...config,
    };
  }

  /**
   * Convert Cartesian (x, y) to polar (r, θ)
   */
  toPolar(x: number, y: number): { radius: number; theta: number } {
    const radius = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return { radius, theta: theta < 0 ? theta + 2 * Math.PI : theta };
  }

  /**
   * Convert polar (r, θ) to Cartesian (x, y)
   */
  toCartesian(radius: number, theta: number): { x: number; y: number } {
    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
    };
  }

  /**
   * Create a Poincaré point from coordinates
   */
  createPoint(x: number, y: number, id?: string, label?: string): PoincarePoint {
    // Clamp to valid disk region
    let r = Math.sqrt(x * x + y * y);
    if (r >= 1) {
      const scale = this.config.maxRadius / r;
      x *= scale;
      y *= scale;
      r = this.config.maxRadius;
    }

    const { radius, theta } = this.toPolar(x, y);
    return { x, y, radius, theta, id, label };
  }

  /**
   * Create a point at given radius and angle
   */
  createPolarPoint(radius: number, theta: number, id?: string, label?: string): PoincarePoint {
    const clampedRadius = Math.min(radius, this.config.maxRadius);
    const { x, y } = this.toCartesian(clampedRadius, theta);
    return { x, y, radius: clampedRadius, theta, id, label };
  }

  /**
   * Calculate hyperbolic distance between two points in Poincaré disk
   * d_H(u, v) = acosh(1 + 2 * |u-v|² / ((1-|u|²)(1-|v|²)))
   */
  hyperbolicDistance(a: PoincarePoint, b: PoincarePoint): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const euclideanDistSq = dx * dx + dy * dy;

    const aNormSq = a.x * a.x + a.y * a.y;
    const bNormSq = b.x * b.x + b.y * b.y;

    // Handle edge cases
    if (aNormSq >= 1 || bNormSq >= 1) {
      return Infinity;
    }

    const denominator = (1 - aNormSq) * (1 - bNormSq);
    if (denominator <= 0) {
      return Infinity;
    }

    const argument = 1 + (2 * euclideanDistSq) / denominator;
    return Math.acosh(Math.max(1, argument));
  }

  /**
   * Möbius addition in Poincaré disk: x ⊕ y
   * Used for translating/nesting points within the disk
   */
  mobiusAdd(a: PoincarePoint, b: PoincarePoint): PoincarePoint {
    const ax = a.x, ay = a.y;
    const bx = b.x, by = b.y;

    const aNormSq = ax * ax + ay * ay;
    const bNormSq = bx * bx + by * by;
    const dotAB = ax * bx + ay * by;

    const numeratorX = (1 + 2 * dotAB + bNormSq) * ax + (1 - aNormSq) * bx;
    const numeratorY = (1 + 2 * dotAB + bNormSq) * ay + (1 - aNormSq) * by;
    const denominator = 1 + 2 * dotAB + aNormSq * bNormSq;

    if (Math.abs(denominator) < 1e-10) {
      return this.createPoint(0, 0, 'origin');
    }

    const x = numeratorX / denominator;
    const y = numeratorY / denominator;

    return this.createPoint(x, y, b.id, b.label);
  }

  /**
   * Möbius transformation: move disk so point 'center' becomes origin
   * T_a(z) = (z - a) / (1 - ā·z)
   */
  mobiusTransform(point: PoincarePoint, center: PoincarePoint): PoincarePoint {
    const zx = point.x, zy = point.y;
    const ax = center.x, ay = center.y;

    // z - a
    const diffX = zx - ax;
    const diffY = zy - ay;

    // 1 - ā·z (conjugate of a times z)
    const conjDot = ax * zx + ay * zy;
    const denomRe = 1 - conjDot;
    const denomIm = -(ax * zy - ay * zx);

    const denomNormSq = denomRe * denomRe + denomIm * denomIm;
    if (denomNormSq < 1e-10) {
      return this.createPoint(0, 0, point.id, point.label);
    }

    // Complex division: (diffX + i*diffY) / (denomRe + i*denomIm)
    const x = (diffX * denomRe + diffY * denomIm) / denomNormSq;
    const y = (diffY * denomRe - diffX * denomIm) / denomNormSq;

    return this.createPoint(x, y, point.id, point.label);
  }

  /**
   * Exponential map: project tangent vector onto disk
   * Maps from Euclidean tangent space to hyperbolic disk
   */
  exponentialMap(tangentX: number, tangentY: number, basePoint?: PoincarePoint): PoincarePoint {
    const norm = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (norm < 1e-10) {
      return basePoint ?? this.createPoint(0, 0);
    }

    const c = Math.abs(this.config.curvature);
    const lambda = basePoint ? 2 / (1 - (basePoint.x ** 2 + basePoint.y ** 2)) : 2;

    const scaledNorm = norm * lambda * Math.sqrt(c);
    const factor = Math.tanh(scaledNorm / 2) / (scaledNorm);

    const vx = tangentX * factor * lambda;
    const vy = tangentY * factor * lambda;

    if (basePoint) {
      return this.mobiusAdd(basePoint, this.createPoint(vx, vy));
    }

    return this.createPoint(vx, vy);
  }

  /**
   * Encode a hierarchy tree into Poincaré disk points
   * Root at center, children spread outward
   */
  encodeHierarchy(root: HierarchyNode, depth: number = 0, _parentPoint?: PoincarePoint, startAngle: number = 0, angleSpan: number = 2 * Math.PI): PoincarePoint[] {
    const points: PoincarePoint[] = [];

    // Calculate radius for this depth level
    const radius = depth === 0
      ? 0
      : Math.min(this.config.baseRadius + depth * this.config.radiusGrowth * 0.3, this.config.maxRadius);

    // Calculate angle for this node
    const angle = startAngle + angleSpan / 2;
    const { x, y } = this.toCartesian(radius, angle);

    const nodePoint = this.createPoint(x, y, root.id, root.label);
    points.push(nodePoint);

    // Encode children
    if (root.children.length > 0) {
      const childAngleSpan = (angleSpan * this.config.angularSpread) / root.children.length;

      for (let i = 0; i < root.children.length; i++) {
        const childStartAngle = startAngle + i * childAngleSpan +
          (1 - this.config.angularSpread) * angleSpan / 2;

        const childPoints = this.encodeHierarchy(
          root.children[i],
          depth + 1,
          nodePoint,
          childStartAngle,
          childAngleSpan
        );
        points.push(...childPoints);
      }
    }

    return points;
  }

  /**
   * Encode participants by their activity level
   * More active = closer to center, less active = outer edge
   */
  encodeParticipants(participants: Map<string, { value: number; category: string }>): PoincarePoint[] {
    const points: PoincarePoint[] = [];
    const entries = Array.from(participants.entries());

    if (entries.length === 0) return points;

    // Find max value for normalization
    const maxValue = Math.max(...entries.map(([, p]) => p.value));

    // Group by category
    const byCategory = new Map<string, Array<{ address: string; value: number }>>();
    for (const [address, data] of entries) {
      if (!byCategory.has(data.category)) {
        byCategory.set(data.category, []);
      }
      byCategory.get(data.category)!.push({ address, value: data.value });
    }

    // Assign angles per category
    const categories = Array.from(byCategory.keys());
    const anglePerCategory = (2 * Math.PI) / categories.length;

    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const category = categories[catIdx];
      const participants = byCategory.get(category)!;
      const baseAngle = catIdx * anglePerCategory;
      const anglePerParticipant = anglePerCategory / participants.length;

      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        // Higher value = closer to center
        const normalizedValue = maxValue > 0 ? p.value / maxValue : 0;
        const radius = this.config.maxRadius - normalizedValue * (this.config.maxRadius - this.config.baseRadius);
        const angle = baseAngle + i * anglePerParticipant + anglePerParticipant / 2;

        points.push(this.createPolarPoint(radius, angle, p.address, `${category}:${p.address}`));
      }
    }

    return points;
  }

  /**
   * Create CGP SuperNode from encoded hierarchy
   */
  createCGPSuperNode(
    id: string,
    label: string,
    hierarchy: HierarchyNode,
    metadata?: Record<string, unknown>
  ): CGPSuperNode {
    const points = this.encodeHierarchy(hierarchy);
    const rootPoint = points[0] ?? this.createPoint(0, 0);

    // Group points into constellations by depth
    const constellations: CGPConstellation[] = [];

    // Children become constellations
    for (let i = 0; i < hierarchy.children.length; i++) {
      const child = hierarchy.children[i];
      const childPoints = this.encodeHierarchy(child, 1);

      const cgpPoints: CGPPoint[] = childPoints.map(p => ({
        id: p.id ?? `point-${i}`,
        x: p.x,
        y: p.y,
        text: p.label,
        proj: p.radius,
        conf: 1 - p.radius, // Confidence decreases with distance from center
      }));

      constellations.push({
        id: child.id,
        summary: child.label,
        anchor: childPoints.length > 0 ? [childPoints[0].x, childPoints[0].y] : [0, 0],
        points: cgpPoints,
      });
    }

    return {
      id,
      label,
      x: rootPoint.x,
      y: rootPoint.y,
      r: rootPoint.radius,
      constellations,
      meta: metadata,
    };
  }

  /**
   * Validate that all points are within the Poincaré disk
   */
  validatePoints(points: PoincarePoint[]): boolean {
    return points.every(p => p.radius < 1);
  }

  /**
   * Get configuration
   */
  getConfig(): EncoderConfig {
    return { ...this.config };
  }
}
