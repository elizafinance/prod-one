// __tests__/jest.globalSetup.js 
// Using require for this setup file as it runs directly by Jest node environment before transformations might fully apply to it as ESM module.
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');

const globalSetup = async () => {
  const instance = await MongoMemoryServer.create();
  const uri = instance.getUri();
  
  // Store the server instance and URI globally so we can stop it in teardown
  global.__MONGOINSTANCE = instance;
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = 'testdb'; // Or some other test DB name

  // Optional: Write to a temp env file if needed by other parts or if process.env is tricky
  // const tempEnvPath = path.join(__dirname, '.env.test.generated');
  // fs.writeFileSync(tempEnvPath, `MONGODB_URI=${uri}\nMONGODB_DB_NAME=testdb\n`);
  // console.log(`MongoDB Memory Server started at ${uri}, details in ${tempEnvPath}`);
  console.log(`MongoDB Memory Server started for Jest at ${uri}`);
};

module.exports = globalSetup; 