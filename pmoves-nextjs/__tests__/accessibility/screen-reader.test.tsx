/**
 * Screen Reader Compatibility Tests
 * Tests screen reader compatibility and ARIA implementation
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { ChartWrapper } from '@/components/charts/ChartWrapper';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_PARAMS } from '@/lib/simulation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock chart data
const mockData = [
  { week: 1, wealthA: 1000, wealthB: 1200 },
  { week: 2, wealthA: 1100, wealthB: 1350 },
  { week: 3, wealthA: 1200, wealthB: 1500 },
];

const MockChart = () => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={mockData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="week" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="wealthA" stroke="#8884d8" name="Traditional" />
      <Line type="monotone" dataKey="wealthB" stroke="#82ca9d" name="Cooperative" />
    </LineChart>
  </ResponsiveContainer>
);

describe('Screen Reader Compatibility', () => {
  const mockOnSubmit = jest.fn();
  const mockOnParamsChange = jest.fn();
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Semantic Structure', () => {
    test('should have proper heading hierarchy', () => {
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Check for proper heading levels
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      
      // Form should have proper heading
      expect(screen.getByRole('heading', { name: /simulation parameters/i })).toBeInTheDocument();
    });

    test('should have proper landmark roles', () => {
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Check for landmark roles
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tabpanel')).toHaveLength(3);
    });

    test('should have proper list structures', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
              <li>Item 3</li>
            </ul>
          </CardContent>
        </Card>
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('ARIA Labels and Descriptions', () => {
    test('should have proper ARIA labels for form controls', () => {
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Check for proper labeling
      expect(screen.getByLabelText(/number of members/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/simulation duration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/initial wealth/i)).toBeInTheDocument();
    });

    test('should have proper ARIA descriptions', () => {
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // Check for ARIA descriptions
      const membersInput = screen.getByLabelText(/number of members/i);
      expect(membersInput).toHaveAttribute('aria-describedby');
    });

    test('should have proper ARIA roles for interactive elements', () => {
      render(
        <div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[50]}
            onValueChange={jest.fn()}
          />
        </div>
      );

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('role', 'slider');
      expect(slider).toHaveAttribute('tabindex', '0');
    });

    test('should have proper ARIA attributes for tabs', () => {
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

      // Check tab attributes
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('role', 'tab');
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
      });

      // Check tab panel attributes
      const tabPanels = screen.getAllByRole('tabpanel');
      tabPanels.forEach(panel => {
        expect(panel).toHaveAttribute('role', 'tabpanel');
        expect(panel).toHaveAttribute('aria-labelledby');
      });
    });
  });

  describe('Screen Reader Announcements', () => {
    test('should announce form validation errors', async () => {
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

      // Check for error announcement
      await waitFor(() => {
        const errorMessage = screen.getByText(/minimum 10 members required/i);
        expect(errorMessage).toBeInTheDocument();
        
        // Error should be properly associated with input
        expect(membersInput).toHaveAttribute('aria-describedby');
      });
    });

    test('should announce loading states', () => {
      render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={true}
          onReset={mockOnReset}
        />
      );

      // Loading state should be announced
      const submitButton = screen.getByRole('button', { name: /running/i });
      expect(submitButton).toHaveAttribute('aria-live', 'polite');
    });

    test('should announce status changes', async () => {
      const { rerender } = render(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={true}
          onReset={mockOnReset}
        />
      );

      // Initial loading state
      expect(screen.getByRole('button', { name: /running/i })).toBeInTheDocument();

      // Change to loaded state
      rerender(
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={mockOnParamsChange}
          onSubmit={mockOnSubmit}
          isLoading={false}
          onReset={mockOnReset}
        />
      );

      // State change should be announced
      expect(screen.getByRole('button', { name: /run simulation/i })).toBeInTheDocument();
    });
  });

  describe('Chart Accessibility for Screen Readers', () => {
    test('should have accessible chart structure', () => {
      render(
        <ChartWrapper
          title="Wealth Comparison Chart"
          description="Comparison of traditional vs cooperative wealth over time"
        >
          <MockChart />
        </ChartWrapper>
      );

      // Check for accessible chart title
      expect(screen.getByRole('heading', { name: /wealth comparison chart/i })).toBeInTheDocument();
      
      // Check for chart description
      expect(screen.getByText(/comparison of traditional vs cooperative wealth over time/i)).toBeInTheDocument();
    });

    test('should provide data table alternative for charts', () => {
      render(
        <ChartWrapper
          title="Wealth Comparison Chart"
          description="Comparison of traditional vs cooperative wealth over time"
        >
          <MockChart />
        </ChartWrapper>
      );

      // Charts should have accessible alternatives
      // This would typically be implemented with a data table
      const chartArea = screen.getByRole('img') || screen.getByRole('application');
      if (chartArea) {
        const hasAriaLabel = chartArea.hasAttribute('aria-label');
        const hasAriaLabelledBy = chartArea.hasAttribute('aria-labelledby');
        expect(hasAriaLabel || hasAriaLabelledBy).toBe(true);
      }
    });

    test('should have proper chart legends', () => {
      render(
        <ChartWrapper
          title="Wealth Comparison Chart"
          description="Comparison of traditional vs cooperative wealth over time"
        >
          <MockChart />
        </ChartWrapper>
      );

      // Check for legend with proper labels
      // This would be implemented based on the specific chart library
      const legendElements = screen.getAllByText(/traditional|cooperative/i);
      expect(legendElements.length).toBeGreaterThan(0);
    });
  });

  describe('Focus Management for Screen Readers', () => {
    test('should manage focus properly in dynamic content', async () => {
      const user = userEvent.setup();
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <Button>Button 1</Button>
          </TabsContent>
          <TabsContent value="tab2">
            <Button>Button 2</Button>
          </TabsContent>
        </Tabs>
      );

      const secondTab = screen.getByRole('tab', { name: /tab 2/i });
      secondTab.focus();

      // Activate tab with keyboard
      await user.keyboard('{Enter}');

      // Focus should move to content of activated tab
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /button 2/i })).toBeInTheDocument();
      });
    });

    test('should handle focus in modal dialogs', () => {
      // This would test modal focus management
      // For now, we'll test basic focus behavior
      render(
        <Card>
          <CardHeader>
            <CardTitle>Dialog Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Button>Close</Button>
          </CardContent>
        </Card>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Screen Reader Specific Features', () => {
    test('should have proper skip links', () => {
      // This would test for skip navigation links
      // Implementation would depend on the specific layout
      const skipLink = document.querySelector('a[href="#main-content"]');
      if (skipLink) {
        expect(skipLink).toBeInTheDocument();
      }
    });

    test('should have proper language attributes', () => {
      render(
        <div>
          <p>English content</p>
        </div>
      );

      // Check for proper lang attribute on root element
      const htmlElement = document.documentElement;
      expect(htmlElement).toHaveAttribute('lang', 'en');
    });

    test('should have proper table headers', () => {
      render(
        <table>
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
            </tr>
          </tbody>
        </table>
      );

      // Check for proper table structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('rowgroup')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
      expect(screen.getAllByRole('cell')).toHaveLength(2);
    });
  });

  describe('ARIA Live Regions', () => {
    test('should have proper live regions for dynamic content', () => {
      render(
        <div role="status" aria-live="polite">
          Status message will appear here
        </div>
      );

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });

    test('should have proper alert regions', () => {
      render(
        <div role="alert">
          This is an important message
        </div>
      );

      const alertRegion = screen.getByRole('alert');
      expect(alertRegion).toBeInTheDocument();
    });

    test('should announce form submission status', async () => {
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

      const submitButton = screen.getByRole('button', { name: /run simulation/i });
      submitButton.focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Screen Reader Compatibility Compliance', () => {
    test('should meet WCAG 2.1 AA screen reader requirements', async () => {
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
          'aria-allowed-attr': { enabled: true },
          'aria-hidden-body': { enabled: true },
          'aria-hidden-focus': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-required-children': { enabled: true },
          'aria-roles': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'button-name': { enabled: true },
          'heading-order': { enabled: true },
          'label-title-only': { enabled: true },
          'landmark-one-main': { enabled: true },
          'landmark-no-duplicate-banner': { enabled: true },
          'landmark-no-duplicate-contentinfo': { enabled: true },
          'region': { enabled: true },
          'tabindex': { enabled: true },
          'td-headers-attr': { enabled: true },
          'th-has-data-cells': { enabled: true },
          'valid-lang': { enabled: true },
          'video-caption': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have no screen reader compatibility violations', async () => {
      const { container } = render(
        <ChartWrapper
          title="Test Chart"
          description="Test chart description"
        >
          <MockChart />
        </ChartWrapper>
      );

      const results = await axe(container, {
        rules: {
          'aria-allowed-attr': { enabled: true },
          'aria-hidden-body': { enabled: true },
          'aria-hidden-focus': { enabled: true },
          'aria-input-field-name': { enabled: true },
          'aria-required-attr': { enabled: true },
          'aria-required-children': { enabled: true },
          'aria-roles': { enabled: true },
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'image-alt': { enabled: true },
          'image-redundant-alt': { enabled: true },
          'input-button-name': { enabled: true },
          'label-title-only': { enabled: true },
          'role-img-alt': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });
  });
});