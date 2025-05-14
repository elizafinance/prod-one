import { connectToDatabase } from '../src/lib/mongodb';
async function main() {
    const { db, client } = await connectToDatabase();
    console.log('Creating unique indexes...');
    await Promise.all([
        db.collection('users').createIndex({ walletAddress: 1 }, { unique: true, sparse: true }),
        db.collection('users').createIndex({ referralCode: 1 }, { unique: true, sparse: true }),
        db.collection('squads').createIndex({ squadId: 1 }, { unique: true }),
    ]);
    console.log('Indexes created successfully');
    await client.close();
}
main().catch(err => {
    console.error('Failed to create indexes', err);
    process.exit(1);
});
