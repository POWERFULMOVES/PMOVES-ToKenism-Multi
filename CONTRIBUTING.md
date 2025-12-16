# Contributing to PMOVES Token Economy Simulator

Thank you for your interest in contributing to PMOVES-ToKenism-Multi! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Commit Message Conventions](#commit-message-conventions)

---

## Code of Conduct

This project adheres to the PMOVES.AI community standards. Please be respectful and constructive in all interactions.

---

## Getting Started

### Prerequisites

- **Node.js 18+** (for TypeScript integrations)
- **Python 3.11+** (for Flask backend)
- **Docker** (for containerized development)

### Local Setup

```bash
# Clone the repository
git clone https://github.com/POWERFULMOVES/PMOVES-ToKenism-Multi.git
cd PMOVES-ToKenism-Multi

# Install TypeScript dependencies
cd integrations
npm install

# Install Python dependencies
cd ..
pip install -r requirements.txt

# Run tests
npm test              # TypeScript tests
pytest tests/         # Python tests
```

---

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation updates
- `refactor/<description>` - Code refactoring
- `test/<description>` - Test additions/updates

### Example

```bash
git checkout -b feature/nats-integration
git checkout -b fix/duplicate-flask-app
git checkout -b docs/api-reference-update
```

---

## Code Standards

### TypeScript (integrations/)

- **Strict mode enabled** - All types must be explicit
- **ESLint + Prettier** - Run `npm run lint` before committing
- **100% type coverage** - No `any` types without justification

```typescript
// Good
function calculateMetrics(members: SimMember[]): MetricResult {
  return { gini: 0.45, poverty: 0.1 };
}

// Bad - avoid 'any'
function calculateMetrics(members: any[]): any {
  return { gini: 0.45, poverty: 0.1 };
}
```

### Python (Flask backend)

- **Type hints required** - Use `typing` module
- **Docstrings required** - All public functions need docstrings
- **Black + isort** - Run formatters before committing

```python
# Good
def run_simulation(params: Dict[str, float]) -> SimulationResult:
    """Run economic simulation with given parameters.

    Args:
        params: Dictionary of simulation parameters

    Returns:
        SimulationResult containing history and metrics
    """
    pass

# Bad - missing types and docstring
def run_simulation(params):
    pass
```

### Solidity (contracts/)

- **Solidity ^0.8.24** - Use latest stable features
- **OpenZeppelin** - Prefer OZ implementations for standards
- **NatSpec comments** - Document all public functions

---

## Testing Requirements

### Minimum Coverage

- **TypeScript**: 90% line coverage
- **Python**: 80% line coverage
- **Solidity**: 95% line coverage (critical financial logic)

### Running Tests

```bash
# TypeScript
cd integrations
npm test
npm run test:coverage

# Python
pytest tests/ -v
pytest tests/ --cov=pmoves_backend

# Solidity
cd contracts/solidity
npx hardhat test
```

### Required Test Types

1. **Unit tests** - Individual function testing
2. **Integration tests** - Cross-module interactions
3. **Smoke tests** - Basic health checks

---

## Pull Request Process

### Before Submitting

1. **Run all tests** - Ensure tests pass locally
2. **Update documentation** - If adding features
3. **Add changelog entry** - For user-facing changes
4. **Self-review** - Check your own code first

### PR Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. **Automated checks** - CI must pass
2. **Code review** - At least 1 approval required
3. **Documentation review** - For API changes
4. **Merge** - Squash and merge preferred

---

## Commit Message Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting changes
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance tasks

### Examples

```bash
feat(integrations): add NATS event bus client
fix(flask): remove duplicate app instantiation
docs(readme): add PMOVES.AI integration guide
test(contracts): add GroToken edge case tests
```

---

## PMOVES.AI Integration Guidelines

When adding features that integrate with PMOVES.AI:

### Required Endpoints

All services must expose:
- `/healthz` - Health check
- `/metrics` - Prometheus metrics (optional)
- `/readyz` - Readiness probe

### Event Bus

Publish events to NATS subjects:
- Follow naming: `<domain>.<entity>.<action>.v1`
- Include correlation IDs for tracing

### TensorZero

Route LLM calls through TensorZero gateway:
- Endpoint: `http://localhost:3030/v1/chat/completions`
- Include model selection in requests

---

## Questions?

- Open an issue for discussion
- Check existing documentation in `.claude/context/`
- Review PMOVES.AI architecture in main repo

---

Thank you for contributing!
