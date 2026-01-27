/**
 * CI/CD Accessibility Testing Framework
 * Comprehensive accessibility testing for continuous integration
 */

import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EnhancedSimulationForm } from '@/components/EnhancedSimulationForm';
import { ChartWrapper } from '@/components/charts/ChartWrapper';
import { Button } from '@/components/ui/button';
import { DEFAULT_PARAMS } from '@/lib/simulation';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

interface AccessibilityTestResult {
  component: string;
  violations: any[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  timestamp: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

interface AccessibilityReport {
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalViolations: number;
    criticalViolations: number;
    seriousViolations: number;
    moderateViolations: number;
    minorViolations: number;
  };
  results: AccessibilityTestResult[];
  timestamp: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  passRate: number;
}

class AccessibilityTestFramework {
  private results: AccessibilityTestResult[] = [];
  private wcagLevel: 'A' | 'AA' | 'AAA' = 'AA';

  constructor(wcagLevel: 'A' | 'AA' | 'AAA' = 'AA') {
    this.wcagLevel = wcagLevel;
  }

  async testComponent(
    componentName: string,
    component: React.ReactElement,
    options: { level?: 'A' | 'AA' | 'AAA' } = {}
  ): Promise<AccessibilityTestResult> {
    const testLevel = options.level || this.wcagLevel;
    const { container } = render(component);

    const results = await axe(container, {
      reporter: 'v2',
    });

    const result: AccessibilityTestResult = {
      component: componentName,
      violations: results.violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
      timestamp: new Date().toISOString(),
      wcagLevel: testLevel,
    };

    this.results.push(result);
    return result;
  }

  generateReport(): AccessibilityReport {
    const totalTests = this.results.length;
    const failedTests = this.results.filter(r => r.violations.length > 0).length;
    const passedTests = totalTests - failedTests;
    const totalViolations = this.results.reduce((sum, r) => sum + r.violations.length, 0);

    const criticalViolations = this.results.reduce(
      (sum, r) => sum + r.violations.filter((v: any) => v.impact === 'critical').length,
      0
    );
    const seriousViolations = this.results.reduce(
      (sum, r) => sum + r.violations.filter((v: any) => v.impact === 'serious').length,
      0
    );
    const moderateViolations = this.results.reduce(
      (sum, r) => sum + r.violations.filter((v: any) => v.impact === 'moderate').length,
      0
    );
    const minorViolations = this.results.reduce(
      (sum, r) => sum + r.violations.filter((v: any) => v.impact === 'minor').length,
      0
    );

    return {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        totalViolations,
        criticalViolations,
        seriousViolations,
        moderateViolations,
        minorViolations,
      },
      results: this.results,
      timestamp: new Date().toISOString(),
      wcagLevel: this.wcagLevel,
      passRate: (passedTests / totalTests) * 100,
    };
  }

  exportReportJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  exportReportMarkdown(): string {
    const report = this.generateReport();
    
    let markdown = `# Accessibility Test Report\n\n`;
    markdown += `**WCAG Level:** ${report.wcagLevel}\n`;
    markdown += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Tests:** ${report.summary.totalTests}\n`;
    markdown += `- **Passed Tests:** ${report.summary.passedTests}\n`;
    markdown += `- **Failed Tests:** ${report.summary.failedTests}\n`;
    markdown += `- **Pass Rate:** ${report.passRate.toFixed(1)}%\n\n`;
    
    markdown += `### Violations by Impact\n\n`;
    markdown += `- **Critical:** ${report.summary.criticalViolations}\n`;
    markdown += `- **Serious:** ${report.summary.seriousViolations}\n`;
    markdown += `- **Moderate:** ${report.summary.moderateViolations}\n`;
    markdown += `- **Minor:** ${report.summary.minorViolations}\n\n`;
    
    markdown += `## Component Results\n\n`;
    
    for (const result of report.results) {
      markdown += `### ${result.component}\n\n`;
      markdown += `- **Status:** ${result.violations.length === 0 ? '✅ PASSED' : '❌ FAILED'}\n`;
      markdown += `- **Violations:** ${result.violations.length}\n`;
      markdown += `- **Passes:** ${result.passes}\n`;
      markdown += `- **WCAG Level:** ${result.wcagLevel}\n\n`;
      
      if (result.violations.length > 0) {
        markdown += `#### Violations\n\n`;
        for (const violation of result.violations) {
          markdown += `**${violation.id}** (${violation.impact})\n`;
          markdown += `${violation.description}\n\n`;
          markdown += `**Help:** ${violation.help}\n`;
          markdown += `**Help URL:** ${violation.helpUrl}\n\n`;
          
          if (violation.nodes && violation.nodes.length > 0) {
            markdown += `**Affected Elements:**\n`;
            for (const node of violation.nodes) {
              markdown += `- \`${node.html}\`\n`;
            }
            markdown += `\n`;
          }
        }
      }
    }
    
    return markdown;
  }

  checkThresholds(thresholds: { passRate?: number; maxCritical?: number; maxSerious?: number }): boolean {
    const report = this.generateReport();
    
    if (thresholds.passRate && report.passRate < thresholds.passRate) {
      console.error(`Pass rate ${report.passRate}% is below threshold ${thresholds.passRate}%`);
      return false;
    }
    
    if (thresholds.maxCritical && report.summary.criticalViolations > thresholds.maxCritical) {
      console.error(`Critical violations ${report.summary.criticalViolations} exceed threshold ${thresholds.maxCritical}`);
      return false;
    }
    
    if (thresholds.maxSerious && report.summary.seriousViolations > thresholds.maxSerious) {
      console.error(`Serious violations ${report.summary.seriousViolations} exceed threshold ${thresholds.maxSerious}`);
      return false;
    }
    
    return true;
  }
}

describe('CI/CD Accessibility Testing Framework', () => {
  let framework: AccessibilityTestFramework;

  beforeEach(() => {
    framework = new AccessibilityTestFramework('AA');
  });

  describe('Framework Initialization', () => {
    test('should initialize with default WCAG AA level', () => {
      expect(framework).toBeInstanceOf(AccessibilityTestFramework);
    });

    test('should initialize with custom WCAG level', () => {
      const customFramework = new AccessibilityTestFramework('AAA');
      expect(customFramework).toBeInstanceOf(AccessibilityTestFramework);
    });
  });

  describe('Component Testing', () => {
    test('should test EnhancedSimulationForm accessibility', async () => {
      const result = await framework.testComponent(
        'EnhancedSimulationForm',
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={jest.fn()}
          onSubmit={jest.fn()}
          isLoading={false}
          onReset={jest.fn()}
        />
      );

      expect(result.component).toBe('EnhancedSimulationForm');
      expect(result.wcagLevel).toBe('AA');
      expect(result.violations).toHaveLength(0);
    });

    test('should test ChartWrapper accessibility', async () => {
      const result = await framework.testComponent(
        'ChartWrapper',
        <ChartWrapper
          title="Test Chart"
          description="Test chart description"
        >
          <div>Chart content</div>
        </ChartWrapper>
      );

      expect(result.component).toBe('ChartWrapper');
      expect(result.wcagLevel).toBe('AA');
      expect(result.violations).toHaveLength(0);
    });

    test('should test Button accessibility', async () => {
      const result = await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      expect(result.component).toBe('Button');
      expect(result.wcagLevel).toBe('AA');
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    test('should generate comprehensive accessibility report', async () => {
      await framework.testComponent(
        'EnhancedSimulationForm',
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={jest.fn()}
          onSubmit={jest.fn()}
          isLoading={false}
          onReset={jest.fn()}
        />
      );

      await framework.testComponent(
        'ChartWrapper',
        <ChartWrapper
          title="Test Chart"
          description="Test chart description"
        >
          <div>Chart content</div>
        </ChartWrapper>
      );

      const report = framework.generateReport();

      expect(report.summary.totalTests).toBe(2);
      expect(report.summary.passedTests).toBe(2);
      expect(report.summary.failedTests).toBe(0);
      expect(report.summary.totalViolations).toBe(0);
      expect(report.passRate).toBe(100);
      expect(report.wcagLevel).toBe('AA');
      expect(report.results).toHaveLength(2);
    });

    test('should export JSON report', async () => {
      await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const jsonReport = framework.exportReportJSON();
      const parsedReport = JSON.parse(jsonReport);

      expect(parsedReport.summary.totalTests).toBe(1);
      expect(parsedReport.summary.passedTests).toBe(1);
      expect(parsedReport.wcagLevel).toBe('AA');
    });

    test('should export Markdown report', async () => {
      await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const markdownReport = framework.exportReportMarkdown();

      expect(markdownReport).toContain('# Accessibility Test Report');
      expect(markdownReport).toContain('**WCAG Level:** AA');
      expect(markdownReport).toContain('## Summary');
      expect(markdownReport).toContain('## Component Results');
      expect(markdownReport).toContain('### Button');
    });
  });

  describe('Threshold Checking', () => {
    test('should pass when all thresholds are met', async () => {
      await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const passed = framework.checkThresholds({
        passRate: 95,
        maxCritical: 0,
        maxSerious: 0,
      });

      expect(passed).toBe(true);
    });

    test('should fail when pass rate threshold is not met', async () => {
      // Mock a component with violations
      const mockResult: AccessibilityTestResult = {
        component: 'TestComponent',
        violations: [{
          id: 'button-name',
          impact: 'serious',
          description: 'Button has no accessible name',
          help: 'Provide an accessible name for button',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.1/button-name/',
          nodes: [],
        }],
        passes: 0,
        incomplete: 0,
        inapplicable: 0,
        timestamp: new Date().toISOString(),
        wcagLevel: 'AA',
      };

      framework.results.push(mockResult);

      const passed = framework.checkThresholds({
        passRate: 95,
        maxCritical: 0,
        maxSerious: 0,
      });

      expect(passed).toBe(false);
    });
  });

  describe('CI/CD Integration', () => {
    test('should provide exit codes for CI/CD', async () => {
      await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const report = framework.generateReport();
      const exitCode = report.summary.failedTests > 0 ? 1 : 0;

      expect(exitCode).toBe(0); // Should pass
    });

    test('should handle multiple WCAG levels', async () => {
      const aaFramework = new AccessibilityTestFramework('AA');
      const aaaFramework = new AccessibilityTestFramework('AAA');

      await aaFramework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      await aaaFramework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const aaReport = aaFramework.generateReport();
      const aaaReport = aaaFramework.generateReport();

      expect(aaReport.wcagLevel).toBe('AA');
      expect(aaaReport.wcagLevel).toBe('AAA');
    });

    test('should generate reports for different output formats', async () => {
      await framework.testComponent(
        'Button',
        <Button>Test Button</Button>
      );

      const jsonReport = framework.exportReportJSON();
      const markdownReport = framework.exportReportMarkdown();

      expect(jsonReport).toMatch(/^{/); // Valid JSON
      expect(markdownReport).toMatch(/#/); // Valid Markdown
    });
  });

  describe('Performance Considerations', () => {
    test('should complete testing within reasonable time', async () => {
      const startTime = Date.now();

      await framework.testComponent(
        'EnhancedSimulationForm',
        <EnhancedSimulationForm
          params={DEFAULT_PARAMS}
          onParamsChange={jest.fn()}
          onSubmit={jest.fn()}
          isLoading={false}
          onReset={jest.fn()}
        />
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('should handle large number of components efficiently', async () => {
      const startTime = Date.now();

      // Test multiple components
      for (let i = 0; i < 10; i++) {
        await framework.testComponent(
          `Button-${i}`,
          <Button>Test Button {i}</Button>
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds for 10 components
      expect(duration).toBeLessThan(10000);
    });
  });
});

// Export for use in CI/CD scripts
export { AccessibilityTestFramework, AccessibilityTestResult, AccessibilityReport };