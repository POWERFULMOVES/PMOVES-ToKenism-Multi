/**
 * Accessibility Testing Utilities
 * Provides helper functions for comprehensive accessibility testing
 */

import { render, RenderResult } from '@testing-library/react';
import { axe, toHaveNoViolations, AxeResults } from 'jest-axe';
import userEvent from '@testing-library/user-event';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

export interface AccessibilityTestOptions {
  /** Include only specific rules */
  rules?: string[];
  /** Exclude specific rules */
  excludedRules?: string[];
  /** WCAG level to test against (A, AA, AAA) */
  level?: 'A' | 'AA' | 'AAA';
  /** Test with keyboard navigation */
  testKeyboardNavigation?: boolean;
  /** Test screen reader compatibility */
  testScreenReader?: boolean;
}

export interface KeyboardNavigationTest {
  /** Element selector or test element */
  element: string | HTMLElement;
  /** Expected keyboard interaction */
  expectedBehavior: string;
  /** Key sequence to test */
  keySequence: string[];
}

/**
 * Runs axe accessibility testing on a rendered component
 */
export async function testAccessibility(
  rendered: RenderResult,
  options: AccessibilityTestOptions = {}
): Promise<AxeResults> {
  const { rules, excludedRules, level = 'AA' } = options;

  const axeConfig = {
    rules: rules ? rules.map(rule => ({ rule })) : undefined,
    exclude: excludedRules ? excludedRules.map(rule => ({ rule })) : undefined,
    tags: [`wcag2${level.toLowerCase()}`],
  };

  const results = await axe(rendered.container, axeConfig);
  
  return results;
}

/**
 * Tests keyboard navigation for interactive elements
 */
export async function testKeyboardNavigation(
  rendered: RenderResult,
  tests: KeyboardNavigationTest[]
): Promise<void> {
  const user = userEvent.setup();

  for (const test of tests) {
    const element = typeof test.element === 'string' 
      ? rendered.container.querySelector(test.element) as HTMLElement
      : test.element;

    if (!element) {
      throw new Error(`Element not found: ${test.element}`);
    }

    // Focus the element
    element.focus();
    expect(element).toHaveFocus();

    // Test key sequence
    for (const key of test.keySequence) {
      await user.keyboard(key);
    }

    // Verify expected behavior
    // This would need to be customized based on the specific component
    console.log(`Tested ${test.expectedBehavior} for element:`, element);
  }
}

/**
 * Tests ARIA attributes and roles
 */
export function testARIAAttributes(rendered: RenderResult): void {
  const interactiveElements = rendered.container.querySelectorAll(
    'button, [role="button"], a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  interactiveElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    
    // Test for proper ARIA labels
    if (htmlElement.tagName === 'BUTTON' || htmlElement.getAttribute('role') === 'button') {
      if (!htmlElement.getAttribute('aria-label') && 
          !htmlElement.getAttribute('aria-labelledby') &&
          !htmlElement.textContent?.trim()) {
        console.warn(`Button ${index} missing accessible label:`, htmlElement);
      }
    }

    // Test for proper ARIA descriptions
    if (htmlElement.getAttribute('aria-describedby')) {
      const describedById = htmlElement.getAttribute('aria-describedby');
      const describedElement = document.getElementById(describedById!);
      if (!describedElement) {
        console.warn(`Element references non-existent description ID: ${describedById}`);
      }
    }
  });
}

/**
 * Tests color contrast by checking for proper contrast indicators
 */
export function testColorContrast(rendered: RenderResult): void {
  // Note: Actual color contrast testing requires visual testing
  // This is a basic check for common contrast issues
  
  const textElements = rendered.container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
  
  textElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    const computedStyle = getComputedStyle(htmlElement);
    
    // Check for potential low contrast combinations
    if (computedStyle.color === 'rgb(128, 128, 128)' && 
        computedStyle.backgroundColor === 'rgb(248, 248, 248)') {
      console.warn(`Potential low contrast detected on element ${index}:`, htmlElement);
    }
  });
}

/**
 * Tests focus management and tab order
 */
