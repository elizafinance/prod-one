// __tests__/jest.globalTeardown.js
// Using require for consistency with globalSetup
const globalTeardown = async () => {
  if (global.__MONGOINSTANCE) {
    await global.__MONGOINSTANCE.stop();
    console.log('MongoDB Memory Server stopped for Jest.');
  }
};

module.exports = globalTeardown; 