// @ts-nocheck
import mongoose from 'mongoose';
import { connectToDatabase } from '../../lib/mongodb';
import { Proposal, IProposal } from '../../models/Proposal';
import { Vote, IVote } from '../../models/Vote';
import { Notification } from '../../models/Notification';
import { Squad } from '../../models/Squad';
import { createNotification, NotificationType } from '../../lib/notificationUtils';
import { Db } from 'mongodb';

// Configuration from environment variables with defaults
const CRON_PROPOSAL_PASS_THRESHOLD = parseInt(process.env.CRON_PROPOSAL_PASS_THRESHOLD || "0", 10);
const CRON_PROPOSAL_ARCHIVE_DELAY_DAYS = parseInt(process.env.CRON_PROPOSAL_ARCHIVE_DELAY_DAYS || "7", 10);
const BROADCAST_THRESHOLD_POINTS = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD || "1000", 10);

// Placeholder for the actual token distribution logic
async function distributeTokens(proposal: IProposal): Promise<boolean> {
  console.log(`DISTRIBUTE TOKENS: Attempting for proposal ${proposal._id} (${proposal.tokenName}), squad ${proposal.squadName}.`);
  console.log(`Tokens to distribute for contract: ${proposal.tokenContractAddress}`);
  
  // --- Actual distribution logic would go here --- 
  // For now, simulate success and update to 'closed_executed'
  // In a real scenario, this block would only run if on-chain/service call is successful.
  try {
    // const distributionResult = await someAsyncDistributionTask();
    // if (distributionResult.success) { 
    console.log(`Simulating successful token distribution for proposal ${proposal._id}.`);
    proposal.status = 'closed_executed';
    await proposal.save();
    console.log(`Proposal ${proposal._id} status updated to closed_executed.`);
    return true; // Indicates execution and status change occurred
    // } else {
    //   console.error(`Token distribution failed for proposal ${proposal._id}: ${distributionResult.error}`);
    //   return false;
    // }
  } catch (error) {
    console.error(`Error during token distribution for proposal ${proposal._id}:`, error);
    return false; // Indicates execution failed or did not complete
  }
  // --- End of actual distribution logic placeholder ---
}

async function createNotificationsForSquadMembers(
  db: Db,
  squadId: mongoose.Types.ObjectId,
  proposal: IProposal,
  notificationType: NotificationType,
  title: string,
  message: string
) {
  try {
    const squad = await Squad.findById(squadId);
    if (!squad) {
      console.warn(`Squad ${squadId} not found when trying to send proposal result notifications.`);
      return;
    }

    const ctaUrl = `/squads/${squad.squadId}/proposals/${proposal._id.toString()}`;
    const proposalCreatorUserId = proposal.createdByUserId?.toString();

    let notificationsSentCount = 0;
    for (const walletAddress of squad.memberWalletAddresses) {
      await createNotification(
        db,
        walletAddress,
        notificationType,
        title,
        message,
        ctaUrl,
        proposal._id.toString(),
        proposal.tokenName,
        squad.squadId,
        squad.name,
        proposalCreatorUserId,
        undefined
      );
      notificationsSentCount++;
    }

    if (notificationsSentCount > 0) {
      console.log(`Sent ${notificationsSentCount} '${notificationType}' notifications for proposal ${proposal._id.toString()} to squad ${squad.name}.`);
    }
  } catch (error) {
    console.error(`Error creating notifications for squad ${squadId} / proposal ${proposal._id.toString()}:`, error);
  }
}

