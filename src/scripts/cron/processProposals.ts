import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb'; // Adjust if your helper is different or not used
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote';
import { Notification } from '@/models/Notification'; // Added Notification model
import { Squad } from '@/models/Squad'; // Added Squad model

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
  squadId: mongoose.Types.ObjectId,
  proposal: IProposal,
  notificationType: 'proposal_passed' | 'proposal_failed' | 'proposal_executed',
  title: string,
  message: string
) {
  try {
    const squad = await Squad.findById(squadId);
    if (!squad) {
      console.warn(`Squad ${squadId} not found when trying to send proposal result notifications.`);
      return;
    }

    const notifications = squad.memberWalletAddresses.map((walletAddress: string) => ({
      recipientWalletAddress: walletAddress,
      type: notificationType,
      title,
      message,
      data: {
        proposalId: (proposal._id as mongoose.Types.ObjectId).toString(),
        proposalName: proposal.tokenName,
        squadId: squad.squadId, 
        squadName: squad.name,
      },
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Created ${notifications.length} notifications for proposal ${(proposal._id as mongoose.Types.ObjectId).toString()} results for squad ${squad.name}.`);
    }
  } catch (error) {
    console.error(`Error creating notifications for squad ${squadId} / proposal ${(proposal._id as mongoose.Types.ObjectId).toString()}:`, error);
  }
}

async function processEndedProposals() {
  console.log('Starting proposal processing job...');
  let dbConnection;
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('No existing Mongoose connection, attempting to connect for cron job...');
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set for cron job.');
      }
      dbConnection = await mongoose.connect(process.env.MONGODB_URI);
      console.log('Mongoose connected successfully for cron job.');
    } else {
      console.log('Using existing Mongoose connection for cron job.');
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
      let notificationTitle: string;
      let notificationMessage: string;
      let notificationType: 'proposal_passed' | 'proposal_failed' | 'proposal_executed';

      if (proposal.status === 'closed_executed') {
        notificationTitle = `Proposal \'${proposal.tokenName}\' Executed!`;
        notificationMessage = `The passed proposal \'${proposal.tokenName}\' for squad ${proposal.squadName} has been executed and rewards are on their way!`;
        notificationType = 'proposal_executed';
      } else if (proposal.status === 'closed_passed') {
        notificationTitle = `Proposal \'${proposal.tokenName}\' Passed!`;
        notificationMessage = `Great news! The proposal \'${proposal.tokenName}\' for squad ${proposal.squadName} has passed! Token distribution is pending.`;
        notificationType = 'proposal_passed';
      } else { // 'closed_failed'
        notificationTitle = `Proposal \'${proposal.tokenName}\' Failed`;
        notificationMessage = `The voting period for proposal \'${proposal.tokenName}\' for squad ${proposal.squadName} has ended. Unfortunately, it did not pass.`;
        notificationType = 'proposal_failed';
      }

      await createNotificationsForSquadMembers(proposal.squadId, proposal, notificationType, 
        `${notificationTitle} (Squad: ${proposal.squadName})`, 
        `The proposal \'${proposal.tokenName}\' for squad ${proposal.squadName} has concluded. ${notificationMessage}`
      );
      
      // Auto-broadcasting based on points if it passed (even if execution is pending/failed but proposal itself is valid)
      if ((proposal.status === 'closed_passed' || proposal.status === 'closed_executed') && 
          upVotesWeight >= BROADCAST_THRESHOLD_POINTS && !proposal.broadcasted) {
          proposal.broadcasted = true;
          await proposal.save(); // Save the broadcast status
          console.log(`Proposal ${(proposal._id as mongoose.Types.ObjectId).toString()} also met broadcast threshold and marked as broadcasted.`);
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