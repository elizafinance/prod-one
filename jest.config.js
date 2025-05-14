/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Default for backend tests, can be overridden or set to jsdom for frontend
  roots: [
    '<rootDir>/src',
    '<rootDir>/__tests__' // Or wherever you plan to put test files
  ],
  moduleNameMapper: {
    // Handle module aliases (this will be important for Next.js projects)
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock CSS/image imports if testing frontend components that import them
    '\\.(css|less|scss|sass)$_': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$_': '<rootDir>/__mocks__/fileMock.js',
  },
  transform: {
    // Use babel-jest to transpile tests with the next/babel preset
    // https://jestjs.io/docs/configuration#transform-objectstring-pathtotransformer--pathtotransformer-object
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }], // Use a separate tsconfig for tests if needed
    '^.+\\.jsx?$': 'babel-jest',
  },
  setupFilesAfterEnv: [
    // '<rootDir>/jest.setup.js' // For global test setup, like Jest DOM matchers
  ],
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/_app.{ts,tsx}', // Exclude Next.js specific files if not testing them directly
    '!src/**/_document.{ts,tsx}',
    '!src/pages/api/**', // Often API routes are tested via integration/e2e rather than unit
    '!src/scripts/cron/**' // Cron scripts might be tested differently or need specific setup
  ],
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",
  testPathIgnorePatterns: [
    "<rootDir>/.next/", 
    "<rootDir>/node_modules/",
    "<rootDir>/build/",
    "<rootDir>/dist/"
  ],
}; 