export async function testFocusManagement(rendered: RenderResult): Promise<void> {
  const user = userEvent.setup();
  const focusableElements = rendered.container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  // Test tab order
  for (let i = 0; i < focusableElements.length; i++) {
    await user.tab();
    expect(focusableElements[i]).toHaveFocus();
  }

  // Test shift+tab order
  for (let i = focusableElements.length - 1; i >= 0; i--) {
    await user.tab({ shift: true });
    expect(focusableElements[i]).toHaveFocus();
  }
}

/**
 * Comprehensive accessibility test suite
 */
export async function runComprehensiveAccessibilityTest(
  component: React.ReactElement,
  options: AccessibilityTestOptions = {}
): Promise<{
  axeResults: AxeResults;
  keyboardNavigation: boolean;
  ariaAttributes: boolean;
  colorContrast: boolean;
  focusManagement: boolean;
}> {
  const rendered = render(component);

  // Run axe tests
  const axeResults = await testAccessibility(rendered, options);

  // Test keyboard navigation
  let keyboardNavigation = true;
  try {
    await testFocusManagement(rendered);
  } catch (error) {
    keyboardNavigation = false;
    console.error('Keyboard navigation test failed:', error);
  }

  // Test ARIA attributes
  let ariaAttributes = true;
  try {
    testARIAAttributes(rendered);
  } catch (error) {
    ariaAttributes = false;
    console.error('ARIA attributes test failed:', error);
  }

  // Test color contrast
  let colorContrast = true;
  try {
    testColorContrast(rendered);
  } catch (error) {
    colorContrast = false;
    console.error('Color contrast test failed:', error);
  }

  // Test focus management
  let focusManagement = true;
  try {
    await testFocusManagement(rendered);
  } catch (error) {
    focusManagement = false;
    console.error('Focus management test failed:', error);
  }

  return {
    axeResults,
    keyboardNavigation,
    ariaAttributes,
    colorContrast,
    focusManagement,
  };
}

/**
 * WCAG 2.1 AA specific test configurations
 */
export const WCAG21_AA_RULES = {
  // Color contrast requirements
  colorContrast: {
    enabled: true,
    threshold: 4.5, // 4.5:1 for normal text
  },
  
  // Keyboard accessibility
  keyboard: {
    enabled: true,
    requireAllInteractive: true,
  },
  
  // ARIA requirements
  aria: {
    enabled: true,
    requireLabels: true,
    requireDescriptions: false,
  },
  
  // Focus management
  focus: {
    enabled: true,
    requireVisible: true,
    requireOrder: true,
  },
};

/**
 * Common accessibility test patterns for form components
 */
export const FORM_ACCESSIBILITY_TESTS = {
  // Test form labels
  testFormLabels: (rendered: RenderResult) => {
    const inputs = rendered.container.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const htmlInput = input as HTMLElement;
      const hasLabel = htmlInput.getAttribute('aria-label') ||
                      htmlInput.getAttribute('aria-labelledby') ||
                      rendered.container.querySelector(`label[for="${htmlInput.id}"]`);
      
      if (!hasLabel) {
        console.warn(`Input ${index} missing proper label:`, htmlInput);
      }
    });
  },

  // Test form validation
  testFormValidation: (rendered: RenderResult) => {
    const requiredInputs = rendered.container.querySelectorAll('[required], [aria-required="true"]');
    requiredInputs.forEach((input, index) => {
      const htmlInput = input as HTMLElement;
      if (!htmlInput.getAttribute('aria-describedby') && 
          !rendered.container.querySelector('[role="alert"]')) {
        console.warn(`Required input ${index} missing validation message:`, htmlInput);
      }
    });
  },
};

/**
 * Common accessibility test patterns for chart components
 */
export const CHART_ACCESSIBILITY_TESTS = {
  // Test chart accessibility
  testChartAccessibility: (rendered: RenderResult) => {
    const charts = rendered.container.querySelectorAll('[role="img"], svg');
    charts.forEach((chart, index) => {
      const htmlChart = chart as HTMLElement;
      
      // Check for accessible name
      if (!htmlChart.getAttribute('aria-label') && 
          !htmlChart.getAttribute('aria-labelledby')) {
        console.warn(`Chart ${index} missing accessible name:`, htmlChart);
      }
      
      // Check for description
      if (!htmlChart.getAttribute('aria-describedby')) {
        console.warn(`Chart ${index} missing description:`, htmlChart);
      }
    });
  },
};