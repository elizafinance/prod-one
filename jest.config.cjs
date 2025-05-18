const nextJest = require('next/jest');

// Providing the path to your Next.js app to load next.config.js and .env files in your test environment
const createJestConfig = nextJest({
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // jest.setup.js can remain .js if it doesn't cause issues, or make it .cjs too
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/models/(.*)$': '<rootDir>/src/models/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/scripts/(.*)$': '<rootDir>/src/scripts/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1', // Common directory
    '^@/styles/(.*)$': '<rootDir>/src/styles/$1', // Common directory
    '^@/public/(.*)$': '<rootDir>/public/$1', // For assets if imported
    // If you have a very generic @/* setup, ensure it comes last or is specific enough
    // For example, if all else fails for @/*, try to map it to src/*
    // '^@/(.*)$': '<rootDir>/src/$1', // General fallback - use with caution if specific maps above exist
  },
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!uuid|jayson|@solana/web3.js|@project-serum/anchor|@solana/wallet-adapter-base|@solana/wallet-adapter-react|another-esm-module-to-transform)',
    '\\.pnp\\.[^\\/\\\\]+$',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/cypress/',
  ],
  clearMocks: true, // Good practice to clear mocks between tests
};

module.exports = createJestConfig(customJestConfig); 