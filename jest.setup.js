// Polyfill TextEncoder/TextDecoder if needed by node
import { TextEncoder, TextDecoder } from 'util';

// Polyfill Web Fetch API globals for Node.js environment in Jest
const nodeFetch = require('node-fetch');
global.fetch = nodeFetch;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;
global.Headers = nodeFetch.Headers;
// ReadableStream might be needed for some advanced Request/Response body handling
// If you encounter errors related to ReadableStream, you might need a more specific polyfill or to mock its usage.
// For now, we assume node-fetch's provision is sufficient or that specific stream usages are mocked in tests.

// Polyfill performance API needed by Next.js server code in tests
global.performance = {
  getEntriesByName: jest.fn(() => []),
  mark: jest.fn(),
  measure: jest.fn(),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
  now: jest.fn(() => Date.now()),
};

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}
if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

// Default mock for getServerSession (can be overridden per-test with jest.mocked)
// This will be the default for all tests unless a specific test suite mocks it differently.
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(() => Promise.resolve(null)), // Default to no session
})); 

// Remove or comment out old Auth0 mocks
// jest.mock('@auth0/nextjs-auth0', () => ({ ... }));
// jest.mock('@auth0/nextjs-auth0/client', () => ({ ... })); 

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock next-auth useSession hook
// This is a common requirement for components that use session data.
// Adjust the mock implementation based on what your components expect.
jest.mock('next-auth/react', () => ({
  ...jest.requireActual('next-auth/react'), // Import and retain default behavior
  useSession: jest.fn(() => ({
    data: {
      user: {
        name: 'Test User',
        email: 'test@example.com',
        image: '',
        walletAddress: 'TEST_WALLET_ADDRESS', // Mock wallet address
        // Add any other user properties your components might use from the session
      },
      expires: new Date(Date.now() + 2 * 86400 * 1000).toISOString(), // Mock an expiry date
    },
    status: 'authenticated', // or 'loading', 'unauthenticated' as needed for different test cases
  })),
}));

// Mock environment variables if your components rely on them directly
// For example, if MyAirPanel or its children directly access process.env
// process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT = 'https://api.devnet.solana.com';
// process.env.NEXT_PUBLIC_HYBRID_COLLECTION_MINT_PDA = 'YOUR_TEST_COLLECTION_PDA';

// You can add other global mocks here, e.g.:
// jest.mock('next/router', () => require('next-router-mock'));
// jest.mock('next/navigation', () => require('next-router-mock')); // For app router

// If you use fetch in your components (like MyAirPanel does), Jest tests run in Node,
// so you might need a polyfill for fetch if not already provided by your Jest environment (jsdom usually provides it).
// However, for API calls, it's better to mock them at the component test level, as shown in the MyAirPanel test example.

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
}); 