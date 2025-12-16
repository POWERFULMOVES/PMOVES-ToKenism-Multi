# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers privately
3. Include detailed information about the vulnerability:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

---

## Security Best Practices

### For Contributors

#### Code Security

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Especially user-provided data
3. **Use parameterized queries** - Prevent SQL injection
4. **Sanitize outputs** - Prevent XSS attacks
5. **Follow least privilege** - Minimize permissions

#### Dependency Management

1. **Regular updates** - Keep dependencies current
2. **Vulnerability scanning** - Run `npm audit` / `pip-audit`
3. **Lock files** - Commit package-lock.json and requirements.txt
4. **Review dependencies** - Before adding new packages

### Environment Variables

Required secrets (DO NOT commit these):

```bash
# API Keys
FIREFLY_API_TOKEN=<your-token>
DOX_API_KEY=<optional-key>

# Database
DATABASE_URL=<connection-string>
SUPABASE_KEY=<service-key>

# External Services
NATS_URL=<nats-server-url>
TENSORZERO_URL=<gateway-url>
```

### Smart Contract Security

The Solidity contracts in this repository handle financial logic. Additional security measures:

1. **Audit Status**: Contracts should be audited before mainnet deployment
2. **Access Control**: Use OpenZeppelin's `Ownable` and `AccessControl`
3. **Reentrancy**: Use `ReentrancyGuard` for external calls
4. **Overflow**: Solidity ^0.8.0 has built-in overflow protection
5. **Testing**: 95%+ test coverage required for contract code

#### Known Contract Considerations

| Contract | Consideration |
|----------|---------------|
| GroToken | Owner-only minting - ensure key security |
| FoodUSD | 1:1 peg assumption - monitor oracle if used |
| GroupPurchase | Minimum participants required (5) |
| GroVault | Lock duration enforcement - time-based |
| CoopGovernor | Quadratic voting cost model |

---

## Security Features

### API Security

- **CORS enabled** - Cross-origin resource sharing configured
- **Input validation** - Parameter validation on all endpoints
- **Rate limiting** - Recommended for production deployment
- **Request size limits** - Recommended for production

### Authentication (Recommended)

For production deployments, implement:

1. **API key authentication** for service-to-service calls
2. **JWT tokens** for user sessions
3. **OAuth 2.0** for external integrations

### Logging & Monitoring

Security-relevant events to log:

- Authentication failures
- Authorization denials
- Input validation failures
- Unusual request patterns
- Error rates and types

---

## Vulnerability Disclosure

### Scope

In scope for security reports:

- PMOVES-ToKenism-Multi repository code
- Smart contract vulnerabilities
- API endpoint security
- Authentication/authorization issues
- Data exposure risks

Out of scope:

- Third-party dependencies (report to maintainers)
- Firefly-iii vulnerabilities (report upstream)
- PMOVES.AI infrastructure (report to main repo)

### Recognition

We appreciate security researchers who:

- Report vulnerabilities responsibly
- Allow reasonable time for fixes
- Do not exploit vulnerabilities

Contributors who report valid vulnerabilities will be acknowledged in release notes (unless anonymity is preferred).

---

## Compliance

### Data Handling

- **No PII storage** by default
- **Financial data** handled according to simulation parameters
- **Logs** should not contain sensitive information

### Audit Trail

For production deployments:

1. Enable request logging
2. Track simulation parameters
3. Log administrative actions
4. Retain logs per compliance requirements

---

## Contact

For security-related questions or to report vulnerabilities:

- Review this policy first
- Check existing security advisories
- Contact maintainers privately for new issues

---

Last updated: December 2025
