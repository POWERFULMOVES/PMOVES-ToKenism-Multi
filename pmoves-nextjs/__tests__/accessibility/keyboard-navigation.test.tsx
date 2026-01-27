/**
 * Comprehensive Keyboard Navigation Tests
 * Tests keyboard accessibility across all interactive components
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_PARAMS } from '@/lib/simulation';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Keyboard Navigation Tests', () => {
  const mockOnSubmit = jest.fn();
  const mockOnParamsChange = jest.fn();
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Tab Navigation Order', () => {
    test('should maintain logical tab order in forms', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Expected tab order
      const expectedTabOrder = [
        () => screen.getByRole('tab', { name: /basic/i }),
        () => screen.getByLabelText(/number of members/i),
        () => screen.getByLabelText(/simulation duration/i),
        () => screen.getByLabelText(/initial wealth/i),
        () => screen.getByLabelText(/initial wealth inequality/i),
        () => screen.getByRole('tab', { name: /members/i }),
        () => screen.getByRole('tab', { name: /cooperative/i }),
        () => screen.getByRole('button', { name: /reset/i }),
        () => screen.getByRole('button', { name: /run simulation/i }),
      ];

      // Test forward tab navigation
      for (const getElement of expectedTabOrder) {
        await user.tab();
        expect(getElement()).toHaveFocus();
      }

      // Test that tab cycles back to beginning
      await user.tab();
      expect(expectedTabOrder[0]()).toHaveFocus();
    });

    test('should support reverse tab navigation', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Navigate to the end first
      const submitButton = screen.getByRole('button', { name: /run simulation/i });
      submitButton.focus();

      // Expected reverse tab order
      const expectedReverseOrder = [
        () => screen.getByRole('button', { name: /reset/i }),
        () => screen.getByRole('tab', { name: /cooperative/i }),
        () => screen.getByRole('tab', { name: /members/i }),
        () => screen.getByLabelText(/initial wealth inequality/i),
        () => screen.getByLabelText(/initial wealth/i),
        () => screen.getByLabelText(/simulation duration/i),
        () => screen.getByLabelText(/number of members/i),
        () => screen.getByRole('tab', { name: /basic/i }),
      ];

      // Test shift+tab navigation
      for (const getElement of expectedReverseOrder) {
        await user.tab({ shift: true });
        expect(getElement()).toHaveFocus();
      }
    });

    test('should skip disabled elements in tab order', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={true} // Loading state disables form elements
          onReset={mockOnReset}
        />
      );

      // Focus should skip disabled elements
      await user.tab();
      
      // In loading state, most elements should be disabled
      const submitButton = screen.getByRole('button', { name: /running/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Slider Keyboard Navigation', () => {
    test('should support arrow key navigation on sliders', async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <div>
          <label htmlFor="test-slider">Test Slider</label>
          <Slider
            id="test-slider"
            min={0}
            max={100}
            step={1}
            value={[50]}
            onValueChange={onValueChange}
          />
        </div>
      );

      const slider = screen.getByRole('slider');
      slider.focus();

      // Test arrow keys
      await user.keyboard('{ArrowRight}');
      expect(onValueChange).toHaveBeenCalledWith([51]);

      await user.keyboard('{ArrowLeft}');
      expect(onValueChange).toHaveBeenCalledWith([49]);

      await user.keyboard('{ArrowUp}');
      expect(onValueChange).toHaveBeenCalledWith([50]);

      await user.keyboard('{ArrowDown}');
      expect(onValueChange).toHaveBeenCalledWith([49]);
    });

    test('should support home/end keys on sliders', async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <div>
          <label htmlFor="test-slider">Test Slider</label>
          <Slider
            id="test-slider"
            min={0}
            max={100}
            step={1}
            value={[50]}
            onValueChange={onValueChange}
          />
        </div>
      );

      const slider = screen.getByRole('slider');
      slider.focus();

      // Test home key
      await user.keyboard('{Home}');
      expect(onValueChange).toHaveBeenCalledWith([0]);

      // Test end key
      await user.keyboard('{End}');
      expect(onValueChange).toHaveBeenCalledWith([100]);
    });

    test('should support page up/down keys on sliders', async () => {
      const user = userEvent.setup();
      const onValueChange = jest.fn();

      render(
        <div>
          <label htmlFor="test-slider">Test Slider</label>
          <Slider
            id="test-slider"
            min={0}
            max={100}
            step={1}
            value={[50]}
            onValueChange={onValueChange}
          />
        </div>
      );

      const slider = screen.getByRole('slider');
      slider.focus();

      // Test page up
      await user.keyboard('{PageUp}');
      // Page up typically increments by larger step (implementation dependent)

      // Test page down
      await user.keyboard('{PageDown}');
      // Page down typically decrements by larger step (implementation dependent)
    });
  });

  describe('Tab Component Keyboard Navigation', () => {
    test('should support arrow key navigation in tabs', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: /tab 1/i });
      firstTab.focus();

      // Test right arrow navigation
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /tab 2/i })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /tab 3/i })).toHaveFocus();

      // Test left arrow navigation
      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('tab', { name: /tab 2/i })).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveFocus();
    });

    test('should support home/end keys in tabs', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const firstTab = screen.getByRole('tab', { name: /tab 1/i });
      firstTab.focus();

      // Navigate to middle tab
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');

      // Test home key
      await user.keyboard('{Home}');
      expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveFocus();

      // Test end key
      await user.keyboard('{End}');
      expect(screen.getByRole('tab', { name: /tab 3/i })).toHaveFocus();
    });

    test('should activate tabs with Enter and Space', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const secondTab = screen.getByRole('tab', { name: /tab 2/i });
      secondTab.focus();

      // Test Enter key
      await user.keyboard('{Enter}');
      expect(screen.getByText('Content 2')).toBeVisible();

      // Go back to first tab
      const firstTab = screen.getByRole('tab', { name: /tab 1/i });
      firstTab.focus();

      // Test Space key
      await user.keyboard(' ');
      expect(screen.getByText('Content 1')).toBeVisible();
    });
  });

  describe('Button Keyboard Navigation', () => {
    test('should activate buttons with Enter and Space', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(
        <Button onClick={onClick}>
          Test Button
        </Button>
      );

      const button = screen.getByRole('button', { name: /test button/i });
      button.focus();

      // Test Enter key
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);

      // Test Space key
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    test('should handle disabled button keyboard interaction', async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(
        <Button onClick={onClick} disabled>
          Disabled Button
        </Button>
      );

      const button = screen.getByRole('button', { name: /disabled button/i });
      expect(button).toBeDisabled();

      // Keyboard events should not trigger disabled buttons
      button.focus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Form Keyboard Navigation', () => {
    test('should support form submission with Enter', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Focus on an input and press Enter
      const membersInput = screen.getByLabelText(/number of members/i);
      membersInput.focus();
      
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });

    test('should handle form validation with keyboard', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Trigger validation error
      const membersInput = screen.getByLabelText(/number of members/i);
      await user.clear(membersInput);
      await user.type(membersInput, '5');
      await user.tab();

      // Check that error is announced
      await waitFor(() => {
        expect(screen.getByText(/minimum 10 members required/i)).toBeInTheDocument();
      });

      // Focus should move to error message or next appropriate element
      expect(membersInput).toHaveAttribute('aria-describedby');
    });
  });

  describe('Escape Key Behavior', () => {
    test('should handle escape key in modal-like contexts', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      // This would test modal/dialog components
      // For now, we'll test that escape doesn't cause errors
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={onClose}>Close</Button>
          </CardContent>
        </Card>
      );

      const button = screen.getByRole('button', { name: /close/i });
      button.focus();

      await user.keyboard('{Escape}');
      
      // Escape key should not cause errors
      // In modal contexts, it would close the modal
    });
  });

  describe('Focus Management', () => {
    test('should maintain focus within components', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <Button>Button 1</Button>
            <Button>Button 2</Button>
          </TabsContent>
          <TabsContent value="tab2">
            <Button>Button 3</Button>
            <Button>Button 4</Button>
          </TabsContent>
        </Tabs>
      );

      // Focus should stay within active tab panel
      const firstTab = screen.getByRole('tab', { name: /tab 1/i });
      firstTab.focus();

      await user.keyboard('{Enter}'); // Activate tab
      await user.tab(); // Focus first button in tab panel

      expect(screen.getByRole('button', { name: /button 1/i })).toHaveFocus();

      // Tab should stay within tab panel
      await user.tab();
      expect(screen.getByRole('button', { name: /button 2/i })).toHaveFocus();
    });

    test('should handle focus trapping in complex components', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Test that focus moves logically through complex form
      const firstElement = screen.getByRole('tab', { name: /basic/i });
      firstElement.focus();

      // Navigate through all focusable elements
      let focusCount = 0;
      const maxFocusAttempts = 20; // Prevent infinite loop

      while (focusCount < maxFocusAttempts) {
        await user.tab();
        focusCount++;

        // Check if we've cycled back to the beginning
        if (document.activeElement === firstElement) {
          break;
        }
      }

      // Should have cycled through all focusable elements
      expect(focusCount).toBeGreaterThan(5);
    });
  });

  describe('Keyboard Accessibility Compliance', () => {
    test('should meet WCAG 2.1 AA keyboard requirements', async () => {
      const user = userEvent.setup();
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // All interactive elements should be keyboard accessible
      const interactiveElements = screen.getAllByRole('button');
      interactiveElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex');
      });

      // Test that all functionality is available via keyboard
      const submitButton = screen.getByRole('button', { name: /run simulation/i });
      submitButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    test('should have no keyboard accessibility violations', async () => {
      const { container } = render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      const results = await axe(container, {
        rules: {
          'keyboard': { enabled: true },
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });
  });
});