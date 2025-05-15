import { connectToDatabase, MeetupCheckInDocument } from '@/lib/mongodb';
import CommunityQuestModelFromJS from '@/models/communityQuest.model.js'; // .js for mongoose model typically
import QuestContributionModelFromJS from '@/models/questContribution.model.js';
import { ObjectId, Collection } from 'mongodb';

// Since the models are .js, we might not get strong typing directly from them for collection generic types.
// We will rely on the interfaces from mongodb.ts where possible for type safety with db operations.
// If you have .d.ts files for your Mongoose models, you could use those types.

// Define a type for the CommunityQuest document structure if not importing a typed model
interface CommunityQuestDBSchema {
    _id: ObjectId;
    title: string;
    status: string;
    scope: string;
    goal_type: string;
    goal_target: number;
    goal_target_metadata?: {
        tier_name?: string;
        currency?: string;
        proximity_meters?: number;
        time_window_minutes?: number;
    };
    start_ts: Date;
    end_ts: Date;
    // Add other fields as necessary from your actual schema
}

// Define a type for QuestContribution document structure
interface QuestContributionDBSchema {
    _id?: ObjectId;
    quest_id: ObjectId;
    user_id: string;
    squad_id?: string | null;
    metric_value: number;
    last_contribution_ts?: Date;
    created_ts?: Date;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the distance between two geographical coordinates using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */
function calculateHaversineDistance(
    lat1: number, lon1: number, 
    lat2: number, lon2: number
): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    lat1 = toRadians(lat1);
    lat2 = toRadians(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}

export async function processPendingMeetupCheckIns() {
    console.log('[MeetupMatcherService] Starting to process pending meetup check-ins...');
    let processedGroups = 0;
    let successfulMeetups = 0;

    try {
        const { db } = await connectToDatabase();
        const meetupCheckInsCollection = db.collection<MeetupCheckInDocument>('meetup_check_ins');
        // Use the defined interface for type safety with direct collection access
        const communityQuestsCollection = db.collection<CommunityQuestDBSchema>('communityquests'); 
        const questContributionsCollection = db.collection<QuestContributionDBSchema>('questcontributions');

        const activeMeetupQuests = await communityQuestsCollection.find({
            status: 'active',
            scope: 'squad',
            goal_type: 'squad_meetup',
            start_ts: { $lte: new Date() },
            end_ts: { $gte: new Date() }
        }).toArray();

        if (activeMeetupQuests.length === 0) {
            console.log('[MeetupMatcherService] No active squad meetup quests found.');
            return { processedGroups, successfulMeetups };
        }

        for (const quest of activeMeetupQuests) {
            console.log(`[MeetupMatcherService] Processing quest: ${quest.title} (ID: ${quest._id})`);
            const minMembers = quest.goal_target;
            const proximityMeters = quest.goal_target_metadata?.proximity_meters || 100;
            const timeWindowMinutes = quest.goal_target_metadata?.time_window_minutes || 10;

            const pendingCheckInsForQuest = await meetupCheckInsCollection.find({
                questId: quest._id, // This assumes quest._id is compatible with MeetupCheckInDocument.questId type (ObjectId)
                status: 'pending_match'
            }).sort({ squadId: 1, serverTimestamp: 1 }).toArray();

            if (pendingCheckInsForQuest.length < minMembers) {
                continue;
            }

            const checkInsBySquad: { [squadId: string]: MeetupCheckInDocument[] } = {};
            for (const checkIn of pendingCheckInsForQuest) {
                if (!checkInsBySquad[checkIn.squadId]) {
                    checkInsBySquad[checkIn.squadId] = [];
                }
                checkInsBySquad[checkIn.squadId].push(checkIn);
            }

            for (const squadId in checkInsBySquad) {
                let squadCheckIns = checkInsBySquad[squadId]; // Make it mutable for potential filtering if needed later
                if (squadCheckIns.length < minMembers) continue;

                console.log(`[MeetupMatcherService] Evaluating squad ${squadId} for quest ${quest._id} with ${squadCheckIns.length} pending check-ins.`);
                
                const usersInSuccessfulMeetupThisRun = new Set<string>();

                for (let i = 0; i < squadCheckIns.length; i++) {
                    const currentCheckIn = squadCheckIns[i];
                    if (usersInSuccessfulMeetupThisRun.has(currentCheckIn.userId)) continue;

                    const potentialGroup: MeetupCheckInDocument[] = [currentCheckIn];
                    const groupUserIds = new Set<string>([currentCheckIn.userId]);

                    for (let j = i + 1; j < squadCheckIns.length; j++) {
                        const otherCheckIn = squadCheckIns[j];
                        if (usersInSuccessfulMeetupThisRun.has(otherCheckIn.userId)) continue;
                        if (groupUserIds.has(otherCheckIn.userId)) continue;

                        const timeDiffMinutes = Math.abs(currentCheckIn.serverTimestamp.getTime() - otherCheckIn.serverTimestamp.getTime()) / (1000 * 60);
                        if (timeDiffMinutes > timeWindowMinutes) continue;

                        const distanceKm = calculateHaversineDistance(
                            currentCheckIn.latitude, currentCheckIn.longitude,
                            otherCheckIn.latitude, otherCheckIn.longitude
                        );
                        const distanceMeters = distanceKm * 1000;

                        if (distanceMeters <= proximityMeters) {
                            potentialGroup.push(otherCheckIn);
                            groupUserIds.add(otherCheckIn.userId);
                        }
                    }

                    if (groupUserIds.size >= minMembers) {
                        console.log(`[MeetupMatcherService] Successful meetup found for squad ${squadId}, quest ${quest._id} with ${groupUserIds.size} members.`);
                        successfulMeetups++;
                        const matchGroupId = new ObjectId().toHexString();

                        const checkInIdsToUpdate = potentialGroup
                            .map(p => p._id)
                            .filter((id): id is ObjectId => id !== undefined);

                        await meetupCheckInsCollection.updateMany(
                            { _id: { $in: checkInIdsToUpdate } }, 
                            { $set: { status: 'matched', matchGroupId: matchGroupId } }
                        );
                        
                        potentialGroup.forEach(p => usersInSuccessfulMeetupThisRun.add(p.userId));

                        await questContributionsCollection.updateOne(
                            { quest_id: quest._id, user_id: squadId, squad_id: squadId },
                            { 
                                $inc: { metric_value: 1 },
                                $setOnInsert: { 
                                    quest_id: quest._id,
                                    user_id: squadId,
                                    squad_id: squadId,
                                    created_ts: new Date()
                                },
                                $set: { last_contribution_ts: new Date() }
                            },
                            { upsert: true }
                        );
                        console.log(`[MeetupMatcherService] QuestContribution created/updated for squad ${squadId}, quest ${quest._id}.`);
                        
                        processedGroups++;
                        console.log(`[MeetupMatcherService] Users in this successful meetup: ${Array.from(groupUserIds).join(", ")}`);
                        // No break here, continue checking currentCheckIn[i+1] etc for other potential groups
                        // if the first group didn't include everyone.
                    }
                } 
            }
        }

        console.log(`[MeetupMatcherService] Finished processing. Matched groups: ${processedGroups}, Successful individual meetups recorded: ${successfulMeetups}`);
        return { processedGroups, successfulMeetups };

    } catch (error) {
        console.error('[MeetupMatcherService] Error during processing:', error);
        return { processedGroups, successfulMeetups: 0, error: (error as Error).message };
    }
}

/*
async function runMatcher() {
    const result = await processPendingMeetupCheckIns();
    console.log("Matcher run result:", result);
}

if (require.main === module) { 
    runMatcher().catch(console.error);
}
*/ 