# PMOVES ToKenism Integrations Makefile
# Run simulations, tests, and exports

.PHONY: all test build clean sim export help

# Default target
all: test

# Show help
help:
	@echo "PMOVES ToKenism Integration Commands"
	@echo "===================================="
	@echo ""
	@echo "Testing:"
	@echo "  make test          - Run all tests"
	@echo "  make test-watch    - Run tests in watch mode"
	@echo "  make test-coverage - Run tests with coverage"
	@echo ""
	@echo "Simulation:"
	@echo "  make sim           - Run contract simulation"
	@echo "  make sim-verbose   - Run simulation with verbose output"
	@echo ""
	@echo "Export:"
	@echo "  make export-dry    - Dry run export to Firefly"
	@echo "  make export        - Export to Firefly (requires FIREFLY_API_TOKEN)"
	@echo "  make export-nats   - Export with NATS event publishing"
	@echo ""
	@echo "Build:"
	@echo "  make build         - Compile TypeScript"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make lint          - Run ESLint"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Start Next.js dev server"
	@echo "  make typecheck     - Run TypeScript type checking"

# Testing
test:
	npm test

test-watch:
	npm test -- --watch

test-coverage:
	npm test -- --coverage

# Simulation
sim:
	npx ts-node contracts/example-contract-simulation.ts

sim-verbose:
	DEBUG=* npx ts-node contracts/example-contract-simulation.ts

# Export to Firefly-iii (PMOVES-Wealth)
export-dry:
	npx ts-node firefly/export_sim_to_firefly.ts --dry-run

export:
	@if [ -z "$$FIREFLY_API_TOKEN" ]; then \
		echo "Error: FIREFLY_API_TOKEN is not set"; \
		echo "Set it with: export FIREFLY_API_TOKEN=your-token"; \
		exit 1; \
	fi
	npx ts-node firefly/export_sim_to_firefly.ts

export-nats:
	npx ts-node firefly/export_sim_to_firefly.ts --nats

# Build
build:
	npx tsc

clean:
	rm -rf dist/
	rm -rf coverage/

lint:
	npx eslint . --ext .ts,.tsx

# Development
dev:
	cd ../pmoves-nextjs && npm run dev

typecheck:
	npx tsc --noEmit

# Analysis workflows
analysis-full: test sim export-dry
	@echo "Full analysis workflow complete"

# CI checks
ci: lint typecheck test
	@echo "CI checks passed"
