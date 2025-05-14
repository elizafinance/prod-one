import 'dotenv/config'; // Load .env variables
import { connectToDatabase } from '../src/lib/mongodb.js';
async function main() {
    const { db, client } = await connectToDatabase();
    // 1. Rename old collection if exists
    const collections = await db.listCollections().toArray();
    const hasOld = collections.some(c => c.name === 'squad_invitations');
    if (hasOld) {
        console.log('Renaming collection squad_invitations -> squadInvitations');
        try {
            await db.collection('squad_invitations').rename('squadInvitations');
            console.log('Rename successful.');
        }
        catch (e) {
            if (e.codeName === 'NamespaceExists') {
                console.log('Target collection squadInvitations already exists. Skipping rename.');
            }
            else {
                throw e; // Re-throw other errors
            }
        }
    }
    // 2. Backfill missing X usernames in join requests
    const bulk = db.collection('squadjoinrequests').initializeUnorderedBulkOp();
    const cursor = db.collection('squadjoinrequests').find({ $or: [{ requestingUserXUsername: { $exists: false } }, { requestingUserXUsername: '' }] });
    let count = 0;
    for await (const doc of cursor) {
        const wallet = doc.requestingUserWalletAddress;
        const fallback = wallet ? wallet.slice(0, 6) : 'user';
        bulk.find({ _id: doc._id }).updateOne({ $set: { requestingUserXUsername: fallback } });
        count++;
    }
    if (count) {
        await bulk.execute();
        console.log('Backfilled usernames for', count, 'join requests');
    }
    // 3. Ensure index for quick leader dashboard
    await db.collection('squadjoinrequests').createIndex({ squadId: 1, status: 1 });
    console.log('Migration complete');
    await client.close();
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
