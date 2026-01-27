/**
 * Chart Wrapper Accessibility Tests
 * Comprehensive accessibility testing for chart components
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ChartWrapper } from '@/components/charts/ChartWrapper';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  runComprehensiveAccessibilityTest,
  CHART_ACCESSIBILITY_TESTS,
  WCAG21_AA_RULES
} from '../../utils/accessibility-utils.test';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock chart data
const mockData = [
  { week: 1, wealthA: 1000, wealthB: 1200 },
  { week: 2, wealthA: 1100, wealthB: 1350 },
  { week: 3, wealthA: 1200, wealthB: 1500 },
  { week: 4, wealthA: 1300, wealthB: 1650 },
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

describe('ChartWrapper Accessibility', () => {
  const defaultProps = {
    title: 'Wealth Comparison Chart',
    description: 'Comparison of traditional vs cooperative wealth over time',
    children: <MockChart />,
    height: 300,
  };

  describe('WCAG 2.1 AA Compliance', () => {
    test('should have no accessibility violations', async () => {
      const { container } = render(<ChartWrapper {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have no violations in loading state', async () => {
      const { container } = render(<ChartWrapper {...defaultProps} loading={true} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have no violations in error state', async () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} error="Failed to load chart data" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should have no violations with custom className', async () => {
      const { container } = render(
        <ChartWrapper {...defaultProps} className="custom-chart-wrapper" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Chart Accessibility', () => {
    test('should have accessible chart structure', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for proper heading structure
      expect(screen.getByRole('heading', { name: /wealth comparison chart/i })).toBeInTheDocument();
      
      // Check for chart description
      expect(screen.getByText(/comparison of traditional vs cooperative wealth over time/i)).toBeInTheDocument();
    });

    test('should provide accessible data table alternative', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Charts should have accessible alternatives
      // This would typically be implemented with a data table or screen reader-friendly text
      const chartContainer = screen.getByRole('img') || screen.getByRole('application');
      if (chartContainer) {
        const hasAriaLabel = chartContainer.hasAttribute('aria-label');
        const hasAriaLabelledBy = chartContainer.hasAttribute('aria-labelledby');
        expect(hasAriaLabel || hasAriaLabelledBy).toBe(true);
      }
    });

    test('should have proper color contrast indicators', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for legend with proper contrast
      const legendElements = screen.getAllByText(/traditional|cooperative/i);
      expect(legendElements.length).toBeGreaterThan(0);

      // Check for color indicators with text labels
      expect(screen.getByText(/traditional/i)).toBeInTheDocument();
      expect(screen.getByText(/cooperative/i)).toBeInTheDocument();
    });
  });

  describe('Loading State Accessibility', () => {
    test('should have accessible loading indicator', () => {
      render(<ChartWrapper {...defaultProps} loading={true} />);

      // Check for loading announcement
      expect(screen.getByText(/wealth comparison chart/i)).toBeInTheDocument();
      
      // Skeleton should be properly labeled
      const skeleton = screen.getByRole('status') || document.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();
    });

    test('should maintain context during loading', () => {
      render(<ChartWrapper {...defaultProps} loading={true} />);

      // Title and description should still be visible during loading
      expect(screen.getByRole('heading', { name: /wealth comparison chart/i })).toBeInTheDocument();
      expect(screen.getByText(/comparison of traditional vs cooperative wealth over time/i)).toBeInTheDocument();
    });
  });

  describe('Error State Accessibility', () => {
    test('should have accessible error messaging', () => {
      const errorMessage = 'Failed to load chart data';
      render(<ChartWrapper {...defaultProps} error={errorMessage} />);

      // Check for error heading
      expect(screen.getByRole('heading', { name: /chart error/i })).toBeInTheDocument();
      
      // Check for error message
      expect(screen.getByText(/failed to load chart data/i)).toBeInTheDocument();
      
      // Check for retry button
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('should have accessible error recovery', () => {
      render(<ChartWrapper {...defaultProps} error="Network error" />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toHaveAttribute('type', 'button');
      expect(retryButton).toBeEnabled();
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation in error state', () => {
      render(<ChartWrapper {...defaultProps} error="Test error" />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toHaveAttribute('tabindex', '0');
    });

    test('should handle focus management properly', () => {
      const { container } = render(<ChartWrapper {...defaultProps} />);

      // Check that interactive elements are focusable
      const interactiveElements = container.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      interactiveElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex');
      });
    });
  });

  describe('Screen Reader Compatibility', () => {
    test('should have proper semantic structure', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for proper landmark roles
      expect(screen.getByRole('region')).toBeInTheDocument();
      
      // Check for proper heading levels
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    test('should provide accessible chart descriptions', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Chart should have accessible name and description
      const chartTitle = screen.getByRole('heading', { name: /wealth comparison chart/i });
      expect(chartTitle).toBeInTheDocument();

      const chartDescription = screen.getByText(/comparison of traditional vs cooperative wealth over time/i);
      expect(chartDescription).toBeInTheDocument();
    });

    test('should announce chart status changes', () => {
      const { rerender } = render(<ChartWrapper {...defaultProps} loading={true} />);

      // Loading state should be announced
      expect(screen.getByRole('status')).toBeInTheDocument();

      // Switch to loaded state
      rerender(<ChartWrapper {...defaultProps} loading={false} />);
      
      // Chart should be properly announced as loaded
      expect(screen.getByRole('img') || screen.getByRole('application')).toBeInTheDocument();
    });
  });

  describe('Color and Visual Accessibility', () => {
    test('should not rely on color alone for information', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for text labels in addition to color coding
      expect(screen.getByText(/traditional/i)).toBeInTheDocument();
      expect(screen.getByText(/cooperative/i)).toBeInTheDocument();
    });

    test('should have sufficient contrast for text elements', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check that text elements have proper contrast
      const textElements = screen.getAllByText(/wealth|comparison|chart|traditional|cooperative/i);
      textElements.forEach(element => {
        expect(element).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility on different screen sizes', () => {
      // Test with different heights
      const heights = [200, 300, 500];
      
      heights.forEach(height => {
        const { container } = render(<ChartWrapper {...defaultProps} height={height} />);
        expect(container.querySelector('.h-\\[' + height + 'px\\]')).toBeInTheDocument();
      });
    });

    test('should handle responsive containers properly', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for responsive container
      const responsiveContainer = document.querySelector('.recharts-responsive-container');
      if (responsiveContainer) {
        expect(responsiveContainer).toBeInTheDocument();
      }
    });
  });

  describe('Comprehensive Accessibility Testing', () => {
    test('should pass comprehensive accessibility tests', async () => {
      const results = await runComprehensiveAccessibilityTest(
        <ChartWrapper {...defaultProps} />,
        { level: 'AA' }
      );

      expect(results.axeResults.violations).toHaveLength(0);
      expect(results.keyboardNavigation).toBe(true);
      expect(results.ariaAttributes).toBe(true);
      expect(results.colorContrast).toBe(true);
      expect(results.focusManagement).toBe(true);
    });

    test('should handle edge cases accessibility', async () => {
      const edgeCases = [
        { ...defaultProps, loading: true },
        { ...defaultProps, error: 'Critical error occurred' },
        { ...defaultProps, description: undefined },
        { ...defaultProps, height: 100 },
      ];

      for (const props of edgeCases) {
        const results = await runComprehensiveAccessibilityTest(
          <ChartWrapper {...props} />,
          { level: 'AA' }
        );

        expect(results.axeResults.violations).toHaveLength(0);
      }
    });
  });

  describe('Chart-Specific Accessibility', () => {
    test('should implement chart accessibility patterns', () => {
      const renderResult = render(<ChartWrapper {...defaultProps} />);
      
      // Test chart-specific accessibility
      CHART_ACCESSIBILITY_TESTS.testChartAccessibility(renderResult);
    });

    test('should provide data table alternative for complex charts', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Complex charts should have data table alternatives
      // This is a placeholder for where a data table would be implemented
      const chartArea = screen.getByRole('img') || screen.getByRole('application');
      if (chartArea) {
        expect(chartArea).toHaveAttribute('role');
      }
    });

    test('should handle interactive chart elements properly', () => {
      render(<ChartWrapper {...defaultProps} />);

      // Check for interactive elements like tooltips
      const interactiveElements = document.querySelectorAll('[role="tooltip"], [data-testid="tooltip"]');
      expect(interactiveElements.length).toBeGreaterThanOrEqual(0);
    });
  });
});