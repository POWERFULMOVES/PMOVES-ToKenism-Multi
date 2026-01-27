#!/usr/bin/env node

const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

// Configuration for Lighthouse audit
const LH_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    formFactor: 'desktop',
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.109 Safari/537.36',
  },
};

// Mobile configuration
const MOBILE_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    formFactor: 'mobile',
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Linux; Android 7.0; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36',
  },
};

class LighthouseAuditor {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'lighthouse-results');
    this.ensureResultsDirectory();
  }

  ensureResultsDirectory() {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async launchChrome() {
    return await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
    });
  }

  async runAudit(url, config, deviceType = 'desktop') {
    const chrome = await this.launchChrome();
    
    try {
      console.log(`Running Lighthouse audit for ${url} (${deviceType})...`);
      
      const options = {
        logLevel: 'info',
        output: 'json',
        onlyCategories: config.settings.onlyCategories,
        port: chrome.port,
      };

      const runnerResult = await lighthouse(url, options, config);
      
      await chrome.kill();
      
      return {
        json: runnerResult.report,
        lhr: runnerResult.lhr,
      };
    } catch (error) {
      await chrome.kill();
      throw error;
    }
  }

  generateReport(lhr, deviceType, url) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lighthouse-report-${deviceType}-${timestamp}`;
    
    // Save JSON report
    const jsonPath = path.join(this.resultsDir, `${filename}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(lhr, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport(lhr, deviceType, url);
    const htmlPath = path.join(this.resultsDir, `${filename}.html`);
    fs.writeFileSync(htmlPath, htmlReport);
    
    return {
      jsonPath,
      htmlPath,
      scores: this.extractScores(lhr),
    };
  }

  extractScores(lhr) {
    const categories = lhr.categories;
    return {
      performance: Math.round(categories.performance.score * 100),
      accessibility: Math.round(categories.accessibility.score * 100),
      bestPractices: Math.round(categories['best-practices'].score * 100),
      seo: Math.round(categories.seo.score * 100),
      overall: Math.round(
        (categories.performance.score +
          categories.accessibility.score +
          categories['best-practices'].score +
          categories.seo.score) /
          4 * 100
      ),
    };
  }

  generateHTMLReport(lhr, deviceType, url) {
    const scores = this.extractScores(lhr);
    const timestamp = new Date().toLocaleString();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lighthouse Report - ${deviceType}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .score-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .score-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .score-label { color: #666; font-size: 0.9em; }
        .good { color: #0cce6b; }
        .average { color: #ffa400; }
        .poor { color: #ff4e42; }
        .details { margin-top: 30px; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .metric-name { font-weight: 500; }
        .metric-value { font-family: monospace; }
        .timestamp { color: #666; font-size: 0.9em; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Lighthouse Performance Report</h1>
            <p>URL: ${url}</p>
            <p>Device: ${deviceType}</p>
        </div>
        
        <div class="scores">
            <div class="score-card">
                <div class="score-value ${this.getScoreClass(scores.performance)}">${scores.performance}</div>
                <div class="score-label">Performance</div>
            </div>
            <div class="score-card">
                <div class="score-value ${this.getScoreClass(scores.accessibility)}">${scores.accessibility}</div>
                <div class="score-label">Accessibility</div>
            </div>
            <div class="score-card">
                <div class="score-value ${this.getScoreClass(scores.bestPractices)}">${scores.bestPractices}</div>
                <div class="score-label">Best Practices</div>
            </div>
            <div class="score-card">
                <div class="score-value ${this.getScoreClass(scores.seo)}">${scores.seo}</div>
                <div class="score-label">SEO</div>
            </div>
            <div class="score-card">
                <div class="score-value ${this.getScoreClass(scores.overall)}">${scores.overall}</div>
                <div class="score-label">Overall</div>
            </div>
        </div>
        
        <div class="details">
            <h2>Performance Metrics</h2>
            ${this.generateMetricsHTML(lhr.audits)}
        </div>
        
        <div class="timestamp">
            Generated: ${timestamp}
        </div>
    </div>
</body>
</html>`;
  }

  getScoreClass(score) {
    if (score >= 90) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  generateMetricsHTML(audits) {
    const metrics = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'first-meaningful-paint',
      'speed-index',
      'interactive',
      'total-blocking-time',
      'cumulative-layout-shift',
    ];

    return metrics
      .map(metric => {
        const audit = audits[metric];
        if (!audit) return '';
        
        return `
          <div class="metric">
            <span class="metric-name">${audit.title}</span>
            <span class="metric-value">${audit.displayValue || 'N/A'}</span>
          </div>
        `;
      })
      .join('');
  }

  async runFullAudit(url) {
    console.log(`Starting full Lighthouse audit for: ${url}`);
    
    const results = {
      timestamp: new Date().toISOString(),
      url,
      desktop: null,
      mobile: null,
    };

    try {
      // Run desktop audit
      console.log('Running desktop audit...');
      const desktopResult = await this.runAudit(url, LH_CONFIG, 'desktop');
      results.desktop = this.generateReport(desktopResult.lhr, 'desktop', url);
      console.log(`Desktop audit complete. Performance: ${results.desktop.scores.performance}`);

      // Run mobile audit
      console.log('Running mobile audit...');
      const mobileResult = await this.runAudit(url, MOBILE_CONFIG, 'mobile');
      results.mobile = this.generateReport(mobileResult.lhr, 'mobile', url);
      console.log(`Mobile audit complete. Performance: ${results.mobile.scores.performance}`);

      // Save summary report
      const summaryPath = path.join(this.resultsDir, `audit-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
      
      console.log('\n=== AUDIT COMPLETE ===');
      console.log(`Desktop: Performance ${results.desktop.scores.performance} | Accessibility ${results.desktop.scores.accessibility} | Best Practices ${results.desktop.scores.bestPractices} | SEO ${results.desktop.scores.seo}`);
      console.log(`Mobile:  Performance ${results.mobile.scores.performance} | Accessibility ${results.mobile.scores.accessibility} | Best Practices ${results.mobile.scores.bestPractices} | SEO ${results.mobile.scores.seo}`);
      console.log(`\nReports saved to: ${this.resultsDir}`);
      console.log(`Summary: ${summaryPath}`);
      
      return results;
    } catch (error) {
      console.error('Audit failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node lighthouse-audit.js <url> [device]');
    console.log('Example: node lighthouse-audit.js http://localhost:3000');
    console.log('Device options: desktop, mobile, both (default: both)');
    process.exit(1);
  }

  const url = args[0];
  const device = args[1] || 'both';
  
  const auditor = new LighthouseAuditor();
  
  try {
    if (device === 'both') {
      await auditor.runFullAudit(url);
    } else if (device === 'desktop') {
      const result = await auditor.runAudit(url, LH_CONFIG, 'desktop');
      const report = auditor.generateReport(result.lhr, 'desktop', url);
      console.log(`Desktop audit complete. Performance: ${report.scores.performance}`);
    } else if (device === 'mobile') {
      const result = await auditor.runAudit(url, MOBILE_CONFIG, 'mobile');
      const report = auditor.generateReport(result.lhr, 'mobile', url);
      console.log(`Mobile audit complete. Performance: ${report.scores.performance}`);
    } else {
      console.error('Invalid device option. Use: desktop, mobile, or both');
      process.exit(1);
    }
  } catch (error) {
    console.error('Audit failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LighthouseAuditor;