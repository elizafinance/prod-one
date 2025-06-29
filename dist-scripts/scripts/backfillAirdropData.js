/**
 * Backfill script to populate initialAirdropAmount, airBasedDefai, and totalEstimatedAirdrop
 * for all existing users based on the airdrop snapshot data and current points distribution.
 *
 * Usage: yarn build:scripts && node dist-scripts/scripts/backfillAirdropData.js
 * or: npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/backfillAirdropData.ts
 */
import { connectToDatabase } from '../lib/mongodb.js';
import airdropDataList from '../data/airdropData.json' with { type: 'json' };
const typedAirdropData = airdropDataList;
// Create a map for faster lookup
const airdropMap = new Map();
typedAirdropData.forEach(entry => {
    airdropMap.set(entry.Account, entry.AIRDROP);
});
// Get airdrop pool size from environment
const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);
async function backfillAirdropData() {
    var _a;
    console.log('🚀 Starting airdrop data backfill...');
    console.log(`📊 Airdrop pool size: ${airdropPoolSize.toLocaleString()}`);
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        // Get total count of users
        const totalUsers = await usersCollection.countDocuments();
        console.log(`📊 Total users to process: ${totalUsers}`);
        // Calculate total community points
        const totalCommunityPointsResult = await usersCollection.aggregate([
            { $group: { _id: null, total: { $sum: "$points" } } }
        ]).toArray();
        const totalCommunityPoints = ((_a = totalCommunityPointsResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        console.log(`💰 Total community points: ${totalCommunityPoints.toLocaleString()}`);
        // Process users in batches
        const batchSize = 100;
        let processedCount = 0;
        let updatedCount = 0;
        let cursor = usersCollection.find({});
        while (await cursor.hasNext()) {
            const batch = [];
            // Collect a batch of users
            for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
                const user = await cursor.next();
                if (user)
                    batch.push(user);
            }
            // Process the batch
            const bulkOps = [];
            for (const user of batch) {
                if (!user.walletAddress)
                    continue;
                const airdropAmount = airdropMap.get(user.walletAddress) || 0;
                const currentPoints = user.points || 0;
                // Calculate airBasedDefai
                let airBasedDefai = 0;
                if (totalCommunityPoints > 0 && currentPoints > 0) {
                    airBasedDefai = (currentPoints / totalCommunityPoints) * airdropPoolSize;
                }
                // Calculate total estimated airdrop
                const totalEstimatedAirdrop = airdropAmount + airBasedDefai;
                // Update if data is missing or has changed
                const needsUpdate = user.initialAirdropAmount !== airdropAmount ||
                    user.airBasedDefai !== airBasedDefai ||
                    user.totalEstimatedAirdrop !== totalEstimatedAirdrop;
                if (needsUpdate) {
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: user._id },
                            update: {
                                $set: {
                                    initialAirdropAmount: airdropAmount,
                                    airBasedDefai: airBasedDefai,
                                    totalEstimatedAirdrop: totalEstimatedAirdrop,
                                    updatedAt: new Date()
                                }
                            }
                        }
                    });
                    updatedCount++;
                }
            }
            // Execute bulk update if there are operations
            if (bulkOps.length > 0) {
                await usersCollection.bulkWrite(bulkOps);
            }
            processedCount += batch.length;
            // Progress update
            if (processedCount % 1000 === 0) {
                console.log(`✅ Processed ${processedCount}/${totalUsers} users (${Math.round(processedCount / totalUsers * 100)}%)`);
            }
        }
        console.log('\n📈 Backfill complete!');
        console.log(`   Total users processed: ${processedCount}`);
        console.log(`   Users updated: ${updatedCount}`);
        console.log(`   Users skipped (already had correct data): ${processedCount - updatedCount}`);
        // Verify a few samples
        console.log('\n🔍 Verifying random samples...');
        const samples = await usersCollection
            .aggregate([
            { $match: { walletAddress: { $exists: true } } },
            { $sample: { size: 5 } }
        ])
            .toArray();
        for (const sample of samples) {
            console.log(`\n   Wallet: ${sample.walletAddress}`);
            console.log(`   Initial Airdrop: ${(sample.initialAirdropAmount || 0).toLocaleString()}`);
            console.log(`   Current Points: ${(sample.points || 0).toLocaleString()}`);
            console.log(`   AIR-Based DeFAI: ${(sample.airBasedDefai || 0).toLocaleString()}`);
            console.log(`   Total Estimated: ${(sample.totalEstimatedAirdrop || 0).toLocaleString()}`);
        }
    }
    catch (error) {
        console.error('❌ Error during backfill:', error);
        process.exit(1);
    }
    process.exit(0);
}
// Run the backfill
backfillAirdropData().catch(console.error);
