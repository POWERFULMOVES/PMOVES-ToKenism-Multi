/**
 * Lighthouse Performance Monitoring Configuration
 * This file contains settings for automated performance audits
 */

const config = {
  // URLs to audit
  urls: [
    'http://localhost:3000', // Home page
    'http://localhost:3000/analytics', // Analytics page
    'http://localhost:3000/sensitivity', // Sensitivity analysis page
  ],
  
  // Device configurations
  devices: ['desktop', 'mobile'],
  
  // Performance thresholds (0-100)
  thresholds: {
    performance: 80,
    accessibility: 90,
    bestPractices: 90,
    seo: 85,
  },
  
  // Audit settings
  auditSettings: {
    // Number of runs to average for more reliable results
    runs: 3,
    
    // Wait time between runs (ms)
    waitTime: 2000,
    
    // Timeout for each audit (ms)
    timeout: 60000,
  },
  
  // Reporting settings
  reporting: {
    // Generate HTML reports
    generateHTML: true,
    
    // Generate JSON reports
    generateJSON: true,
    
    // Generate summary report
    generateSummary: true,
    
    // Directory for reports (relative to project root)
    outputDir: 'lighthouse-results',
  },
  
  // Monitoring schedule (for CI/CD integration)
  monitoring: {
    // Run audits on these branches
    branches: ['main', 'develop'],
    
    // Run audits on pull requests
    runOnPR: true,
    
    // Comment on PRs with results
    commentOnPR: true,
  },
  
  // Slack/Discord webhook for notifications (optional)
  notifications: {
    webhook: process.env.LIGHTHOUSE_WEBHOOK_URL,
    // Only notify if scores drop below thresholds
    notifyOnFailure: true,
    // Notify on improvement
    notifyOnImprovement: true,
  },
};

module.exports = config;