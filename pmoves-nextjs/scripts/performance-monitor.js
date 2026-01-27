#!/usr/bin/env node

const LighthouseAuditor = require('./lighthouse-audit');
const config = require('../lighthouse.config');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.auditor = new LighthouseAuditor();
    this.results = [];
  }

  async runAudits() {
    console.log('🚀 Starting PMOVES Performance Monitoring...\n');
    
    for (const url of config.urls) {
      console.log(`📊 Auditing: ${url}`);
      
      try {
        const result = await this.auditor.runFullAudit(url);
        this.results.push({
          url,
          timestamp: new Date().toISOString(),
          results: result,
        });
        
        console.log(`✅ Completed: ${url}\n`);
      } catch (error) {
        console.error(`❌ Failed to audit ${url}:`, error.message);
        this.results.push({
          url,
          timestamp: new Date().toISOString(),
          error: error.message,
        });
      }
    }

    await this.generateMonitoringReport();
    this.checkThresholds();
  }

  async generateMonitoringReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      details: this.results,
      recommendations: this.generateRecommendations(),
    };

    const reportPath = path.join(process.cwd(), 'lighthouse-results', `monitoring-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Monitoring report saved: ${reportPath}`);
    
    return report;
  }

  generateSummary() {
    const successfulAudits = this.results.filter(r => !r.error);
    
    if (successfulAudits.length === 0) {
      return {
        status: 'failed',
        message: 'All audits failed',
      };
    }

    const summary = {
      totalUrls: config.urls.length,
      successfulAudits: successfulAudits.length,
      failedAudits: this.results.length - successfulAudits.length,
      averageScores: this.calculateAverageScores(successfulAudits),
      status: 'completed',
    };

    return summary;
  }

  calculateAverageScores(successfulAudits) {
    const scores = {
      desktop: { performance: [], accessibility: [], bestPractices: [], seo: [] },
      mobile: { performance: [], accessibility: [], bestPractices: [], seo: [] },
    };

    successfulAudits.forEach(audit => {
      if (audit.results.desktop) {
        scores.desktop.performance.push(audit.results.desktop.scores.performance);
        scores.desktop.accessibility.push(audit.results.desktop.scores.accessibility);
        scores.desktop.bestPractices.push(audit.results.desktop.scores.bestPractices);
        scores.desktop.seo.push(audit.results.desktop.scores.seo);
      }
      
      if (audit.results.mobile) {
        scores.mobile.performance.push(audit.results.mobile.scores.performance);
        scores.mobile.accessibility.push(audit.results.mobile.scores.accessibility);
        scores.mobile.bestPractices.push(audit.results.mobile.scores.bestPractices);
        scores.mobile.seo.push(audit.results.mobile.scores.seo);
      }
    });

    const calculateAverage = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return {
      desktop: {
        performance: calculateAverage(scores.desktop.performance),
        accessibility: calculateAverage(scores.desktop.accessibility),
        bestPractices: calculateAverage(scores.desktop.bestPractices),
        seo: calculateAverage(scores.desktop.seo),
      },
      mobile: {
        performance: calculateAverage(scores.mobile.performance),
        accessibility: calculateAverage(scores.mobile.accessibility),
        bestPractices: calculateAverage(scores.mobile.bestPractices),
        seo: calculateAverage(scores.mobile.seo),
      },
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const averageScores = this.calculateAverageScores(this.results.filter(r => !r.error));

    // Check performance
    if (averageScores.desktop.performance < config.thresholds.performance) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        message: `Desktop performance (${averageScores.desktop.performance}) is below threshold (${config.thresholds.performance})`,
        suggestions: [
          'Optimize images and use modern formats (WebP, AVIF)',
          'Implement lazy loading for non-critical resources',
          'Minimize JavaScript bundle size',
          'Use code splitting for better loading performance',
        ],
      });
    }

    if (averageScores.mobile.performance < config.thresholds.performance) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        message: `Mobile performance (${averageScores.mobile.performance}) is below threshold (${config.thresholds.performance})`,
        suggestions: [
          'Optimize for mobile-first loading',
          'Reduce server response time',
          'Enable text compression',
          'Optimize critical rendering path',
        ],
      });
    }

    // Check accessibility
    if (averageScores.desktop.accessibility < config.thresholds.accessibility) {
      recommendations.push({
        category: 'accessibility',
        priority: 'medium',
        message: `Desktop accessibility (${averageScores.desktop.accessibility}) is below threshold (${config.thresholds.accessibility})`,
        suggestions: [
          'Ensure all images have alt attributes',
          'Check color contrast ratios',
          'Implement proper heading structure',
          'Add ARIA labels where needed',
        ],
      });
    }

    // Check best practices
    if (averageScores.desktop.bestPractices < config.thresholds.bestPractices) {
      recommendations.push({
        category: 'best-practices',
        priority: 'medium',
        message: `Best practices (${averageScores.desktop.bestPractices}) are below threshold (${config.thresholds.bestPractices})`,
        suggestions: [
          'Use HTTPS for all resources',
          'Implement proper security headers',
          'Avoid deprecated APIs',
          'Use modern JavaScript features',
        ],
      });
    }

    // Check SEO
    if (averageScores.desktop.seo < config.thresholds.seo) {
      recommendations.push({
        category: 'seo',
        priority: 'low',
        message: `SEO score (${averageScores.desktop.seo}) is below threshold (${config.thresholds.seo})`,
        suggestions: [
          'Optimize meta descriptions',
          'Ensure proper heading hierarchy',
          'Add structured data markup',
          'Optimize for mobile indexing',
        ],
      });
    }

    return recommendations;
  }

  checkThresholds() {
    const averageScores = this.calculateAverageScores(this.results.filter(r => !r.error));
    const failures = [];

    Object.keys(config.thresholds).forEach(category => {
      if (averageScores.desktop[category] < config.thresholds[category]) {
        failures.push({
          device: 'desktop',
          category,
          score: averageScores.desktop[category],
          threshold: config.thresholds[category],
        });
      }
      
      if (averageScores.mobile[category] < config.thresholds[category]) {
        failures.push({
          device: 'mobile',
          category,
          score: averageScores.mobile[category],
          threshold: config.thresholds[category],
        });
      }
    });

    if (failures.length > 0) {
      console.log('\n⚠️  THRESHOLD VIOLATIONS DETECTED:');
      failures.forEach(failure => {
        console.log(`   ${failure.device} ${failure.category}: ${failure.score}/100 (threshold: ${failure.threshold})`);
      });
      console.log('\n💡 Check the recommendations in the monitoring report for improvement suggestions.');
    } else {
      console.log('\n✅ All performance thresholds met!');
    }

    return failures;
  }

  async saveBaseline() {
    const baseline = {
      timestamp: new Date().toISOString(),
      scores: this.calculateAverageScores(this.results.filter(r => !r.error)),
      thresholds: config.thresholds,
    };

    const baselinePath = path.join(process.cwd(), 'lighthouse-results', 'performance-baseline.json');
    fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`📊 Performance baseline saved: ${baselinePath}`);
    
    return baseline;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'audit';

  const monitor = new PerformanceMonitor();

  try {
    switch (command) {
      case 'audit':
        await monitor.runAudits();
        break;
        
      case 'baseline':
        await monitor.runAudits();
        await monitor.saveBaseline();
        break;
        
      case 'compare':
        // TODO: Implement comparison with previous baseline
        console.log('Comparison feature coming soon...');
        break;
        
      default:
        console.log('Usage: node performance-monitor.js [audit|baseline|compare]');
        console.log('  audit    - Run performance audits');
        console.log('  baseline - Run audits and save baseline');
        console.log('  compare  - Compare current results with baseline');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Monitoring failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceMonitor;