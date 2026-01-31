/**
 * PMOVES.AI Design System Tokens
 *
 * Centralized design tokens for consistent styling across the application.
 * These tokens complement Tailwind CSS and provide semantic naming.
 */

// ============================================
// Elevation (Box Shadows)
// ============================================
export const elevation = {
  /** Subtle shadow for cards at rest */
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  /** Medium shadow for interactive elements */
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  /** Large shadow for modals and popovers */
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  /** Extra large shadow for floating elements */
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  /** No shadow */
  none: 'none',
} as const;

// ============================================
// Spacing (Based on 4px grid)
// ============================================
export const spacing = {
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
} as const;

// ============================================
// Transitions
// ============================================
export const transitions = {
  /** Fast transition for micro-interactions */
  fast: {
    duration: '150ms',
    timing: 'ease-out',
    css: 'all 150ms ease-out',
  },
  /** Default transition for most interactions */
  default: {
    duration: '200ms',
    timing: 'ease-out',
    css: 'all 200ms ease-out',
  },
  /** Slow transition for emphasis */
  slow: {
    duration: '300ms',
    timing: 'ease-in-out',
    css: 'all 300ms ease-in-out',
  },
  /** Spring-like transition for playful interactions */
  spring: {
    duration: '350ms',
    timing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    css: 'all 350ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const;

// ============================================
// Animation Durations
// ============================================
export const animationDurations = {
  instant: '0ms',
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '750ms',
  slowest: '1000ms',
} as const;

// ============================================
// Border Radius
// ============================================
export const borderRadius = {
  none: '0',
  sm: '0.125rem', // 2px
  default: '0.25rem', // 4px
  md: '0.375rem', // 6px
  lg: '0.5rem', // 8px
  xl: '0.75rem', // 12px
  '2xl': '1rem', // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
} as const;

// ============================================
// Z-Index Scale
// ============================================
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  toast: 1600,
} as const;

// ============================================
// Semantic Colors (CSS Variable References)
// ============================================
export const semanticColors = {
  // Status colors
  positive: 'hsl(var(--positive))',
  positiveMuted: 'hsl(var(--positive-muted))',
  negative: 'hsl(var(--destructive))',
  negativeMuted: 'hsl(var(--destructive) / 0.1)',
  warning: 'hsl(38 92% 50%)',
  warningMuted: 'hsl(38 92% 95%)',
  info: 'hsl(var(--informative))',
  infoMuted: 'hsl(var(--informative-muted))',
} as const;

// ============================================
// Chart Colors
// ============================================
export const chartColors = {
  primary: 'hsl(221 83% 53%)',
  secondary: 'hsl(270 91% 65%)',
  tertiary: 'hsl(142 71% 45%)',
  quaternary: 'hsl(38 92% 50%)',
  quinary: 'hsl(0 84% 60%)',
  // Gradient pairs for area charts
  gradients: {
    blue: ['hsl(221 83% 53%)', 'hsl(221 83% 53% / 0.1)'],
    purple: ['hsl(270 91% 65%)', 'hsl(270 91% 65% / 0.1)'],
    green: ['hsl(142 71% 45%)', 'hsl(142 71% 45% / 0.1)'],
    orange: ['hsl(38 92% 50%)', 'hsl(38 92% 50% / 0.1)'],
    red: ['hsl(0 84% 60%)', 'hsl(0 84% 60% / 0.1)'],
  },
} as const;

// ============================================
// Breakpoints (matching Tailwind)
// ============================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================
// Typography Scale
// ============================================
export const typography = {
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ============================================
// Component-Specific Tokens
// ============================================
export const components = {
  card: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    shadow: elevation.sm,
    shadowHover: elevation.md,
  },
  button: {
    minHeight: spacing[10], // 40px for standard
    minHeightSm: spacing[8], // 32px for small
    minHeightLg: spacing[12], // 48px for large
    minTouchTarget: spacing[11], // 44px for mobile
  },
  input: {
    height: spacing[10], // 40px
    paddingX: spacing[3], // 12px
    borderRadius: borderRadius.md,
  },
  modal: {
    maxWidth: {
      sm: '400px',
      md: '500px',
      lg: '600px',
      xl: '800px',
      full: '100%',
    },
  },
} as const;

// ============================================
// Utility Functions
// ============================================

/**
 * Get stagger delay for list item animations
 * @param index - The item's index in the list
 * @param baseDelay - Base delay in ms (default: 50)
 */
export function getStaggerDelay(index: number, baseDelay = 50): string {
  return `${index * baseDelay}ms`;
}

/**
 * Create CSS transition string from tokens
 */
export function createTransition(
  properties: string[] = ['all'],
  duration: keyof typeof transitions = 'default'
): string {
  const { duration: dur, timing } = transitions[duration];
  return properties.map((prop) => `${prop} ${dur} ${timing}`).join(', ');
}

// Default export for convenience
export default {
  elevation,
  spacing,
  transitions,
  animationDurations,
  borderRadius,
  zIndex,
  semanticColors,
  chartColors,
  breakpoints,
  typography,
  components,
  getStaggerDelay,
  createTransition,
};
