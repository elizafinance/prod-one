import { authorize } from '../auth';

const usersCollectionMock = {
    findOne: jest.fn(),
    insertOne: jest.fn().mockResolvedValue({
        _id: { toHexString: () => 'mock-id-123' },
        insertedId: 'mock-id-123',
    }),
    updateOne: jest.fn(),
};

jest.mock('@/lib/mongodb', () => ({
    connectToDatabase: jest.fn().mockResolvedValue({
        db: {
            collection: jest.fn().mockImplementation(() => usersCollectionMock),
        },
    }),
    UserDocument: jest.fn(),
}));

const req = {};

describe('Authorize function', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        // Ensure env vars exist so it doesn't skip the block
        process.env.MONGODB_URI = 'mock-uri'
        process.env.MONGODB_DB_NAME = 'mock-db';
    });

    it('should return null if walletAddress is missing', async () => {
        const credentials = { walletAddress: '0xabc123', chain: 'eth' };
        const result = await authorize(credentials, req);
        expect(result).toBeNull();
    });


    it('creates a new user if wallet not found in DB', async () => {
        const fakeUserId = { toHexString: () => 'mock-db-id' };
        usersCollectionMock.findOne.mockResolvedValueOnce(null);
        usersCollectionMock.insertOne.mockResolvedValueOnce({
            _id: fakeUserId,
            insertedId: fakeUserId,
            walletAddress: '0xabc123',
            chain: 'ethereum',
            role: 'user',
        });

        const user = await authorize({ walletAddress: '0xabc123', chain: 'ethereum' }, {} as any);
        expect(usersCollectionMock.insertOne).toHaveBeenCalled();
        expect(user.walletAddress).toBe('0xabc123');
        expect(user.chain).toBe('ethereum');
        expect(user.role).toBe('user');
    });


    it('should return existing user and update login info', async () => {
        usersCollectionMock.findOne.mockResolvedValue({
            _id: { toHexString: () => '0xabc' },
            walletAddress: '0xabc',
            xUserId: '0xabc',
            walletChain: 'eth',
            role: 'user',
        });

        const credentials = { walletAddress: '0xabc', chain: 'eth' };
        const result = await authorize(credentials, req);

        expect(usersCollectionMock.updateOne).toHaveBeenCalled();
        expect(result).toMatchObject({
            id: '0xabc',
            walletAddress: '0xabc',
            chain: 'eth',
        });
    });


    it('returns user object for existing user', async () => {
        const fakeUser = {
            _id: { toHexString: () => '0xabc' },
            walletAddress: '0xabc',
            xUserId: '0xabc',
            role: 'user',
            walletChain: 'eth',
        };
        usersCollectionMock.findOne.mockResolvedValue(fakeUser);
        usersCollectionMock.updateOne.mockResolvedValue({});

        const input = { walletAddress: '0xabc', chain: 'eth' };
        const result = await authorize(input,{});
        expect(result).toMatchObject({
            id: '0xabc',
            dbId: '0xabc',
            walletAddress: '0xabc',
            xId: '0xabc',
            role: 'user',
            chain: 'eth',
        });
        expect(usersCollectionMock.findOne).toHaveBeenCalledWith({ walletAddress: '0xabc' } );
        expect(usersCollectionMock.updateOne).toHaveBeenCalled();
    });

    it('returns null if walletAddress is missing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); 
        const result = await authorize({ chain: 'eth' },{});
        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error in authorize:'),
            expect.any(Error)
          );
    });

    it('trims walletAddress', async () => {
        const fakeUser = {
            _id: { toHexString: () => 'abc123' },
            walletAddress: '0xabc',
            xUserId: '0xabc',
            role: 'user',
            walletChain: 'eth',
        };
        usersCollectionMock.findOne.mockResolvedValue(fakeUser);
        usersCollectionMock.updateOne.mockResolvedValue({});
        const result = await authorize({ walletAddress: '   0xabc   ', chain: 'eth' },{});
        expect(result.walletAddress).toBe('0xabc');
    });
});
