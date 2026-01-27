/**
 * Color Contrast and Visual Accessibility Tests
 * Tests color contrast, visual accessibility, and non-color-dependent information
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { ChartWrapper } from '@/components/charts/ChartWrapper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_PARAMS } from '@/lib/simulation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock chart data
const mockData = [
  { week: 1, wealthA: 1000, wealthB: 1200 },
  { week: 2, wealthA: 1100, wealthB: 1350 },
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

describe('Color Contrast and Visual Accessibility', () => {
  const mockOnSubmit = jest.fn();
  const mockOnParamsChange = jest.fn();
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Color Contrast', () => {
    test('should have sufficient text contrast in light mode', async () => {
      const { container } = render(
        <div className="bg-white text-black">
          <p>This is normal text</p>
          <h2>This is a heading</h2>
          <span className="text-gray-600">This is muted text</span>
        </div>
      );

      // Check for basic contrast compliance
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: false }, // AA level, not AAA
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have sufficient text contrast in dark mode', async () => {
      const { container } = render(
        <div className="bg-gray-900 text-white">
          <p>This is normal text</p>
          <h2>This is a heading</h2>
          <span className="text-gray-300">This is muted text</span>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have sufficient contrast for form labels', async () => {
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
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have sufficient contrast for button text', async () => {
      const { container } = render(
        <div>
          <Button>Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="ghost">Ghost Button</Button>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Interactive Element Contrast', () => {
    test('should have sufficient contrast for interactive elements', async () => {
      const { container } = render(
        <div>
          <Button>Interactive Button</Button>
          <a href="#" className="text-blue-600 hover:text-blue-800">Interactive Link</a>
          <button className="text-green-600 hover:text-green-800">Interactive Element</button>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have sufficient contrast for focus states', async () => {
      const { container } = render(
        <div>
          <Button className="focus:ring-2 focus:ring-blue-500">Focus Button</Button>
          <input 
            type="text" 
            className="border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="Focus Input"
          />
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have sufficient contrast for disabled elements', async () => {
      const { container } = render(
        <div>
          <Button disabled>Disabled Button</Button>
          <input 
            type="text" 
            disabled
            className="bg-gray-100 text-gray-500"
            placeholder="Disabled Input"
          />
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Non-Color-Dependent Information', () => {
    test('should not rely on color alone for error states', () => {
      render(
        <div>
          <div className="text-red-600 border border-red-300">
            <span className="font-semibold">Error:</span> This is an error message
          </div>
          <div className="text-green-600 border border-green-300">
            <span className="font-semibold">Success:</span> This is a success message
          </div>
          <div className="text-yellow-600 border border-yellow-300">
            <span className="font-semibold">Warning:</span> This is a warning message
          </div>
        </div>
      );

      // Check that status is conveyed by text, not just color
      expect(screen.getByText(/error:/i)).toBeInTheDocument();
      expect(screen.getByText(/success:/i)).toBeInTheDocument();
      expect(screen.getByText(/warning:/i)).toBeInTheDocument();
    });

    test('should not rely on color alone for form validation', () => {
      render(
        <div>
          <label>
            Required Field
            <span className="text-red-500">*</span>
            <input type="text" className="border border-red-500" aria-invalid="true" />
            <span className="text-red-600 text-sm">This field is required</span>
          </label>
        </div>
      );

      // Check that validation is conveyed by multiple means
      expect(screen.getByText(/\*/)).toBeInTheDocument(); // Visual indicator
      expect(screen.getByText(/this field is required/i)).toBeInTheDocument(); // Text message
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true'); // ARIA
    });

    test('should not rely on color alone for chart data', () => {
      render(
        <ChartWrapper
          title="Wealth Comparison Chart"
          description="Comparison of traditional vs cooperative wealth over time"
        >
          <MockChart />
        </ChartWrapper>
      );

      // Check that chart data is not conveyed by color alone
      expect(screen.getByText(/traditional/i)).toBeInTheDocument();
      expect(screen.getByText(/cooperative/i)).toBeInTheDocument();
      expect(screen.getByText(/wealth comparison chart/i)).toBeInTheDocument();
    });

    test('should have accessible legends for color-coded information', () => {
      render(
        <div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="ml-2">Traditional Model</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="ml-2">Cooperative Model</span>
            </div>
          </div>
        </div>
      );

      // Check that color coding is accompanied by text labels
      expect(screen.getByText(/traditional model/i)).toBeInTheDocument();
      expect(screen.getByText(/cooperative model/i)).toBeInTheDocument();
    });
  });

  describe('Visual Accessibility Features', () => {
    test('should have sufficient contrast for badges and indicators', async () => {
      const { container } = render(
        <div>
          <Badge>Default Badge</Badge>
          <Badge variant="secondary">Secondary Badge</Badge>
          <Badge variant="destructive">Destructive Badge</Badge>
          <Badge variant="outline">Outline Badge</Badge>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have accessible status indicators', () => {
      render(
        <div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full" aria-label="Status: Online"></div>
            <span className="ml-2">Online</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full" aria-label="Status: Offline"></div>
            <span className="ml-2">Offline</span>
          </div>
        </div>
      );

      // Check that status indicators have accessible labels
      expect(screen.getByLabelText(/status: online/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/status: offline/i)).toBeInTheDocument();
      expect(screen.getByText(/online/i)).toBeInTheDocument();
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });

    test('should have accessible progress indicators', () => {
      render(
        <div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }} role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>
              <span className="sr-only">75% Complete</span>
            </div>
          </div>
        </div>
      );

      // Check that progress is accessible
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText(/75% complete/i)).toBeInTheDocument();
    });
  });

  describe('High Contrast Mode Support', () => {
    test('should support high contrast mode', async () => {
      const { container } = render(
        <div className="high-contrast">
          <Button>High Contrast Button</Button>
          <p>High contrast text</p>
          <a href="#" className="underline">High contrast link</a>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should maintain readability in high contrast mode', () => {
      render(
        <div className="high-contrast">
          <Card>
            <CardHeader>
              <CardTitle>High Contrast Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This content should be readable in high contrast mode</p>
              <Button>High Contrast Action</Button>
            </CardContent>
          </Card>
        </div>
      );

      // Check that content is still readable
      expect(screen.getByText(/high contrast card/i)).toBeInTheDocument();
      expect(screen.getByText(/this content should be readable in high contrast mode/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /high contrast action/i })).toBeInTheDocument();
    });
  });

  describe('Text Scaling and Zoom', () => {
    test('should support text scaling up to 200%', () => {
      render(
        <div style={{ fontSize: '200%' }}>
          <Button>Scaled Button</Button>
          <p>Scaled text content</p>
          <input type="text" placeholder="Scaled input" />
        </div>
      );

      // Check that elements are still accessible when scaled
      expect(screen.getByRole('button', { name: /scaled button/i })).toBeInTheDocument();
      expect(screen.getByText(/scaled text content/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('should maintain layout with text scaling', () => {
      render(
        <div style={{ fontSize: '150%' }}>
          <Card>
            <CardHeader>
              <CardTitle>Scaled Card Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This content should scale properly</p>
            </CardContent>
          </Card>
        </div>
      );

      // Check that layout is maintained
      expect(screen.getByRole('heading', { name: /scaled card title/i })).toBeInTheDocument();
      expect(screen.getByText(/this content should scale properly/i)).toBeInTheDocument();
    });
  });

  describe('Color Blindness Considerations', () => {
    test('should not rely on color combinations that are problematic for color blindness', () => {
      render(
        <div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded" aria-label="Blue indicator"></div>
            <span className="ml-2">Blue Item</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded" aria-label="Red indicator"></div>
            <span className="ml-2">Red Item</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded" aria-label="Green indicator"></div>
            <span className="ml-2">Green Item</span>
          </div>
        </div>
      );

      // Check that color indicators have text labels
      expect(screen.getByText(/blue item/i)).toBeInTheDocument();
      expect(screen.getByText(/red item/i)).toBeInTheDocument();
      expect(screen.getByText(/green item/i)).toBeInTheDocument();
    });

    test('should provide patterns or textures in addition to color', () => {
      render(
        <div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 border-2 border-blue-700 rounded" aria-label="Blue pattern"></div>
            <span className="ml-2">Blue with Pattern</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 border-2 border-red-700 rounded" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,.5) 2px, rgba(255,255,255,.5) 4px)' }} aria-label="Red pattern"></div>
            <span className="ml-2">Red with Pattern</span>
          </div>
        </div>
      );

      // Check that patterns are used in addition to color
      expect(screen.getByText(/blue with pattern/i)).toBeInTheDocument();
      expect(screen.getByText(/red with pattern/i)).toBeInTheDocument();
    });
  });

  describe('WCAG 2.1 AA Color Contrast Compliance', () => {
    test('should meet WCAG 2.1 AA color contrast requirements', async () => {
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
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: false }, // AA level, not AAA
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have no color contrast violations in charts', async () => {
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
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });

    test('should have no color contrast violations in various components', async () => {
      const { container } = render(
        <div>
          <Button>Button</Button>
          <Badge>Badge</Badge>
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Card content</p>
            </CardContent>
          </Card>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        }
      });

      expect(results).toHaveNoViolations();
    });
  });
});