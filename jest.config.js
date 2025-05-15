/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm', // Use ESM preset for ts-jest
  testEnvironment: 'node',
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock for CSS/SCSS modules if tests import components that use them
    '\\.(css|less|scss|sass)$ ': 'identity-obj-proxy',
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
  // A list of paths to modules that run some code to configure or set up the testing framework before each test
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if you have a setup file
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    // '**/?(*.)+(spec|test).[tj]s?(x)' // Default jest pattern
  ],
  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  transformIgnorePatterns: [
    // Default: '/node_modules/'. Adjust if specific node_modules need transformation.
    // For now, keeping default. If error shifts to a node_module, revisit this.
    '/node_modules/',
    '\\.pnp\\.[^/\]+$',
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
}; 