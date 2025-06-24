/**
 * Backfill script to populate initialAirdropAmount and totalEstimatedAirdrop
 * for all existing users based on the airdrop snapshot data.
 * 
 * Usage: yarn build:scripts && node dist-scripts/scripts/backfillAirdropData.js
 * or: npx ts-node --project tsconfig.json -r tsconfig-paths/register scripts/backfillAirdropData.ts
 */

import { connectToDatabase, UserDocument } from '../src/lib/mongodb';
import airdropDataList from '../src/data/airdropData.json';
import { Db } from 'mongodb';

interface AirdropGsheetEntry {
  Account: string;
  "Token Account": string;
  Quantity: number | string;
  AIRDROP: number;
}

const typedAirdropData = airdropDataList as AirdropGsheetEntry[];

// Create a map for faster lookup
const airdropMap = new Map<string, number>();
typedAirdropData.forEach(entry => {
  airdropMap.set(entry.Account, entry.AIRDROP);
});

async function backfillAirdropData() {
  console.log('🚀 Starting airdrop data backfill...');
  
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    
    // Get total count of users
    const totalUsers = await usersCollection.countDocuments();
    console.log(`📊 Total users to process: ${totalUsers}`);
    
    // Process users in batches
    const batchSize = 100;
    let processedCount = 0;
    let updatedCount = 0;
    let cursor = usersCollection.find({});
    
    while (await cursor.hasNext()) {
      const batch: UserDocument[] = [];
      
      // Collect a batch of users
      for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
        const user = await cursor.next();
        if (user) batch.push(user);
      }
      
      // Process the batch
      const bulkOps: any[] = [];
      
      for (const user of batch) {
        if (!user.walletAddress) continue;
        
        const airdropAmount = airdropMap.get(user.walletAddress) || 0;
        const currentPoints = user.points || 0;
        const totalEstimatedAirdrop = airdropAmount + currentPoints;
        
        // Only update if data is missing or incorrect
        if (user.initialAirdropAmount !== airdropAmount || 
            user.totalEstimatedAirdrop !== totalEstimatedAirdrop) {
          bulkOps.push({
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  initialAirdropAmount: airdropAmount,
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
        console.log(`✅ Processed ${processedCount}/${totalUsers} users (${Math.round(processedCount/totalUsers * 100)}%)`);
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
      console.log(`   Initial Airdrop: ${sample.initialAirdropAmount || 0}`);
      console.log(`   Current Points: ${sample.points || 0}`);
      console.log(`   Total Estimated: ${sample.totalEstimatedAirdrop || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the backfill
backfillAirdropData().catch(console.error); 