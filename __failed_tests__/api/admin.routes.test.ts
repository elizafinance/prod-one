// __tests__/api/admin.routes.test.ts
import request from 'supertest';
import { createServer, Server } from 'node:http';
import next from 'next';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { NextApiHandler } from 'next';

// Mock next-auth before all other imports that might use it
const mockAdminSession = { user: { role: 'admin', walletAddress: 'ADMIN_TEST_WALLET', id: 'admin_test_id' } };
const mockUserSession = { user: { role: 'user', walletAddress: 'USER_TEST_WALLET', id: 'user_test_id' } };

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(() => Promise.resolve(null)), // Default to no session
}));

import { getServerSession } from 'next-auth/next';
const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

let app: any;
let serverInstance: Server;
let apiUrl: string;
let mongoServer: MongoMemoryServer;
let mongoClient: MongoClient;
let db: Db;

const MONGODB_DB_NAME_TEST = 'testAdminDB';

async function seedData() {
  await db.collection('users').insertMany([
    { walletAddress: 'ADMIN_TEST_WALLET', xUsername: 'AdminUser', role: 'admin', points: 1000, squadId: 'squadAdmin' },
    { walletAddress: 'USER_TEST_WALLET', xUsername: 'NormalUser', role: 'user', points: 100, squadId: 'squad1' },
    { walletAddress: 'USER_NO_SQUAD', xUsername: 'NoSquadUser', role: 'user', points: 50, squadId: null },
  ]);
  await db.collection('adminAuditLogs').insertMany([
    { timestamp: new Date(Date.now() - 86400000), adminUserId: 'ADMIN_TEST_WALLET', action: 'test_action_1', targetEntityType: 'user', targetEntityId: 'USER_TEST_WALLET', changes: { points: 10 }, reason: 'Test reason 1' },
    { timestamp: new Date(), adminUserId: 'OTHER_ADMIN', action: 'test_action_2', targetEntityType: 'squad', targetEntityId: 'squad1', changes: { name: 'new name' } },
  ]);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.MONGODB_DB_NAME = MONGODB_DB_NAME_TEST;

  // Simplified Next.js initialization for App Router
  app = next({ dev: false, dir: '.' });
  await app.prepare();
  const requestHandler = app.getRequestHandler();
  serverInstance = createServer((req, res) => requestHandler(req, res as any));
  
  await new Promise<void>((resolve) => serverInstance.listen(0, 'localhost', () => resolve()));
  const port = (serverInstance.address() as any).port;
  apiUrl = `http://localhost:${port}`;

  mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(process.env.MONGODB_DB_NAME);

  await seedData();
}, 60000);

afterAll(async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (serverInstance) {
    await new Promise<void>(resolve => serverInstance.close(() => resolve()));
  }
  if (app) {
    await app.close(); 
  }
});

beforeEach(async () => {
  // Reset session mock before each test
  mockedGetServerSession.mockResolvedValue(null);
  // Clear collections if needed, or handle data setup per test suite
  // For this example, we seed once. For more complex tests, clear and re-seed or use transactions.
});

describe('Admin API Routes - Authentication', () => {
  const routesToTest = [
    { method: 'get', path: '/api/admin/users' },
    { method: 'get', path: '/api/admin/users/USER_TEST_WALLET' },
    { method: 'patch', path: '/api/admin/users/USER_TEST_WALLET' },
    { method: 'delete', path: '/api/admin/users?wallet=USER_TEST_WALLET' },
    { method: 'get', path: '/api/admin/audit-logs' },
  ];

  routesToTest.forEach(route => {
    it(`(${route.method.toUpperCase()}) ${route.path} should return 403 if not authenticated`, async () => {
      const res = await (request(apiUrl) as any)[route.method](route.path);
      expect(res.status).toBe(403);
    });

    it(`(${route.method.toUpperCase()}) ${route.path} should return 403 if authenticated as non-admin`, async () => {
      mockedGetServerSession.mockResolvedValue(mockUserSession as any);
      const res = await (request(apiUrl) as any)[route.method](route.path);
      expect(res.status).toBe(403);
    });
  });
});

