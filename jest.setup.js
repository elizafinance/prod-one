// Polyfill TextEncoder/TextDecoder if needed by node
import { TextEncoder, TextDecoder } from 'util';

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