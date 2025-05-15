"use client";

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { SquadDocument, SquadInvitationDocument } from '@/lib/mongodb'; // Added SquadInvitationDocument
import UserAvatar from "@/components/UserAvatar";
import { QuestProgressData, useSquadQuestProgressStore } from '@/store/useQuestProgressStore'; // Adjust path
// import CommunityQuest from '@/models/communityQuest.model'; // This is the Mongoose model

// Updated interface to match the enriched data from the new API
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points?: number;
}
interface SquadDetailsData extends SquadDocument {
  membersFullDetails?: EnrichedSquadMember[]; // Changed back to optional since API might not always provide it
  leaderReferralCode?: string; // Add field for leader's referral code
}

// Define a Quest type for frontend usage based on expected fields from CommunityQuest model
interface Quest {
  _id: string; // Assuming _id is string on frontend after serialization
  title: string;
  description: string;
  goal_target: number;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
  };
  // Add other fields from CommunityQuest that are needed by the UI
}

// Example: Placeholder for a Quest Card component
const QuestCard = ({ quest, progress }: { quest: Quest, progress?: QuestProgressData }) => {
    const displayProgress = progress?.currentProgress || 0;
    const displayGoal = progress?.goalTarget || quest.goal_target;
    const percentage = displayGoal > 0 ? (displayProgress / displayGoal) * 100 : 0;

    return (
        <div style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <h4>{quest.title} (Squad Quest)</h4>
            <p>{quest.description}</p>
            <p>Goal: {displayGoal} {quest.goal_target_metadata?.currency || ''}</p>
            <p>Progress: {displayProgress}</p>
            <div style={{ width: '100%', backgroundColor: '#eee' }}>
                <div style={{ width: `${percentage}%`, backgroundColor: 'green', height: '20px' }}>
                    {Math.round(percentage)}%
                </div>
            </div>
            {progress?.updatedAt && <p><small>Last update: {new Date(progress.updatedAt).toLocaleTimeString()}</small></p>}
        </div>
    );
};

interface SquadDetailPageParams {
    squadId: string;
}

export default function SquadDetailPage({ params }: { params: SquadDetailPageParams | null }) { // Allow params to be null
    const squadId = params?.squadId; // Safely access squadId
    
    const [activeSquadQuests, setActiveSquadQuests] = useState<Quest[]>([]); 
    const [isLoadingQuests, setIsLoadingQuests] = useState(true);

    const squadProgressMap = useSquadQuestProgressStore((state) => 
        squadId ? state.squadQuestProgress[squadId] || {} : {}
    );

    useEffect(() => {
        const fetchActiveSquadQuests = async () => {
            if (!squadId) return;
            setIsLoadingQuests(true);
            try {
                const response = await fetch(`/api/quests?scope=squad&status=active`);
                if (!response.ok) throw new Error('Failed to fetch squad quests');
                const questsData = await response.json();
                setActiveSquadQuests(questsData.quests || questsData || []); 
            } catch (err) {
                console.error("Error fetching squad quests:", err);
            }
            setIsLoadingQuests(false);
        };

        fetchActiveSquadQuests();
    }, [squadId]);
    
    if (!squadId) {
        // This case should ideally be handled by Next.js routing if squadId is a required param
        // or show a specific component e.g. <SquadNotFound /> or <LoadingSquad />
        return <p>Loading squad information or Squad ID not found...</p>; 
    }

    return (
        <div>
            <h3>Active Squad Quests for Squad: {squadId}</h3>
            {isLoadingQuests && <p>Loading quests...</p>}
            {!isLoadingQuests && activeSquadQuests.length === 0 && <p>No active squad quests currently.</p>}
            {activeSquadQuests.map(quest => (
                <QuestCard key={quest._id} quest={quest} progress={squadProgressMap[quest._id]} />
            ))}
        </div>
    );
} 