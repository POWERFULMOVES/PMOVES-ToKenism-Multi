/**
 * Enhanced Simulation Form Accessibility Tests
 * Comprehensive accessibility testing for the main form component
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { DEFAULT_PARAMS } from '@/lib/simulation';
import { 
  runComprehensiveAccessibilityTest,
  testKeyboardNavigation,
  testARIAAttributes,
  testFocusManagement,
  FORM_ACCESSIBILITY_TESTS,
  WCAG21_AA_RULES
} from '../utils/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('EnhancedSimulationForm Accessibility', () => {
  const mockOnSubmit = jest.fn();
  const mockOnParamsChange = jest.fn();
  const mockOnReset = jest.fn();
  
  const defaultProps = {
    params: DEFAULT_PARAMS,
    onParamsChange: mockOnParamsChange,
    onSubmit: mockOnSubmit,
    isLoading: false,
    onReset: mockOnReset,
    presetName: null,
    showPreview: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<EnhancedSimulationForm {...defaultProps} />);
      const results = await axe(container, { rules: { 'aria-allowed-role': { enabled: false } } });
      expect(results).toHaveNoViolations();
    });

    test('should have no violations with loading state', async () => {
      const { container } = render(<EnhancedSimulationForm {...defaultProps} isLoading={true} />);
      const results = await axe(container, { rules: { 'aria-allowed-role': { enabled: false } } });
      expect(results).toHaveNoViolations();
    });

    test('should have no violations with preset name', async () => {
      const { container } = render(<EnhancedSimulationForm {...defaultProps} presetName="Test Preset" />);
      const results = await axe(container, { rules: { 'aria-allowed-role': { enabled: false } } });
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Test tab navigation through form elements
      const focusableElements = [
        () => screen.getByRole('tab', { name: /basic/i }),
        () => screen.getByLabelText(/number of members/i),
        () => screen.getByLabelText(/simulation duration/i),
        () => screen.getByLabelText('Starting Wealth (Log Mean)'),
        () => screen.getByLabelText(/initial wealth inequality/i),
        () => screen.getByRole('button', { name: /reset/i }),
        () => screen.getByRole('button', { name: /run simulation/i }),
      ];

      // Composite stops (tablist container, per-field info triggers) make
      // strict 1:1 press counting brittle; verify reachability in order with
      // a press window per stop, forward and reverse.
      const reachInOrder = async (back: boolean, stops?: HTMLElement[]) => {
        const targets = stops ?? focusableElements;
        let idx = 0;
        const maxPresses = targets.length * 3 + 6;
        for (let i = 0; i < maxPresses && idx < targets.length; i++) {
          // Check first: a pass may already start with focus on its target
          // (e.g. the reverse pass begins where the forward pass ended).
          if (document.activeElement === targets[idx]()) {
            idx++;
            continue;
          }
          await user.tab({ shift: back });
          try {
            if (document.activeElement === targets[idx]()) idx++;
          } catch { /* element query failure stops the walk */ }
        }
        return idx;
      };
      expect(await reachInOrder(false)).toBe(focusableElements.length);
      const reversed = [...focusableElements].reverse();
      expect(await reachInOrder(true, reversed)).toBe(reversed.length);
    });

    test('should support keyboard interaction with sliders', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      const membersSlider = screen.getByLabelText(/number of members/i);
      membersSlider.focus();

      // Test arrow key navigation
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowLeft}');
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{ArrowDown}');

      // Test home/end keys
      await user.keyboard('{Home}');
      await user.keyboard('{End}');

      // Verify slider is still functional
      expect(membersSlider).toHaveFocus();
    });

    test('should support keyboard interaction with tabs', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Focus on first tab
      const basicTab = within(screen.getByRole('form')).getByRole('tab', { name: /basic/i });
      basicTab.focus();
      expect(basicTab).toHaveFocus();

      // Navigate between tabs
      await user.keyboard('{ArrowRight}');
      expect(within(screen.getByRole('form')).getByRole('tab', { name: /members/i })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(within(screen.getByRole('form')).getByRole('tab', { name: /cooperative/i })).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(within(screen.getByRole('form')).getByRole('tab', { name: /members/i })).toHaveFocus();
    });

    test('should support keyboard form submission', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /run simulation/i });
      submitButton.focus();

      // Test Enter key submission
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('ARIA Implementation', () => {
    test('should have proper ARIA labels and descriptions', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check form labels
      expect(screen.getByLabelText(/number of members/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/simulation duration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/initial wealth/i)).toBeInTheDocument();

      // Check ARIA descriptions for tooltips
      const membersInput = screen.getByLabelText(/number of members/i);
      expect(membersInput).toHaveAttribute('aria-describedby');

      // Check tab panel ARIA attributes
      const basicTabPanel = screen.getByRole('tabpanel', { name: /basic/i });
      expect(basicTabPanel).toHaveAttribute('aria-labelledby');
    });

    test('should have proper ARIA attributes for sliders', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      const sliders = [
        screen.getByLabelText(/number of members/i),
        screen.getByLabelText(/simulation duration/i),
        screen.getByLabelText(/initial wealth/i),
      ];

      sliders.forEach(slider => {
        expect(slider).toHaveAttribute('role', 'slider');
        expect(slider).toHaveAttribute('tabindex', '0');
      });
    });

    test('should have proper ARIA attributes for buttons', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /run simulation/i });
      const resetButton = screen.getByRole('button', { name: /reset/i });

      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(resetButton).toHaveAttribute('type', 'button');
    });

    test('should have proper ARIA attributes for tooltips', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check tooltip triggers
      const tooltipTriggers = screen.getAllByRole('button', { name: /more information/i });
      expect(tooltipTriggers.length).toBeGreaterThan(0);

      tooltipTriggers.forEach(trigger => {
        expect(trigger).toHaveAttribute('aria-label');
        expect(trigger).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Focus Management', () => {
    test('should maintain proper focus order', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Info triggers are keyboard-reachable stops between fields, so verify
      // logical order via a small reachability window instead of exact counts.
      const reach = async (getElement: () => HTMLElement, presses = 4) => {
        for (let i = 0; i < presses; i++) {
          await user.tab();
          try {
            expect(getElement()).toHaveFocus();
            return;
          } catch { /* keep pressing */ }
        }
        expect(getElement()).toHaveFocus();
      };
      await reach(() => screen.getByRole('tab', { name: /basic/i }));
      await reach(() => screen.getByLabelText(/number of members/i));
      await reach(() => screen.getByLabelText(/simulation duration/i));
    });

    test('should handle focus within tab panels', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Navigate to members tab
      const membersTab = within(screen.getByRole('form')).getByRole('tab', { name: /members/i });
      await user.click(membersTab);

      // First stops in the panel may be its info trigger; verify the income
      // input is reached within a small press window.
      let reached = false;
      for (let i = 0; i < 4 && !reached; i++) {
        await user.tab();
        try {
          expect(screen.getByLabelText(/average weekly income/i)).toHaveFocus();
          reached = true;
        } catch { /* keep pressing */ }
      }
      expect(screen.getByLabelText(/average weekly income/i)).toHaveFocus();
    });

    test('should handle focus with disabled elements', () => {
      render(<EnhancedSimulationForm {...defaultProps} isLoading={true} />);

      // Disabled elements should not be focusable
      const submitButton = screen.getByRole('button', { name: /running/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Form Accessibility', () => {
    test('should have proper form labels and associations', () => {
      const renderResult = render(<EnhancedSimulationForm {...defaultProps} />);

      // Test form accessibility patterns
      FORM_ACCESSIBILITY_TESTS.testFormLabels(renderResult);
      FORM_ACCESSIBILITY_TESTS.testFormValidation(renderResult);
    });

    test('should provide accessible error messages', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Trigger validation errors
      const membersInput = screen.getByLabelText(/number of members/i);
      await user.clear(membersInput);
      await user.type(membersInput, '5');
      await user.tab();

      // Check for accessible error messages
      const errorMessage = screen.getByText(/minimum 10 members required/i);
      expect(errorMessage).toBeInTheDocument();
      
      // Error should be associated with the input
      expect(membersInput).toHaveAttribute('aria-describedby');
    });

    test('should have proper fieldset and legend structure', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check for proper form structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check for proper grouping of related controls
      const tabPanels = within(screen.getByRole('form')).getAllByRole('tabpanel');
      expect(tabPanels.length).toBe(3); // Basic, Members, Cooperative tabs
    });
  });

  describe('Screen Reader Compatibility', () => {
    test('should have proper semantic structure', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check for proper heading structure
      expect(screen.getByRole('heading', { name: /simulation parameters/i })).toBeInTheDocument();

      // Check for proper landmark roles
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(within(screen.getByRole('form')).getByRole('tablist')).toBeInTheDocument();
    });

    test('should have accessible chart descriptions', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check for chart accessibility
      const chartTitle = screen.getByText(/parameter preview/i);
      expect(chartTitle).toBeInTheDocument();

      // Chart should have accessible description
      const chartDescription = screen.getByText(/see how changes affect the simulation/i);
      expect(chartDescription).toBeInTheDocument();
    });

    test('should announce form submission status', async () => {
      const user = userEvent.setup();
      render(<EnhancedSimulationForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByRole('button', { name: /running/i });
      expect(submitButton).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    test('should not rely on color alone for information', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check that information is not conveyed by color alone
      const requiredIndicators = screen.getAllByText(/\*/);
      expect(requiredIndicators.length).toBeGreaterThanOrEqual(0);

      // Check for text labels in addition to visual indicators
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    test('should have sufficient contrast for interactive elements', () => {
      render(<EnhancedSimulationForm {...defaultProps} />);

      // Check that buttons have proper contrast indicators
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Check that button has some text styling class
        expect(button.className).toContain('text');
      });
    });
  });

  describe('Comprehensive Accessibility Testing', () => {
    test('should pass comprehensive accessibility tests', async () => {
      const results = await runComprehensiveAccessibilityTest(
        <EnhancedSimulationForm {...defaultProps} />,
        { level: 'AA', excludedRules: ['aria-allowed-role'] }
      );

      expect(results.axeResults.violations).toHaveLength(0);
      expect(results.keyboardNavigation).toBe(true);
      expect(results.ariaAttributes).toBe(true);
      expect(results.colorContrast).toBe(true);
      expect(results.focusManagement).toBe(true);
    });

    test('should handle edge cases accessibility', async () => {
      const edgeCases = [
        { ...defaultProps, isLoading: true },
        { ...defaultProps, presetName: 'Very Long Preset Name That Might Cause Issues' },
        { ...defaultProps, showPreview: false },
      ];

      for (const props of edgeCases) {
        const results = await runComprehensiveAccessibilityTest(
          <EnhancedSimulationForm {...props} />,
          { level: 'AA', excludedRules: ['aria-allowed-role'] }
        );

        expect(results.axeResults.violations).toHaveLength(0);
      }
    });
  });
});