async function processEndedProposals() {
  console.log('Starting proposal processing job...');
  let dbConnection;
  let mongoDbInstance: Db | null = null;

  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('No existing Mongoose connection, attempting to connect for cron job...');
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set for cron job.');
      }
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('Mongoose connected successfully for cron job.');
      mongoDbInstance = dbConnection.connection.db;
    } else {
      console.log('Using existing Mongoose connection for cron job.');
      mongoDbInstance = mongoose.connection.db;
    }

    if (!mongoDbInstance) {
      throw new Error("Failed to get native MongoDB instance for cron job.");
    }

    const now = new Date();
    const activeProposalsToEnd = await Proposal.find<IProposal>({
      status: 'active',
      epochEnd: { $lt: now },
    });

    console.log(`Found ${activeProposalsToEnd.length} active proposals whose voting period has ended.`);

    for (const proposal of activeProposalsToEnd) {
      console.log(`Processing proposal: ${(proposal._id as mongoose.Types.ObjectId).toString()} (${proposal.tokenName})`);
      const votes = await Vote.find<IVote>({ proposalId: proposal._id });

      let upVotesWeight = 0;
      let downVotesWeight = 0;
      let abstainVotesCount = 0;
      let upVotesCount = 0;
      let downVotesCount = 0;

      votes.forEach(vote => {
        if (vote.choice === 'up') {
          upVotesWeight += vote.voterPointsAtCast;
          upVotesCount++;
        } else if (vote.choice === 'down') {
          downVotesWeight += vote.voterPointsAtCast;
          downVotesCount++;
        } else if (vote.choice === 'abstain') {
          abstainVotesCount++;
        }
      });

      const netVoteWeight = upVotesWeight - downVotesWeight;
      let currentProposalStatus: IProposal['status'] = 'closed_failed'; // Default to failed
      
      if (netVoteWeight > CRON_PROPOSAL_PASS_THRESHOLD) {
        currentProposalStatus = 'closed_passed'; 
        console.log(`PROPOSAL PASSED (pre-execution): Proposal ${(proposal._id as mongoose.Types.ObjectId).toString()} (${proposal.tokenName}) for squad ${proposal.squadName}. Net weight: ${netVoteWeight}.`);
        
        // Attempt token distribution, which might change status to 'closed_executed'
        const executed = await distributeTokens(proposal); // proposal object is modified by reference if status changes
        if (executed) {
            // If distributeTokens changed the status to 'closed_executed' and saved,
            // proposal.status will reflect that here. We can use it directly for notifications.
            currentProposalStatus = proposal.status; // Should be 'closed_executed'
        }
      } else {
         console.log(`PROPOSAL FAILED: Proposal ${(proposal._id as mongoose.Types.ObjectId).toString()} (${proposal.tokenName}) for squad ${proposal.squadName}. Net weight: ${netVoteWeight}.`);
         proposal.status = 'closed_failed'; // Explicitly set if it didn't pass
      }

      // Persist final calculated data and potentially updated status
      proposal.finalUpVotesWeight = upVotesWeight;
      proposal.finalDownVotesWeight = downVotesWeight;
      proposal.finalAbstainVotesCount = abstainVotesCount;
      proposal.totalFinalVoters = votes.length;
      proposal.finalUpVotesCount = upVotesCount;
      proposal.finalDownVotesCount = downVotesCount;
      // If not already saved by distributeTokens, or if it failed, save current state.
      if (proposal.status !== 'closed_executed') {
          proposal.status = currentProposalStatus; // Ensure it's set correctly if not executed
      }
      await proposal.save(); 
      console.log(`Proposal ${(proposal._id as mongoose.Types.ObjectId).toString()} final status is ${proposal.status} and results saved.`);

      // Prepare notification based on the final status of the proposal
      let outcomeNotificationTitle: string;
      let outcomeNotificationMessage: string;
      let outcomeNotificationType: NotificationType;

      if (proposal.status === 'closed_executed') {
        outcomeNotificationTitle = `Proposal Executed: ${proposal.tokenName}`;
        outcomeNotificationMessage = `The passed proposal '${proposal.tokenName}' for squad ${proposal.squadName} has been executed and rewards are on their way!`;
        outcomeNotificationType = 'proposal_executed';
      } else if (proposal.status === 'closed_passed') {
        outcomeNotificationTitle = `Proposal Passed: ${proposal.tokenName}`;
        outcomeNotificationMessage = `The proposal '${proposal.tokenName}' for squad ${proposal.squadName} has passed! Token distribution is pending.`;
        outcomeNotificationType = 'proposal_passed';
      } else { // 'closed_failed'
        outcomeNotificationTitle = `Proposal Failed: ${proposal.tokenName}`;
        outcomeNotificationMessage = `The voting period for proposal '${proposal.tokenName}' for squad ${proposal.squadName} has ended. Unfortunately, it did not pass.`;
        outcomeNotificationType = 'proposal_failed';
      }

      await createNotificationsForSquadMembers(
        mongoDbInstance,
        proposal.squadId, 
        proposal, 
        outcomeNotificationType, 
        outcomeNotificationTitle,
        outcomeNotificationMessage
      );
      
      // Auto-broadcasting based on points if it passed (even if execution is pending/failed but proposal itself is valid)
      if ((proposal.status === 'closed_passed' || proposal.status === 'closed_executed') && 
          upVotesWeight >= BROADCAST_THRESHOLD_POINTS && !proposal.broadcasted) {
          proposal.broadcasted = true;
          await proposal.save();

          // Platform-wide broadcast notifications - REFACTORED SECTION
          try {
            // mongoDbInstance is already available and is the native Db type
            const usersCollection = mongoDbInstance.collection<UserDocument>('users'); 
            const usersToNotify = await usersCollection.find({ walletAddress: { $exists: true, $ne: null } }, { projection: { walletAddress: 1, xUsername: 1 } }).toArray();

            const broadcastTitle = `Proposal Broadcast: ${proposal.tokenName}`;
            const broadcastMessage = `A significant proposal "${proposal.tokenName}" from squad ${proposal.squadName} has passed and reached the broadcast threshold. Check it out!`;
            const broadcastCtaUrl = `/squads/${proposal.squadId.toString()}/proposals/${proposal._id.toString()}`;
            
            let broadcastSentCount = 0;
            if (usersToNotify.length > 0) {
              for (const user of usersToNotify) {
                if (user.walletAddress) { // Ensure walletAddress exists
                  await createNotification(
                    mongoDbInstance,                // db instance
                    user.walletAddress,             // recipientWalletAddress
                    'proposal_broadcasted',         // type
                    broadcastTitle,
                    broadcastMessage,
                    broadcastCtaUrl,
                    proposal._id.toString(),      // relatedQuestId (using for proposalId)
                    proposal.tokenName,           // relatedQuestTitle (using for proposalName)
                    proposal.squadId.toString(),  // relatedSquadId (ensure it's a string if squadId on proposal is ObjectId)
                    proposal.squadName,
                    proposal.createdByUserId?.toString(), // relatedUserId (proposal creator)
                    undefined                     // relatedUserName (can be enhanced by fetching creator's username)
                  );
                  broadcastSentCount++;
                }
              }
            }
            if (broadcastSentCount > 0) {
              console.log(`Sent ${broadcastSentCount} platform-wide 'proposal_broadcasted' notifications for proposal ${proposal._id.toString()}.`);
            }
          } catch (err) {
            console.error('Error creating broadcast notifications:', err);
          }
          console.log(`Proposal ${proposal._id.toString()} also met broadcast threshold and marked as broadcasted.`);
      }
    }
    console.log('Finished processing ended proposals.');
  } catch (error) {
    console.error('Error during proposal processing job:', error);
    process.exitCode = 1;
  } finally {
    if (dbConnection) {
      await mongoose.disconnect();
      console.log('Mongoose connection closed for cron job.');
    }
  }
}

