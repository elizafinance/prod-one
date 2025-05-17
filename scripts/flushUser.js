/*
  Usage:
    node scripts/flushUser.js <walletAddress>

  Description:
    This script completely removes a malformed user from the DeFAI Rewards database so they can register again from scratch.
    It deletes the user document, strips the wallet address from any squads, join-requests, invitations, actions, and notifications.
    If the user was a squad leader the script will WARN (manual follow-up might be required to promote another member).

  NOTE: 1) Run this ONLY if you are sure the user should be purged.
        2) Ensure MONGODB_URI and MONGODB_DB_NAME are present in your environment (same as the app).
*/

import dotenv from 'dotenv';
import { connectToDatabase } from '../src/lib/mongodb.js';

dotenv.config();

async function flushUser(walletAddress) {
  if (!walletAddress) {
    console.error('⚠️  Wallet address argument missing.');
    process.exit(1);
  }

  const { db, client } = await connectToDatabase();
  try {
    console.log(`🚀  Starting purge for wallet: ${walletAddress}`);

    const usersCollection = db.collection('users');
    const squadsCollection = db.collection('squads');
    const invitationsCollection = db.collection('squadInvitations');
    const joinReqCollection = db.collection('squadJoinRequests');
    const actionsCollection = db.collection('actions');
    const notificationsCollection = db.collection('notifications');

    /* 1. Delete user document */
    const userDel = await usersCollection.deleteOne({ walletAddress });
    console.log(`🗑️  Users removed: ${userDel.deletedCount}`);

    /* 2. Remove from squad member arrays */
    const pullMember = await squadsCollection.updateMany(
      { memberWalletAddresses: walletAddress },
      { $pull: { memberWalletAddresses: walletAddress } }
    );
    console.log(`👥  Squads updated (member removed): ${pullMember.modifiedCount}`);

    /* 2a. Handle leadership */
    const leaderSquads = await squadsCollection.find({ leaderWalletAddress: walletAddress }).toArray();
    if (leaderSquads.length) {
      console.warn('⚠️  The user was a leader of the following squads:');
      leaderSquads.forEach(s => console.warn(`   • ${s.squadId} (${s.name})`));
      console.warn('   Leadership NOT auto-transferred. Please handle manually.');
    }

    /* 3. Remove / expire invitations */
    const invDel = await invitationsCollection.updateMany(
      {
        $or: [
          { invitedUserWalletAddress: walletAddress },
          { invitedByUserWalletAddress: walletAddress },
        ],
      },
      { $set: { status: 'revoked' } }
    );
    console.log(`✉️  Invitations updated: ${invDel.modifiedCount}`);

    /* 4. Remove join-requests */
    const jrDel = await joinReqCollection.deleteMany({ requestingUserWalletAddress: walletAddress });
    console.log(`📨  Join requests deleted: ${jrDel.deletedCount}`);

    /* 5. Delete actions (if any) */
    const actDel = await actionsCollection.deleteMany({ walletAddress });
    console.log(`🏆  Action logs deleted: ${actDel.deletedCount}`);

    /* 6. Delete notifications */
    const notifDel = await notificationsCollection.deleteMany({ relatedUserId: walletAddress });
    console.log(`🔔  Notifications deleted: ${notifDel.deletedCount}`);

    console.log('✅  Purge complete.');
  } catch (err) {
    console.error('💥  Error during purge:', err);
  } finally {
    await client.close();
  }
}

flushUser(process.argv[2]); 