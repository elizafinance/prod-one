/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm', // Use ESM preset for ts-jest
  testEnvironment: 'node',
  globalSetup: '<rootDir>/__tests__/jest.globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/jest.globalTeardown.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock for CSS/SCSS modules if tests import components that use them
    '\\.(css|less|scss|sass)$ ': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$ ': '<rootDir>/__mocks__/fileMock.js',
  },
  transform: {
    // Ensure ts-jest processes .js, .jsx, .ts, .tsx files as ESM
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        // tsconfig: 'tsconfig.jest.json', // Optional: if you have a separate tsconfig for jest
      },
    ],
  },
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.[tj]s?(x)',
    // '**/?(*.)+(spec|test).[tj]s?(x)' // Default jest pattern
  ],
  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: [
    // Allow transformation for specific problematic ESM modules in node_modules
    '/node_modules/(?!uuid|jayson|@project-serum/anchor|@solana/wallet-adapter-base|@solana/wallet-adapter-react|@solana/web3.js)',
    '\\.pnp\\.[^/\]+$',
  ],
  testPathIgnorePatterns: [
    "<rootDir>/.next/", 
    "<rootDir>/node_modules/",
    "<rootDir>/build/",
    "<rootDir>/dist/"
  ],
  // Necessary for ESM support if you are not using `type: "module"` in package.json
  // extensionsToTreatAsEsm: ['.ts', '.tsx'], // Already using type:module, so this might not be strictly needed but good for clarity
  // Fix for `ReferenceError: TextEncoder is not defined` if it occurs
  // globals: {
  //   TextEncoder: require('util').TextEncoder,
  //   TextDecoder: require('util').TextDecoder,
  // },
  // collectCoverage: true, // Uncomment to enable coverage collection
  // coverageDirectory: "coverage", // Output directory for coverage reports
  // coverageProvider: "v8", // or "babel"
  // coverageReporters: ["json", "text", "lcov", "clover"], // Coverage report formats
  testTimeout: 30000,
}; 