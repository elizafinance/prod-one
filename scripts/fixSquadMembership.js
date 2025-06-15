#!/usr/bin/env node

/**
 * Fix Squad Membership Data Consistency - ADMIN MAINTENANCE TOOL
 * 
 * This script identifies and fixes cases where:
 * 1. A user is listed in a squad's memberWalletAddresses array
 * 2. But the user's record doesn't have the squadId field set
 * 
 * NOTE: The main authentication issue has been fixed. This tool is kept for:
 * - Cleaning up any existing data inconsistencies in production
 * - Emergency debugging of edge cases
 * - One-time data migration scenarios
 * 
 * Usage: node scripts/fixSquadMembership.js [walletAddress]
 * 
 * IMPORTANT: Run with caution in production!
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db() };
}

async function fixSquadMembership(targetWalletAddress = null) {
  const { client, db } = await connectToDatabase();
  
  try {
    const usersCollection = db.collection('users');
    const squadsCollection = db.collection('squads');
    
    console.log('🔍 Scanning for squad membership inconsistencies...');
    
    // Get all squads
    const allSquads = await squadsCollection.find({}).toArray();
    console.log(`📊 Found ${allSquads.length} squads to check`);
    
    let fixedCount = 0;
    let issuesFound = 0;
    
    for (const squad of allSquads) {
      if (!squad.memberWalletAddresses || squad.memberWalletAddresses.length === 0) {
        continue;
      }
      
      // Check each member in the squad
      for (const memberWalletAddress of squad.memberWalletAddresses) {
        // Skip if we're targeting a specific wallet and this isn't it
        if (targetWalletAddress && memberWalletAddress !== targetWalletAddress) {
          continue;
        }
        
        // Find the user record
        const userRecord = await usersCollection.findOne({ walletAddress: memberWalletAddress });
        
        if (!userRecord) {
          console.log(`⚠️  No user record found for wallet ${memberWalletAddress} (member of ${squad.name})`);
          issuesFound++;
          continue;
        }
        
        // Check if user's squadId matches the squad they're listed in
        if (userRecord.squadId !== squad.squadId) {
          console.log(`🔧 Fixing: ${memberWalletAddress} should be in squad "${squad.name}" (${squad.squadId})`);
          console.log(`   Current squadId: ${userRecord.squadId || 'null'}`);
          console.log(`   Should be: ${squad.squadId}`);
          
          // Update the user record
          const updateResult = await usersCollection.updateOne(
            { walletAddress: memberWalletAddress },
            { 
              $set: { 
                squadId: squad.squadId,
                updatedAt: new Date()
              } 
            }
          );
          
          if (updateResult.modifiedCount > 0) {
            console.log(`✅ Fixed ${memberWalletAddress} - now properly linked to squad "${squad.name}"`);
            fixedCount++;
          } else {
            console.log(`❌ Failed to update ${memberWalletAddress}`);
          }
        } else if (targetWalletAddress === memberWalletAddress) {
          console.log(`✅ ${memberWalletAddress} is already correctly linked to squad "${squad.name}"`);
        }
      }
    }
    
    // Also check for users who have squadId but aren't in any squad's member list
    console.log('\n🔍 Checking for orphaned user squadId references...');
    
    const usersWithSquadId = await usersCollection.find({ squadId: { $exists: true, $ne: null } }).toArray();
    
    for (const user of usersWithSquadId) {
      // Skip if we're targeting a specific wallet and this isn't it
      if (targetWalletAddress && user.walletAddress !== targetWalletAddress) {
        continue;
      }
      
      const squad = await squadsCollection.findOne({ squadId: user.squadId });
      
      if (!squad) {
        console.log(`⚠️  User ${user.walletAddress} references non-existent squad ${user.squadId}`);
        
        // Remove the invalid squadId
        await usersCollection.updateOne(
          { walletAddress: user.walletAddress },
          { 
            $unset: { squadId: "" },
            $set: { updatedAt: new Date() }
          }
        );
        console.log(`🔧 Removed invalid squadId from ${user.walletAddress}`);
        fixedCount++;
        
      } else if (!squad.memberWalletAddresses.includes(user.walletAddress)) {
        console.log(`⚠️  User ${user.walletAddress} claims to be in squad "${squad.name}" but isn't in member list`);
        
        // Remove the invalid squadId
        await usersCollection.updateOne(
          { walletAddress: user.walletAddress },
          { 
            $unset: { squadId: "" },
            $set: { updatedAt: new Date() }
          }
        );
        console.log(`🔧 Removed invalid squadId from ${user.walletAddress}`);
        fixedCount++;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Issues found: ${issuesFound}`);
    console.log(`   Records fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log('\n✅ Data consistency issues have been resolved!');
      console.log('   Users should now see their correct squad information in the dashboard.');
    } else if (targetWalletAddress) {
      console.log(`\n✅ No issues found for wallet ${targetWalletAddress}`);
    } else {
      console.log('\n✅ No data consistency issues found!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing squad membership:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  const targetWallet = process.argv[2];
  
  if (targetWallet) {
    console.log(`🎯 Targeting specific wallet: ${targetWallet}`);
  } else {
    console.log('🌐 Checking all users and squads');
  }
  
  try {
    await fixSquadMembership(targetWallet);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixSquadMembership }; 