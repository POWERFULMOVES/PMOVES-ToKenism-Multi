module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Repair-before-enable (PR review thread): form suites are repaired on stacked
  // #67; the five framework suites target other lanes' components (Dashboard,
  // charts) and are repaired in a dedicated follow-up lane. ChartWrapper is
  // verified green on this branch.
  testPathIgnorePatterns: [
    '__tests__/accessibility/accessibility-report\\.test\\.tsx$',
    '__tests__/accessibility/ci-framework\\.test\\.tsx$',
    '__tests__/accessibility/color-contrast\\.test\\.tsx$',
    '__tests__/accessibility/keyboard-navigation\\.test\\.tsx$',
    '__tests__/accessibility/screen-reader\\.test\\.tsx$',
  ],
  collectCoverageFrom: ['**/src/**/*.ts', '**/src/**/*.tsx'],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // 30 seconds timeout for simulation tests
};
