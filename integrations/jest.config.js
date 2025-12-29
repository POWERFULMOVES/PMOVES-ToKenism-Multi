module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.+(ts|tsx)", "**/?(*.)+(spec|test).+(ts|tsx)"],
  testPathIgnorePatterns: ["/node_modules/", "/PMOVES-DoX/", "nats-client.spec.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
};