describe('GET /api/admin/users', () => {
  beforeEach(() => mockedGetServerSession.mockResolvedValue(mockAdminSession as any));

  it('should return a list of users for admin', async () => {
    const res = await request(apiUrl).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(3);
  });

  it('should filter users by role', async () => {
    const res = await request(apiUrl).get('/api/admin/users?role=admin');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].walletAddress).toBe('ADMIN_TEST_WALLET');
  });

  it('should filter users by squadId', async () => {
    const res = await request(apiUrl).get('/api/admin/users?squadId=squad1');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].walletAddress).toBe('USER_TEST_WALLET');
  });

  it('should filter users with hasSquad=true', async () => {
    const res = await request(apiUrl).get('/api/admin/users?hasSquad=true');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(2);
  });

  it('should filter users with hasSquad=false', async () => {
    const res = await request(apiUrl).get('/api/admin/users?hasSquad=false');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].walletAddress).toBe('USER_NO_SQUAD');
  });

   it('should filter by text search (username)', async () => {
    const res = await request(apiUrl).get('/api/admin/users?q=NormalUser');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].xUsername).toBe('NormalUser');
  });
});

describe('GET /api/admin/users/[walletAddress]', () => {
  beforeEach(() => mockedGetServerSession.mockResolvedValue(mockAdminSession as any));

  it('should return user details for admin', async () => {
    const res = await request(apiUrl).get('/api/admin/users/USER_TEST_WALLET');
    expect(res.status).toBe(200);
    expect(res.body.user.walletAddress).toBe('USER_TEST_WALLET');
    expect(res.body.recentActions).toBeDefined();
    expect(res.body.recentNotifications).toBeDefined();
  });

  it('should return 404 if user not found', async () => {
    const res = await request(apiUrl).get('/api/admin/users/NON_EXISTENT_WALLET');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/users/[walletAddress]', () => {
  beforeEach(() => mockedGetServerSession.mockResolvedValue(mockAdminSession as any));

  it('should update user points and role', async () => {
    const res = await request(apiUrl)
      .patch('/api/admin/users/USER_TEST_WALLET')
      .send({ points: 150, role: 'admin', reason: 'Test promotion and points update' });
    expect(res.status).toBe(200);
    expect(res.body.user.points).toBe(150);
    expect(res.body.user.role).toBe('admin');

    // Verify audit log
    const auditLog = await db.collection('adminAuditLogs').findOne({ targetEntityId: 'USER_TEST_WALLET', action: 'update_user_details' });
    expect(auditLog).toBeTruthy();
    expect(auditLog?.changes.points.new).toBe(150);
    expect(auditLog?.changes.role.new).toBe('admin');
    expect(auditLog?.reason).toBe('Test promotion and points update');
  });

  it('should require reason if updating points', async () => {
    const res = await request(apiUrl)
      .patch('/api/admin/users/USER_TEST_WALLET')
      .send({ points: 200 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reason is required');
  });
});

describe('DELETE /api/admin/users', () => {
  beforeEach(() => mockedGetServerSession.mockResolvedValue(mockAdminSession as any));

  it('should purge a user', async () => {
    // Create a user to be purged specifically for this test to avoid impacting others
    const tempWallet = 'PURGE_ME_USER';
    await db.collection('users').insertOne({ walletAddress: tempWallet, role: 'user', points: 10 });
    
    const res = await request(apiUrl).delete(`/api/admin/users?wallet=${tempWallet}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User purged');
    expect(res.body.stats.userDel).toBe(1);

    const deletedUser = await db.collection('users').findOne({ walletAddress: tempWallet });
    expect(deletedUser).toBeNull();
  });
});

describe('GET /api/admin/audit-logs', () => {
  beforeEach(() => mockedGetServerSession.mockResolvedValue(mockAdminSession as any));

  it('should return a list of audit logs', async () => {
    const res = await request(apiUrl).get('/api/admin/audit-logs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(2); // Seeded + PATCH test log
  });

  it('should filter audit logs by adminUserId', async () => {
    const res = await request(apiUrl).get('/api/admin/audit-logs?adminUserId=ADMIN_TEST_WALLET');
    expect(res.status).toBe(200);
    res.body.logs.forEach((log: any) => {
      expect(log.adminUserId).toBe('ADMIN_TEST_WALLET');
    });
  });

   it('should filter audit logs by action', async () => {
    const res = await request(apiUrl).get('/api/admin/audit-logs?action=test_action_1');
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(1);
    expect(res.body.logs[0].action).toBe('test_action_1');
  });

  // Add more tests for other filters: targetEntityType, targetEntityId, dateRange
}); 