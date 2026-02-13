module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/src/**/*.ts', '**/src/**/*.tsx'],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'lcov', 'text', 'html'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // 30 seconds timeout for simulation tests
};
