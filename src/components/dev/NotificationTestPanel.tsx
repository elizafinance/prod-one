'use client';

import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import useUiStateStore from '@/store/useUiStateStore';
import { NotificationType } from '@/lib/mongodb'; // For typing handleSendTestNotification

// Define an interface for the mockData if it becomes more complex
interface MockData {
  mockSquadName?: string;
  mockRelatedUserName?: string;
  mockBadgeName?: string;
  // Add other mock data keys as needed
}

export default function NotificationTestPanel() {
  const { data: session, status: authStatus } = useSession();
  const uiState = useUiStateStore();

  const handleSendTestNotification = async (type: NotificationType = 'generic', mockData: MockData = {}) => {
    let toastMessage = "Sending generic test notification...";
    if (type !== 'generic') {
      toastMessage = `Sending test notification for type: ${type}...`;
    }
    toast.info(toastMessage);

    try {
      const endpoint = type === 'generic' ? '/api/dev/test-notification' : '/api/dev/trigger-specific-notification';
      // For generic, body is empty; for specific, it includes notificationType and mockData
      const body = type === 'generic' ? {} : { notificationType: type, ...mockData };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Test notification sent!");
        if (session?.user?.walletAddress && authStatus === 'authenticated') {
          uiState.fetchInitialUnreadCount(session.user.walletAddress, true);
        }
      } else {
        toast.error(data.error || "Failed to send test notification.");
      }
    } catch (error) {
      toast.error("Error sending test notification.");
      console.error("Test notification error:", error);
    }
  };

  // Render nothing if not authenticated (buttons are meant for logged-in dev testing)
  if (authStatus !== 'authenticated') {
    return null;
  }

  return (
    <div className="my-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg shadow-lg space-y-3 max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-yellow-800 text-center mb-2">Dev: Notification Test Panel</h3>
      
      {/* Generic Test Button */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('generic')}
          className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-md transition-colors"
        >
          Send Generic Test Notification
        </button>
        <p className='text-xs text-yellow-700 mt-1 text-center'>Sends a basic notification.</p>
      </div>

      {/* Batch 1: Squad Invite & Badge */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_invite_received', { mockSquadName: 'The Testers', mockRelatedUserName: 'InvitingBot' })}
          className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Receive Squad Invite
        </button>
        <p className='text-xs text-teal-700 mt-1 text-center'>Simulates you receiving a squad invitation.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('badge_earned', { mockBadgeName: 'Test Pilot Badge' })}
          className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Earn a Badge
        </button>
        <p className='text-xs text-indigo-700 mt-1 text-center'>Simulates you earning a new badge.</p>
      </div>

      {/* Batch 2: Squad Invite Accepted, Member Joined, Referral, Quest Reward */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_invite_accepted', { mockRelatedUserName: 'HappyUser', mockSquadName: 'The Testers' })}
          className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Invite Accepted (You are Inviter)
        </button>
        <p className='text-xs text-green-700 mt-1 text-center'>Simulates someone accepting your squad invite.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_member_joined', { mockRelatedUserName: 'NewbieGamer', mockSquadName: 'Our Awesome Squad' })}
          className="w-full px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Squad Member Joined (You are Member)
        </button>
        <p className='text-xs text-sky-700 mt-1 text-center'>Simulates a new member joining your squad.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('referral_success', { mockRelatedUserName: 'ReferredPal' })}
          className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Referral Success (You Referred)
        </button>
        <p className='text-xs text-pink-700 mt-1 text-center'>Simulates you successfully referring a friend.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('quest_reward_received', { mockRelatedUserName: 'Epic Quest Completion', mockSquadName: 'Legendary Loot +5000XP' })}
          className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Quest Reward Received
        </button>
        <p className='text-xs text-purple-700 mt-1 text-center'>Simulates you receiving a quest reward.</p>
      </div>

      {/* Batch 3: Invite Declined, Revoked, Kicked, Member Left */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_invite_declined', { mockRelatedUserName: 'BusyBee', mockSquadName: 'The Test Squad' })}
          className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Invite Declined (You are Inviter)
        </button>
        <p className='text-xs text-orange-700 mt-1 text-center'>Simulates an invite you sent being declined.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_invite_revoked', { mockRelatedUserName: 'GuildMaster', mockSquadName: 'The Guild' })}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Invite Revoked (You are Invitee)
        </button>
        <p className='text-xs text-red-700 mt-1 text-center'>Simulates an invite you received being revoked.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_kicked', { mockRelatedUserName: 'SquadLead', mockSquadName: 'The Old Guard' })}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Kicked from Squad (You are Kicked)
        </button>
        <p className='text-xs text-gray-700 mt-1 text-center'>Simulates you being kicked from a squad.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_member_left', { mockRelatedUserName: 'FormerMate', mockSquadName: 'Our Crew' })}
          className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: Squad Member Left (You are Member)
        </button>
        <p className='text-xs text-teal-800 mt-1 text-center'>Simulates a member leaving your squad.</p>
      </div>

      {/* Batch 4: Leader Changed, Quest Failed, Welcome, Airdrop, Referred By */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_leader_changed', { mockSquadName: 'The Regals', mockRelatedUserName: 'OldKing', mockBadgeName: 'NewKing' })}
          className="w-full px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Squad Leader Changed
        </button>
        <p className='text-xs text-lime-700 mt-1 text-center'>Simulates a change in your squad's leadership.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('quest_failed_community', { mockRelatedUserName: 'The Great Trek' })}
          className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Community Quest Failed
        </button>
        <p className='text-xs text-amber-700 mt-1 text-center'>Simulates a community quest ending without success.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_reward_received', { mockSquadName: 'The Champions', mockRelatedUserName: 'Epic Win Bonus', mockBadgeName: 'Victory Quest' })}
          className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Squad Quest Reward
        </button>
        <p className='text-xs text-cyan-700 mt-1 text-center'>Simulates your squad receiving a quest reward.</p>
      </div>
       <div>
        <button 
          onClick={() => handleSendTestNotification('welcome')}
          className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Welcome Notification
        </button>
        <p className='text-xs text-emerald-700 mt-1 text-center'>Simulates receiving the welcome notification.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('airdrop_claim_available', { mockRelatedUserName: '50,000', mockSquadName: 'XYZ Tokens'})}
          className="w-full px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Airdrop Claim Available
        </button>
        <p className='text-xs text-rose-700 mt-1 text-center'>Simulates an airdrop claim becoming available.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('referred_by_success', { mockRelatedUserName: 'GenerousReferrer' })}
          className="w-full px-4 py-2 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Referred By Success (You were Referred)
        </button>
        <p className='text-xs text-fuchsia-700 mt-1 text-center'>Simulates successfully signing up via referral.</p>
      </div>

      {/* Batch 5: Join Requests, Milestones, More Squad Events, System */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_join_request_received', { mockSquadName: 'The Stalwarts', mockRelatedUserName: 'EagerBeaver' })}
          className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-semibold rounded-md transition-colors"
        >
          Test: Join Request Received (You are Leader)
        </button>
        <p className='text-xs text-slate-700 mt-1 text-center'>Simulates someone requesting to join your squad.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_join_request_approved', { mockSquadName: 'The Elite Crew', mockRelatedUserName: 'ApprovingLeader' })}
          className="w-full px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Your Join Request Approved
        </button>
        <p className='text-xs text-lime-800 mt-1 text-center'>Simulates your squad join request being approved.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_join_request_rejected', { mockSquadName: 'The Exclusives', mockRelatedUserName: 'GateKeeper' })}
          className="w-full px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: Your Join Request Rejected
        </button>
        <p className='text-xs text-red-800 mt-1 text-center'>Simulates your squad join request being rejected.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_join_request_cancelled', { mockSquadName: 'The Active Few', mockRelatedUserName: 'UserWhoLeftQueue' })}
          className="w-full px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: Join Request Cancelled (You are Leader)
        </button>
        <p className='text-xs text-orange-800 mt-1 text-center'>Simulates a user cancelling their join request to your squad.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('rank_up', { mockRelatedUserName: 'Diamond Tier' })}
          className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Rank Up
        </button>
        <p className='text-xs text-yellow-800 mt-1 text-center'>Simulates you achieving a new rank.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('milestone_unlocked', { mockRelatedUserName: 'Alpha Player' })}
          className="w-full px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: Milestone Unlocked
        </button>
        <p className='text-xs text-sky-800 mt-1 text-center'>Simulates unlocking a new milestone/achievement.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('squad_disbanded', { mockSquadName: 'The Lost Legion' })}
          className="w-full px-4 py-2 bg-neutral-600 hover:bg-neutral-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Squad Disbanded
        </button>
        <p className='text-xs text-neutral-800 mt-1 text-center'>Simulates a squad you were in being disbanded.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('system_message', { mockSquadName: 'Server Maintenance Alert', mockRelatedUserName: 'System will be down for 1hr at midnight for an upgrade.' })}
          className="w-full px-4 py-2 bg-stone-600 hover:bg-stone-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: System Message
        </button>
        <p className='text-xs text-stone-800 mt-1 text-center'>Simulates receiving a system-wide message.</p>
      </div>

      {/* Batch 6: More Quest Related */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('quest_completed_community', { mockRelatedUserName: 'The People\'s Challenge' })}
          className="w-full px-4 py-2 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: Community Quest Completed
        </button>
        <p className='text-xs text-green-800 mt-1 text-center'>Simulates a community quest being completed.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('quest_newly_active', { mockRelatedUserName: 'Call to Adventure' })}
          className="w-full px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-md transition-colors"
        >
          Test: Quest Newly Active
        </button>
        <p className='text-xs text-yellow-600 mt-1 text-center'>Simulates a new quest becoming active.</p>
      </div>

      {/* Batch 7: Proposal Related */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('proposal_created', { mockRelatedUserName: 'Increase Staking Rewards', mockSquadName: 'DeFAI Core Contributors', mockBadgeName: 'CoreDev1' })}
          className="w-full px-4 py-2 bg-pink-700 hover:bg-pink-800 text-white font-semibold rounded-md transition-colors"
        >
          Test: New Proposal Created (You are Squad Member)
        </button>
        <p className='text-xs text-pink-800 mt-1 text-center'>Simulates a new proposal being created in your squad.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('proposal_passed', { mockRelatedUserName: 'Tokenomics Upgrade', mockSquadName: 'DeFAI Governance' })}
          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Proposal Passed (You are Squad Member)
        </button>
        <p className='text-xs text-green-700 mt-1 text-center'>Simulates a proposal in your squad passing.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('proposal_failed', { mockRelatedUserName: 'New Feature X', mockSquadName: 'DeFAI Labs' })}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Proposal Failed (You are Squad Member)
        </button>
        <p className='text-xs text-red-700 mt-1 text-center'>Simulates a proposal in your squad failing.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('proposal_executed', { mockRelatedUserName: 'Community Grant Allocation', mockSquadName: 'Treasury Council' })}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Proposal Executed (You are Squad Member)
        </button>
        <p className='text-xs text-blue-700 mt-1 text-center'>Simulates a passed proposal being executed.</p>
      </div>
      <div>
        <button 
          onClick={() => handleSendTestNotification('proposal_broadcasted', { mockRelatedUserName: 'Ecosystem Partnership', mockSquadName: 'Strategic Alliance Squad', mockBadgeName: 'CommunityLead' })}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: Proposal Broadcasted (Platform Wide)
        </button>
        <p className='text-xs text-purple-700 mt-1 text-center'>Simulates a significant proposal being broadcasted.</p>
      </div>
      {/* End of Batch 7 */}

      {/* Batch 8: Admin & Lifecycle Related */}
      <div>
        <button 
          onClick={() => handleSendTestNotification('new_squad_quest', { mockRelatedUserName: 'The Alpha Test Quest', mockSquadName: 'Early Birds Squad', mockBadgeName: 'QuestMasterX' })}
          className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-md transition-colors"
        >
          Test: New Squad Quest Available
        </button>
        <p className='text-xs text-orange-700 mt-1 text-center'>Simulates a new quest becoming available for your squad.</p>
      </div>
      {/* End of Batch 8 */}

    </div>
  );
} 