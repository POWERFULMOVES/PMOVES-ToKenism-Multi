#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PerformanceDashboard {
  constructor() {
    this.resultsDir = path.join(process.cwd(), 'lighthouse-results');
    this.dashboardDir = path.join(process.cwd(), 'performance-dashboard');
    this.ensureDashboardDirectory();
  }

  ensureDashboardDirectory() {
    if (!fs.existsSync(this.dashboardDir)) {
      fs.mkdirSync(this.dashboardDir, { recursive: true });
    }
  }

  generateDashboard() {
    console.log('📊 Generating Performance Dashboard...');
    
    const reports = this.getAllReports();
    const dashboardData = this.processReports(reports);
    
    this.generateHTMLDashboard(dashboardData);
    this.generateJSONDashboard(dashboardData);
    
    console.log(`✅ Dashboard generated: ${path.join(this.dashboardDir, 'index.html')}`);
  }

  getAllReports() {
    const reports = [];
    const files = fs.readdirSync(this.resultsDir);
    
    files.forEach(file => {
      if (file.endsWith('.json') && file.includes('audit-summary')) {
        const filePath = path.join(this.resultsDir, file);
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          reports.push({
            filename: file,
            timestamp: content.timestamp,
            url: content.url,
            results: content
          });
        } catch (error) {
          console.warn(`⚠️  Could not parse ${file}:`, error.message);
        }
      }
    });
    
    return reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  processReports(reports) {
    const data = {
      summary: {
        totalAudits: reports.length,
        dateRange: this.getDateRange(reports),
        averageScores: this.calculateAverageScores(reports)
      },
      trends: this.calculateTrends(reports),
      recent: reports.slice(0, 10),
      recommendations: this.generateRecommendations(reports),
      performance: this.extractPerformanceMetrics(reports)
    };
    
    return data;
  }

  getDateRange(reports) {
    if (reports.length === 0) return null;
    
    const dates = reports.map(r => new Date(r.timestamp));
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates))
    };
  }

  calculateAverageScores(reports) {
    const scores = {
      desktop: { performance: [], accessibility: [], bestPractices: [], seo: [] },
      mobile: { performance: [], accessibility: [], bestPractices: [], seo: [] }
    };

    reports.forEach(report => {
      if (report.results.desktop) {
        scores.desktop.performance.push(report.results.desktop.scores.performance);
        scores.desktop.accessibility.push(report.results.desktop.scores.accessibility);
        scores.desktop.bestPractices.push(report.results.desktop.scores.bestPractices);
        scores.desktop.seo.push(report.results.desktop.scores.seo);
      }
      
      if (report.results.mobile) {
        scores.mobile.performance.push(report.results.mobile.scores.performance);
        scores.mobile.accessibility.push(report.results.mobile.scores.accessibility);
        scores.mobile.bestPractices.push(report.results.mobile.scores.bestPractices);
        scores.mobile.seo.push(report.results.mobile.scores.seo);
      }
    });

    const calculateAverage = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return {
      desktop: {
        performance: calculateAverage(scores.desktop.performance),
        accessibility: calculateAverage(scores.desktop.accessibility),
        bestPractices: calculateAverage(scores.desktop.bestPractices),
        seo: calculateAverage(scores.desktop.seo)
      },
      mobile: {
        performance: calculateAverage(scores.mobile.performance),
        accessibility: calculateAverage(scores.mobile.accessibility),
        bestPractices: calculateAverage(scores.mobile.bestPractices),
        seo: calculateAverage(scores.mobile.seo)
      }
    };
  }

  calculateTrends(reports) {
    const trends = {
      desktop: { performance: [], accessibility: [], bestPractices: [], seo: [] },
      mobile: { performance: [], accessibility: [], bestPractices: [], seo: [] }
    };

    reports.slice(0, 20).reverse().forEach(report => {
      const date = new Date(report.timestamp).toLocaleDateString();
      
      if (report.results.desktop) {
        trends.desktop.performance.push({ date, score: report.results.desktop.scores.performance });
        trends.desktop.accessibility.push({ date, score: report.results.desktop.scores.accessibility });
        trends.desktop.bestPractices.push({ date, score: report.results.desktop.scores.bestPractices });
        trends.desktop.seo.push({ date, score: report.results.desktop.scores.seo });
      }
      
      if (report.results.mobile) {
        trends.mobile.performance.push({ date, score: report.results.mobile.scores.performance });
        trends.mobile.accessibility.push({ date, score: report.results.mobile.scores.accessibility });
        trends.mobile.bestPractices.push({ date, score: report.results.mobile.scores.bestPractices });
        trends.mobile.seo.push({ date, score: report.results.mobile.scores.seo });
      }
    });

    return trends;
  }

  generateRecommendations(reports) {
    const recent = reports[0];
    if (!recent) return [];
    
    const recommendations = [];
    const desktop = recent.results.desktop;
    const mobile = recent.results.mobile;
    
    if (desktop && desktop.scores.performance < 90) {
      recommendations.push({
        priority: 'high',
        category: 'desktop-performance',
        message: `Desktop performance is ${desktop.scores.performance}/100. Target: 90+`,
        suggestions: [
          'Optimize images and use modern formats',
          'Implement code splitting',
          'Reduce JavaScript bundle size',
          'Optimize critical rendering path'
        ]
      });
    }
    
    if (mobile && mobile.scores.performance < 85) {
      recommendations.push({
        priority: 'high',
        category: 'mobile-performance',
        message: `Mobile performance is ${mobile.scores.performance}/100. Target: 85+`,
        suggestions: [
          'Implement mobile-first loading strategies',
          'Reduce server response time',
          'Enable text compression',
          'Optimize for mobile network conditions'
        ]
      });
    }
    
    if (desktop && desktop.scores.accessibility < 95) {
      recommendations.push({
        priority: 'medium',
        category: 'accessibility',
        message: `Accessibility score is ${desktop.scores.accessibility}/100. Target: 95+`,
        suggestions: [
          'Check color contrast ratios',
          'Ensure all images have alt text',
          'Verify heading structure',
          'Test with screen readers'
        ]
      });
    }
    
    return recommendations;
  }

  extractPerformanceMetrics(reports) {
    const metrics = [];
    
    reports.forEach(report => {
      if (report.results.desktop && report.results.desktop.lhr) {
        const lhr = report.results.desktop.lhr;
        const audits = lhr.audits;
        
        metrics.push({
          timestamp: report.timestamp,
          device: 'desktop',
          fcp: audits['first-contentful-paint']?.numericValue,
          lcp: audits['largest-contentful-paint']?.numericValue,
          tti: audits['interactive']?.numericValue,
          cls: audits['cumulative-layout-shift']?.numericValue,
          tbt: audits['total-blocking-time']?.numericValue
        });
      }
      
      if (report.results.mobile && report.results.mobile.lhr) {
        const lhr = report.results.mobile.lhr;
        const audits = lhr.audits;
        
        metrics.push({
          timestamp: report.timestamp,
          device: 'mobile',
          fcp: audits['first-contentful-paint']?.numericValue,
          lcp: audits['largest-contentful-paint']?.numericValue,
          tti: audits['interactive']?.numericValue,
          cls: audits['cumulative-layout-shift']?.numericValue,
          tbt: audits['total-blocking-time']?.numericValue
        });
      }
    });
    
    return metrics;
  }

  generateHTMLDashboard(data) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PMOVES Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .score {
            font-size: 3em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .score.good { color: #27ae60; }
        .score.average { color: #f39c12; }
        .score.poor { color: #e74c3c; }
        
        .metric-label {
            color: #7f8c8d;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .chart-container {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }
        
        .chart-container h3 {
            margin-bottom: 20px;
            color: #2c3e50;
        }
        
        .recommendations {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .recommendation {
            padding: 15px;
            margin-bottom: 15px;
            border-left: 4px solid #f39c12;
            background: #fef9e7;
        }
        
        .recommendation.high {
            border-left-color: #e74c3c;
            background: #fadbd8;
        }
        
        .recommendation h4 {
            margin-bottom: 10px;
            color: #2c3e50;
        }
        
        .recommendation ul {
            margin-left: 20px;
        }
        
        .timestamp {
            text-align: center;
            color: #7f8c8d;
            margin-top: 30px;
        }
        
        .device-toggle {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .device-toggle button {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 0 5px;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.3s;
        }
        
        .device-toggle button:hover {
            background: #2980b9;
        }
        
        .device-toggle button.active {
            background: #2c3e50;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 PMOVES Performance Dashboard</h1>
            <p>Performance monitoring for the PMOVES Token Simulator</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <div class="score ${this.getScoreClass(data.summary.averageScores.desktop.performance)}">${data.summary.averageScores.desktop.performance}</div>
                <div class="metric-label">Desktop Performance</div>
            </div>
            <div class="summary-card">
                <div class="score ${this.getScoreClass(data.summary.averageScores.desktop.accessibility)}">${data.summary.averageScores.desktop.accessibility}</div>
                <div class="metric-label">Desktop Accessibility</div>
            </div>
            <div class="summary-card">
                <div class="score ${this.getScoreClass(data.summary.averageScores.mobile.performance)}">${data.summary.averageScores.mobile.performance}</div>
                <div class="metric-label">Mobile Performance</div>
            </div>
            <div class="summary-card">
                <div class="score ${this.getScoreClass(data.summary.averageScores.mobile.accessibility)}">${data.summary.averageScores.mobile.accessibility}</div>
                <div class="metric-label">Mobile Accessibility</div>
            </div>
        </div>
        
        <div class="device-toggle">
            <button onclick="showDevice('desktop')" class="active" id="desktop-btn">Desktop</button>
            <button onclick="showDevice('mobile')" id="mobile-btn">Mobile</button>
        </div>
        
        <div class="chart-container">
            <h3>Performance Trends</h3>
            <canvas id="trendsChart" width="400" height="200"></canvas>
        </div>
        
        <div class="recommendations">
            <h3>📋 Recommendations</h3>
            ${data.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <h4>${rec.message}</h4>
                    <ul>
                        ${rec.suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
        
        <div class="timestamp">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Total audits: ${data.summary.totalAudits}</p>
        </div>
    </div>
    
    <script>
        const data = ${JSON.stringify(data)};
        let currentDevice = 'desktop';
        let trendsChart;
        
        function showDevice(device) {
            currentDevice = device;
            document.getElementById('desktop-btn').classList.toggle('active', device === 'desktop');
            document.getElementById('mobile-btn').classList.toggle('active', device === 'mobile');
            updateTrendsChart();
        }
        
        function updateTrendsChart() {
            const ctx = document.getElementById('trendsChart').getContext('2d');
            
            if (trendsChart) {
                trendsChart.destroy();
            }
            
            const trends = data.trends[currentDevice];
            const labels = trends.performance.map(p => p.date);
            
            trendsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Performance',
                            data: trends.performance.map(p => p.score),
                            borderColor: '#e74c3c',
                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Accessibility',
                            data: trends.accessibility.map(p => p.score),
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Best Practices',
                            data: trends.bestPractices.map(p => p.score),
                            borderColor: '#27ae60',
                            backgroundColor: 'rgba(39, 174, 96, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'SEO',
                            data: trends.seo.map(p => p.score),
                            borderColor: '#f39c12',
                            backgroundColor: 'rgba(243, 156, 18, 0.1)',
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
        
        // Initialize chart
        updateTrendsChart();
    </script>
</body>
</html>`;
    
    const dashboardPath = path.join(this.dashboardDir, 'index.html');
    fs.writeFileSync(dashboardPath, html);
  }

  getScoreClass(score) {
    if (score >= 90) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  generateJSONDashboard(data) {
    const jsonPath = path.join(this.dashboardDir, 'dashboard-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  }
}

// CLI interface
async function main() {
  const dashboard = new PerformanceDashboard();
  
  try {
    dashboard.generateDashboard();
  } catch (error) {
    console.error('❌ Dashboard generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceDashboard;