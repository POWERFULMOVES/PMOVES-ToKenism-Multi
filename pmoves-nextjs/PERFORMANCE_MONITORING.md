# PMOVES Performance Monitoring Framework

## Overview
This document describes the comprehensive performance monitoring framework established for the PMOVES Token Simulator frontend application. The framework includes automated Lighthouse audits, performance dashboards, CI/CD integration, and continuous monitoring capabilities.

## 🚀 Quick Start

### Run Performance Audit
```bash
# Run full Lighthouse audit (desktop + mobile)
npm run lighthouse:local

# Run desktop-only audit
npm run lighthouse:desktop

# Run mobile-only audit
npm run lighthouse:mobile
```

### Performance Monitoring
```bash
# Run comprehensive performance monitoring
npm run perf:monitor

# Generate performance baseline
npm run perf:baseline

# Generate visual dashboard
npm run perf:dashboard
```

## 📊 Current Performance Baseline

### Desktop Performance
- **Performance**: 81/100 (Good)
- **Accessibility**: 96/100 (Excellent)
- **Best Practices**: 100/100 (Perfect)
- **SEO**: 100/100 (Perfect)

### Mobile Performance
- **Performance**: 73/100 (Good)
- **Accessibility**: 96/100 (Excellent)
- **Best Practices**: 100/100 (Perfect)
- **SEO**: 100/100 (Perfect)

## 🛠️ Monitoring Tools

### 1. Lighthouse Audit Script (`scripts/lighthouse-audit.js`)
- **Purpose**: Run comprehensive Lighthouse audits
- **Features**:
  - Desktop and mobile testing
  - HTML and JSON report generation
  - Configurable audit settings
  - Automated Chrome launching

### 2. Performance Monitor (`scripts/performance-monitor.js`)
- **Purpose**: Continuous performance monitoring
- **Features**:
  - Multi-URL auditing
  - Threshold validation
  - Trend analysis
  - Recommendation generation

### 3. Performance Dashboard (`scripts/performance-dashboard.js`)
- **Purpose**: Visual performance reporting
- **Features**:
  - Interactive HTML dashboard
  - Performance trend charts
  - Automated recommendations
  - Historical data analysis

## 📁 File Structure

```
pmoves-nextjs/
├── scripts/
│   ├── lighthouse-audit.js      # Core Lighthouse audit script
│   ├── performance-monitor.js   # Performance monitoring framework
│   └── performance-dashboard.js # Visual dashboard generator
├── lighthouse-results/          # Audit results storage
├── performance-dashboard/       # Generated dashboard files
├── lighthouse.config.js         # Performance monitoring config
├── lighthouserc.js             # Lighthouse CI configuration
├── .github/workflows/
│   └── performance-audit.yml   # CI/CD integration
├── PERFORMANCE_BASELINE.md     # Baseline performance report
└── PERFORMANCE_MONITORING.md   # This documentation
```

## ⚙️ Configuration

### Performance Thresholds
Edit `lighthouse.config.js` to adjust performance thresholds:

```javascript
thresholds: {
  performance: 80,      // Minimum performance score
  accessibility: 90,    // Minimum accessibility score
  bestPractices: 90,    // Minimum best practices score
  seo: 85,              // Minimum SEO score
}
```

### Audit URLs
Configure URLs to audit in `lighthouse.config.js`:

```javascript
urls: [
  'http://localhost:3000',           // Home page
  'http://localhost:3000/analytics', // Analytics page
  'http://localhost:3000/sensitivity' // Sensitivity analysis page
]
```

## 🔧 CI/CD Integration

### GitHub Actions Workflow
The framework includes automated performance auditing in CI/CD:

- **Triggers**: Push to main/develop, pull requests, daily schedule
- **Features**:
  - Automated Lighthouse audits
  - Performance assertions
  - PR comments with results
  - Artifact uploads

### Performance Assertions
The CI pipeline enforces minimum performance standards:

```javascript
assertions: {
  'categories:performance': ['warn', { minScore: 0.8 }],
  'categories:accessibility': ['error', { minScore: 0.9 }],
  'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
  'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
}
```

## 📈 Performance Metrics

### Core Web Vitals
- **First Contentful Paint (FCP)**: Measures loading performance
- **Largest Contentful Paint (LCP)**: Measures perceived load speed
- **Cumulative Layout Shift (CLS)**: Measures visual stability
- **Time to Interactive (TTI)**: Measures interactivity
- **Total Blocking Time (TBT)**: Measures main thread blocking

### Lighthouse Categories
- **Performance**: Page load speed and responsiveness
- **Accessibility**: Usability for people with disabilities
- **Best Practices**: Modern web development standards
- **SEO**: Search engine optimization factors

## 🎯 Performance Targets

### Current Targets
| Metric | Desktop Target | Mobile Target |
|--------|---------------|---------------|
| Performance | ≥80 | ≥75 |
| Accessibility | ≥90 | ≥90 |
| Best Practices | ≥90 | ≥90 |
| SEO | ≥85 | ≥85 |
| LCP | ≤2.5s | ≤2.5s |
| FCP | ≤1.8s | ≤1.8s |

### Future Goals
| Metric | Desktop Goal | Mobile Goal |
|--------|-------------|-------------|
| Performance | ≥90 | ≥85 |
| Accessibility | ≥95 | ≥95 |
| Best Practices | ≥95 | ≥95 |
| SEO | ≥95 | ≥95 |

## 🔍 Monitoring Schedule

### Automated Monitoring
- **CI/CD Pipeline**: Every push and pull request
- **Daily Schedule**: 2 AM UTC daily audits
- **Weekly Reports**: Comprehensive trend analysis

### Manual Monitoring
- **Monthly Reviews**: Full performance assessment
- **Release Testing**: Pre-deployment validation
- **Incident Response**: On-demand performance checks

## 🚨 Alerting and Notifications

### Performance Regression Alerts
- Score drops below configured thresholds
- Significant performance degradation (>10%)
- New performance issues introduced

### Notification Channels
- GitHub PR comments
- Email notifications (configurable)
- Slack/Discord webhooks (optional)

## 📋 Maintenance Tasks

### Weekly Tasks
- Review performance dashboard
- Check for new performance issues
- Validate CI/CD pipeline results

### Monthly Tasks
- Update performance baseline
- Review and adjust thresholds
- Analyze performance trends
- Generate comprehensive reports

### Quarterly Tasks
- Performance framework review
- Tool updates and upgrades
- Process optimization
- Team training updates

## 🛡️ Troubleshooting

### Common Issues

1. **Lighthouse Audit Failures**
   ```bash
   # Check if server is running
   npm run dev
   
   # Run audit with verbose output
   DEBUG=lighthouse:* npm run lighthouse:local
   ```

2. **Performance Score Fluctuations**
   - Ensure consistent test environment
   - Check for network variability
   - Verify server performance
   - Review recent code changes

3. **CI/CD Integration Issues**
   - Check GitHub Actions logs
   - Verify Lighthouse CI configuration
   - Ensure proper artifact uploads
   - Validate performance assertions

### Debug Mode
Enable debug logging:
```bash
DEBUG=performance:* npm run perf:monitor
```

## 📚 Additional Resources

### Documentation
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Performance Budgets](https://web.dev/performance-budgets-101/)

### Tools
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [WebPageTest](https://www.webpagetest.org/)
- [PageSpeed Insights](https://pagespeed.web.dev/)

## 🤝 Contributing

### Adding New Metrics
1. Update `lighthouse.config.js`
2. Modify monitoring scripts
3. Update dashboard templates
4. Test thoroughly

### Improving Performance
1. Run baseline audit
2. Identify bottlenecks
3. Implement optimizations
4. Validate improvements
5. Update documentation

## 📞 Support

For performance-related issues:
1. Check this documentation
2. Review generated reports
3. Check CI/CD logs
4. Contact development team

---

**Last Updated**: November 10, 2025  
**Next Review**: December 10, 2025