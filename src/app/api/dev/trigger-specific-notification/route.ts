import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, NotificationType } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';
import { v4 as uuidv4 } from 'uuid'; // For generating mock IDs

interface TriggerNotificationRequestBody {
  notificationType: NotificationType;
  // Add other optional mock data fields as needed for different types
  mockRelatedUserName?: string;
  mockSquadName?: string;
  mockBadgeName?: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;
  const currentUserXUsername = session.user.xUsername || currentUserWalletAddress.substring(0, 6);

  try {
    const body: TriggerNotificationRequestBody = await request.json();
    const { notificationType, mockRelatedUserName, mockSquadName, mockBadgeName } = body;

    if (!notificationType) {
      return NextResponse.json({ error: 'notificationType is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    let title = '🔔 Test Notification!';
    let message = `This is a test for type: ${notificationType}`;
    let ctaUrl = '/notifications';
    let relatedQuestId, relatedQuestTitle, relatedSquadId, relatedSquadName, relatedUserId, relatedUserName, relatedInvitationId, rewardAmount, rewardCurrency, badgeId;

    // Customize parameters based on notificationType
    switch (notificationType) {
      case 'squad_invite_received':
        title = `Squad Invite: ${mockSquadName || 'The Cool Squad'}`;
        message = `@${mockRelatedUserName || 'MockInviter'} invited you to join "${mockSquadName || 'The Cool Squad'}".`;
        ctaUrl = '/squads/invitations';
        relatedSquadId = uuidv4().substring(0, 8); // mock squad ID
        relatedSquadName = mockSquadName || 'The Cool Squad';
        relatedUserId = uuidv4().substring(0, 10); // mock inviter user ID (wallet or other)
        relatedUserName = mockRelatedUserName || 'MockInviter';
        relatedInvitationId = uuidv4(); // mock invitation ID
        break;

      case 'badge_earned':
        const badge = mockBadgeName || 'Generous Donor';
        badgeId = `${badge.toLowerCase().replace(/\s+/g, '_')}_badge`;
        title = `Badge Earned: ${badge}`;
        message = `Congratulations! You've earned the "${badge}" badge.`;
        ctaUrl = `/profile/${currentUserWalletAddress}?section=badges`;
        rewardAmount = 100; // Mock points for earning badge
        rewardCurrency = 'AIR'; // Or your points label config
        break;

      case 'squad_invite_accepted': // Notification to an inviter (current user is inviter)
        title = `@${mockRelatedUserName || 'MockJoiner'} Accepted Your Invite!`;
        message = `@${mockRelatedUserName || 'MockJoiner'} accepted your invitation to join "${mockSquadName || 'The Test Squad'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Test Squad';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the user who accepted
        relatedUserName = mockRelatedUserName || 'MockJoiner';
        relatedInvitationId = uuidv4(); 
        ctaUrl = `/squads/${relatedSquadId}`;
        // Recipient is currentUserWalletAddress (simulating they are the inviter)
        break;

      case 'squad_member_joined': // Notification to an existing squad member (current user is existing member)
        title = `New Member: @${mockRelatedUserName || 'NewJoinee'}`;
        message = `@${mockRelatedUserName || 'NewJoinee'} just joined your squad, "${mockSquadName || 'Our Awesome Squad'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'Our Awesome Squad';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the user who joined
        relatedUserName = mockRelatedUserName || 'NewJoinee';
        ctaUrl = `/squads/${relatedSquadId}`;
        // Recipient is currentUserWalletAddress (simulating they are an existing member)
        break;

      case 'referral_success': // Notification to the referrer (current user is referrer)
        title = "🎉 Referral Success!";
        message = `You successfully referred @${mockRelatedUserName || 'ReferredFriend'}! Points have been added.`;
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the referred user
        relatedUserName = mockRelatedUserName || 'ReferredFriend';
        rewardAmount = 1000; // Example points
        rewardCurrency = 'AIR';
        ctaUrl = '/profile?tab=referrals'; // Or wherever they see referral stats
        break;

      case 'quest_reward_received': // Notification for current user receiving a quest reward
        const mockQuestTitleText = mockRelatedUserName || 'Weekly Engagement Challenge'; // Re-using mockRelatedUserName for quest title here
        title = `🏆 Quest Reward!`;
        message = `You've received a reward for completing "${mockQuestTitleText}"! Details: ${mockSquadName || '1000 Points'}.`; // Re-using mockSquadName for reward description
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockQuestTitleText;
        rewardAmount = 1000; // Example
        rewardCurrency = 'AIR';
        ctaUrl = `/quests/${relatedQuestId}`;
        break;

      case 'squad_invite_declined': // Notification to an inviter (current user is inviter)
        title = `Invite Declined: ${mockSquadName || 'The Test Squad'}`;
        message = `@${mockRelatedUserName || 'SomeUser'} declined your invitation to join "${mockSquadName || 'The Test Squad'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Test Squad';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the user who declined
        relatedUserName = mockRelatedUserName || 'SomeUser';
        relatedInvitationId = uuidv4(); 
        ctaUrl = `/squads/${relatedSquadId}/manage`; // Link to squad management
        break;

      case 'squad_invite_revoked': // Notification to an invitee (current user is invitee)
        title = `Invite Revoked: ${mockSquadName || 'The Guild'}`;
        message = `Your invitation to join "${mockSquadName || 'The Guild'}" from @${mockRelatedUserName || 'GuildLeader'} was revoked.`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Guild';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the user who revoked
        relatedUserName = mockRelatedUserName || 'GuildLeader';
        relatedInvitationId = uuidv4(); 
        ctaUrl = '/squads/browse'; // Link to browse other squads
        break;

      case 'squad_kicked': // Notification to a kicked user (current user is kicked)
        title = `Removed from ${mockSquadName || 'The Old Guard'}`;
        message = `You were removed from the squad "${mockSquadName || 'The Old Guard'}" by the leader, @${mockRelatedUserName || 'SternLeader'}.`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Old Guard';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the leader who kicked
        relatedUserName = mockRelatedUserName || 'SternLeader';
        ctaUrl = '/squads/browse';
        break;

      case 'squad_member_left': // Notification to remaining squad members (current user is a remaining member)
        title = `@${mockRelatedUserName || 'DepartingSoul'} Left ${mockSquadName || 'Our Crew'}`;
        message = `@${mockRelatedUserName || 'DepartingSoul'} has left your squad, "${mockSquadName || 'Our Crew'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'Our Crew';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the user who left
        relatedUserName = mockRelatedUserName || 'DepartingSoul';
        ctaUrl = `/squads/${relatedSquadId}`;
        break;

      case 'squad_leader_changed': // Notification to squad members (current user is a member)
        title = `New Leader for ${mockSquadName || 'Our Crew'}`;
        message = `@${mockRelatedUserName || 'OldLeader'} stepped down. @${mockBadgeName || 'NewLeader'} is the new leader of "${mockSquadName || 'Our Crew'}"!`; // Re-using mockBadgeName for new leader name
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'Our Crew';
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the new leader
        relatedUserName = mockBadgeName || 'NewLeader'; // Re-using mockBadgeName for new leader name
        ctaUrl = `/squads/${relatedSquadId}`;
        break;

      case 'quest_failed_community': // Notification to a participant (current user is participant)
        title = `Quest Update: ${mockRelatedUserName || 'Community Challenge'}`;
        message = `The community quest "${mockRelatedUserName || 'Community Challenge'}" has ended and the goal was not met. Better luck next time!`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'Community Challenge';
        ctaUrl = `/quests`;
        break;

      case 'squad_reward_received': // Notification to a squad member (current user is member)
        title = `🏆 Squad Quest Reward!`;
        message = `Your squad, "${mockSquadName || 'The Champions'}", completed a quest! You've received a reward: ${mockRelatedUserName || 'Rare Item & 500 Points'}.`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Champions';
        relatedQuestId = uuidv4().substring(0,8); // Mock quest ID that was completed
        relatedQuestTitle = mockBadgeName || 'The Great Hunt'; // Re-using mockBadgeName for quest title
        rewardAmount = 500; // Example
        rewardCurrency = 'Points';
        ctaUrl = `/quests/${relatedQuestId}`;
        break;

      case 'welcome':
        title = "🎉 Welcome to DEFAI Rewards!";
        message = "Thanks for joining! Explore quests, join squads, and climb the leaderboard.";
        ctaUrl = "/"; // Link to dashboard
        break;

      case 'airdrop_claim_available':
        title = "💸 Airdrop Claim Now Open!";
        message = `Your airdrop of ${mockRelatedUserName || '10,000'} ${mockSquadName || 'Tokens'} is now available to claim!`; // Re-using mocks for amount/token name
        ctaUrl = "/myair"; // Link to airdrop claim page
        rewardAmount = parseInt(mockRelatedUserName || '10000') || 10000;
        rewardCurrency = mockSquadName || 'Tokens';
        break;

      case 'referred_by_success': // Notification to the user who WAS referred
        title = "Referral Bonus Received!";
        message = `You successfully signed up via @${mockRelatedUserName || 'CoolReferrer'}'s link! Enjoy your bonus points.`;
        relatedUserId = uuidv4().substring(0,10); // Mock ID of the referrer
        relatedUserName = mockRelatedUserName || 'CoolReferrer';
        rewardAmount = 500; // Example points for being referred
        rewardCurrency = 'AIR';
        ctaUrl = '/profile';
        break;

      case 'squad_join_request_received': // Simulates current user (as leader) receiving a join request
        title = `Join Request for ${mockSquadName || 'Your Squad'}`;
        message = `@${mockRelatedUserName || 'HopefulApplicant'} wants to join "${mockSquadName || 'Your Squad'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'Your Squad';
        relatedUserId = uuidv4().substring(0,10); // Mock applicant's ID
        relatedUserName = mockRelatedUserName || 'HopefulApplicant';
        relatedInvitationId = uuidv4(); // Mock join request ID
        ctaUrl = `/squads/${relatedSquadId}/manage?tab=requests`;
        break;

      case 'squad_join_request_approved': // Simulates current user (as requester) getting their request approved
        title = `Joined ${mockSquadName || 'The Elite Crew'}!`;
        message = `Your request to join "${mockSquadName || 'The Elite Crew'}" was approved by @${mockRelatedUserName || 'ApprovingLeader'}. Welcome!`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Elite Crew';
        relatedUserId = uuidv4().substring(0,10); // Mock approver's ID
        relatedUserName = mockRelatedUserName || 'ApprovingLeader';
        relatedInvitationId = uuidv4(); // Mock join request ID that was approved
        ctaUrl = `/squads/${relatedSquadId}`;
        break;

      case 'squad_join_request_rejected': // Simulates current user (as requester) getting their request rejected
        title = `Request Update: ${mockSquadName || 'The Exclusives'}`;
        message = `Your request to join "${mockSquadName || 'The Exclusives'}" was declined by @${mockRelatedUserName || 'RejectingLeader'}.`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Exclusives';
        relatedUserId = uuidv4().substring(0,10); // Mock rejector's ID
        relatedUserName = mockRelatedUserName || 'RejectingLeader';
        relatedInvitationId = uuidv4(); // Mock join request ID
        ctaUrl = '/squads/browse';
        break;

      case 'squad_join_request_cancelled': // Simulates current user (as leader) being notified of a cancellation
        title = `Join Request Cancelled for ${mockSquadName || 'Your Squad'}`;
        message = `@${mockRelatedUserName || 'ChangedMindUser'} cancelled their request to join "${mockSquadName || 'Your Squad'}".`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'Your Squad';
        relatedUserId = uuidv4().substring(0,10); // Mock canceller's ID
        relatedUserName = mockRelatedUserName || 'ChangedMindUser';
        relatedInvitationId = uuidv4(); // Mock join request ID
        ctaUrl = `/squads/${relatedSquadId}/manage?tab=requests`;
        break;

      case 'rank_up':
        title = "🏆 You've Ranked Up!";
        message = `Congratulations! You've achieved the rank of "${mockRelatedUserName || 'Gold Tier'}". Keep climbing!`;
        // relatedUserName could be used for the rank name here
        rewardAmount = 250; // Example points for rank up
        rewardCurrency = 'AIR';
        ctaUrl = '/leaderboard';
        break;

      case 'milestone_unlocked':
        title = "✨ Milestone Unlocked!";
        message = `You've unlocked the "${mockRelatedUserName || '100 Quests Completed'}" milestone!`;
        // relatedUserName could be used for the milestone name
        badgeId = (mockRelatedUserName || '100_quests_completed').toLowerCase().replace(/\s+/g, '_');
        rewardAmount = 150;
        rewardCurrency = 'AIR';
        ctaUrl = '/profile?tab=achievements';
        break;

      case 'squad_disbanded':
        title = `Squad Disbanded: ${mockSquadName || 'The Fallen Heroes'}`;
        message = `The squad "${mockSquadName || 'The Fallen Heroes'}", which you were a part of, has been disbanded.`;
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Fallen Heroes';
        ctaUrl = '/squads/browse';
        break;

      case 'system_message':
        title = `📢 System Announcement: ${mockSquadName || 'Important Update'}`;
        message = `${mockRelatedUserName || 'Please be advised of scheduled maintenance tonight from 2-3 AM UTC.'}`;
        // mockSquadName for title part, mockRelatedUserName for message body
        ctaUrl = '/news'; // Or relevant link
        break;

      case 'quest_completed_community':
        title = `🎉 Quest Complete: ${mockRelatedUserName || 'Community Effort'}`;
        message = `Amazing work! The community quest "${mockRelatedUserName || 'Community Effort'}" has been successfully completed by everyone!`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'Community Effort'; // Using mockRelatedUserName for quest title
        // Potentially add reward info if this notification implies rewards too, or keep it separate from quest_reward_received
        ctaUrl = `/quests/${relatedQuestId}`;
        break;

      case 'quest_newly_active': // Simulates current user receiving a notification about a newly activated quest
        title = `New Quest Live: ${mockRelatedUserName || 'The Scavenger Hunt'}`;
        message = `A new community quest, "${mockRelatedUserName || 'The Scavenger Hunt'}", has just started. Check it out and earn rewards!`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'The Scavenger Hunt';
        ctaUrl = `/quests/${relatedQuestId}`;
        break;

      case 'proposal_created': // Simulates current user (as squad member) receiving a new proposal notification
        title = `New Proposal: ${mockRelatedUserName || 'Token Burn Initiative'}`;
        message = `A new proposal "${mockRelatedUserName || 'Token Burn Initiative'}" has been created in your squad, ${mockSquadName || 'The Innovators'}. Voting is now open!`;
        relatedQuestId = uuidv4().substring(0,8); // Using for mock proposal ID
        relatedQuestTitle = mockRelatedUserName || 'Token Burn Initiative'; // Using for mock proposal title/name
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Innovators';
        relatedUserId = uuidv4().substring(0,10); // Mock creator's ID
        relatedUserName = mockBadgeName || 'ProposerPaul'; // Re-using mockBadgeName for creator's name
        ctaUrl = `/squads/${relatedSquadId}/proposals/${relatedQuestId}`;
        break;

      case 'proposal_passed':
        title = `Proposal Passed: ${mockRelatedUserName || 'Key Initiative'}`;
        message = `The proposal "${mockRelatedUserName || 'Key Initiative'}" in squad ${mockSquadName || 'The Strategists'} has passed! Implementation pending.`;
        relatedQuestId = uuidv4().substring(0,8); // Mock proposal ID
        relatedQuestTitle = mockRelatedUserName || 'Key Initiative'; // Mock proposal name
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Strategists';
        ctaUrl = `/squads/${relatedSquadId}/proposals/${relatedQuestId}`;
        break;

      case 'proposal_failed':
        title = `Proposal Update: ${mockRelatedUserName || 'Bold Move'}`;
        message = `Unfortunately, the proposal "${mockRelatedUserName || 'Bold Move'}" in squad ${mockSquadName || 'The Challengers'} did not pass.`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'Bold Move';
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Challengers';
        ctaUrl = `/squads/${relatedSquadId}/proposals/${relatedQuestId}`;
        break;

      case 'proposal_executed':
        title = `Proposal Executed: ${mockRelatedUserName || 'Project Phoenix'}`;
        message = `The proposal "${mockRelatedUserName || 'Project Phoenix'}" for squad ${mockSquadName || 'The Builders'} has been successfully executed! Rewards/changes are now active.`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'Project Phoenix';
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Builders';
        ctaUrl = `/squads/${relatedSquadId}/proposals/${relatedQuestId}`;
        break;

      case 'proposal_broadcasted': // Simulates receiving a platform-wide broadcast about a significant proposal
        title = `📢 Proposal Broadcast: ${mockRelatedUserName || 'Major Governance Vote Passed'}`;
        message = `A significant proposal "${mockRelatedUserName || 'Major Governance Vote Passed'}" from squad ${mockSquadName || 'The Visionaries'} has been broadcasted. Check it out!`;
        relatedQuestId = uuidv4().substring(0,8); // Mock proposal ID
        relatedQuestTitle = mockRelatedUserName || 'Major Governance Vote Passed'; // Mock proposal name
        relatedSquadId = uuidv4().substring(0,8); // Mock squad ID
        relatedSquadName = mockSquadName || 'The Visionaries';
        relatedUserId = uuidv4().substring(0,10); // Mock original proposer ID
        relatedUserName = mockBadgeName || 'InfluencerAlice'; // Mock original proposer name
        ctaUrl = `/squads/${relatedSquadId}/proposals/${relatedQuestId}`;
        break;

      case 'new_squad_quest': // Simulates current user (as squad member) receiving a new squad quest notification
        title = `New Squad Quest: ${mockRelatedUserName || 'The Dragon\'s Hoard'}`;
        message = `A new quest "${mockRelatedUserName || 'The Dragon\'s Hoard'}" is now available for your squad, "${mockSquadName || 'The Quest Takers'}"! Rally your members!`;
        relatedQuestId = uuidv4().substring(0,8);
        relatedQuestTitle = mockRelatedUserName || 'The Dragon\'s Hoard';
        relatedSquadId = uuidv4().substring(0,8);
        relatedSquadName = mockSquadName || 'The Quest Takers';
        relatedUserId = uuidv4().substring(0,10); // Mock admin ID who created it
        relatedUserName = mockBadgeName || 'AdminGodMode'; // Mock admin name
        ctaUrl = `/quests/${relatedQuestId}`;
        break;

      case 'generic': // Fallback to the generic test notification
      default:
        message = `This is a generic test notification sent at ${new Date().toLocaleTimeString()}`;
        break;
    }

    await createNotification(
      db,
      currentUserWalletAddress, // recipientWalletAddress
      notificationType,         // type
      title,
      message,
      ctaUrl,
      relatedQuestId,
      relatedQuestTitle,
      relatedSquadId,
      relatedSquadName,
      relatedUserId,
      relatedUserName,
      relatedInvitationId,
      rewardAmount,
      rewardCurrency,
      badgeId
    );

    return NextResponse.json({ message: `Test notification of type '${notificationType}' sent successfully!` });
  } catch (error: any) {
    console.error(`[API TriggerSpecificNotification POST] Error for type ${request.body ? (await request.json() as any).notificationType : 'unknown'}:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to send test notification', details: error.message }, { status: 500 });
  }
} 