async function archiveOldClosedProposals() {
  console.log('Starting old closed proposal archiving job...');
  let dbConnection;
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('No existing Mongoose connection, attempting to connect for archiving...');
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required for archiving.');
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('Mongoose connected for archiving.');
    }

    const now = new Date();
    const archiveCutoffDate = new Date(now.setDate(now.getDate() - CRON_PROPOSAL_ARCHIVE_DELAY_DAYS));

    const result = await Proposal.updateMany(
      {
        status: { $in: ['closed_passed', 'closed_failed', 'closed_executed'] }, 
        epochEnd: { $lt: archiveCutoffDate }, 
      },
      {
        $set: { status: 'archived' },
      }
    );
    console.log(`Old closed proposal archiving finished. Archived ${result.modifiedCount} proposals.`);

  } catch (error) {
    console.error('Error during old closed proposal archiving job:', error);
    process.exitCode = 1; 
  } finally {
    if (dbConnection && mongoose.connection.readyState === 1) { 
      await mongoose.disconnect();
      console.log('Mongoose connection closed for archiving job.');
    }
  }
}

async function main() {
  await processEndedProposals();
  await archiveOldClosedProposals(); 
}

export { main }; 

if (require.main === module) {
  main()
    .then(() => {
      console.log('Cron job execution successful (process and archive).');
      if (process.exitCode !== 1) {
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Cron job execution failed (process and archive):', err);
      process.exit(1);
    });
}

export { processEndedProposals, archiveOldClosedProposals }; 