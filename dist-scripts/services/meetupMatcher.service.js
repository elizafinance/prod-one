import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
const EARTH_RADIUS_KM = 6371;
/**
 * Calculates the distance between two geographical coordinates using the Haversine formula.
 * @param lat1 Latitude of the first point.
 * @param lon1 Longitude of the first point.
 * @param lat2 Latitude of the second point.
 * @param lon2 Longitude of the second point.
 * @returns The distance in kilometers.
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const toRadians = (degrees) => degrees * (Math.PI / 180);
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
    var _a, _b;
    console.log('[MeetupMatcherService] Starting to process pending meetup check-ins...');
    let processedGroups = 0;
    let successfulMeetups = 0;
    try {
        const { db } = await connectToDatabase();
        const meetupCheckInsCollection = db.collection('meetup_check_ins');
        // Use the defined interface for type safety with direct collection access
        const communityQuestsCollection = db.collection('communityquests');
        const questContributionsCollection = db.collection('questcontributions');
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
            const proximityMeters = ((_a = quest.goal_target_metadata) === null || _a === void 0 ? void 0 : _a.proximity_meters) || 100;
            const timeWindowMinutes = ((_b = quest.goal_target_metadata) === null || _b === void 0 ? void 0 : _b.time_window_minutes) || 10;
            const pendingCheckInsForQuest = await meetupCheckInsCollection.find({
                questId: quest._id, // This assumes quest._id is compatible with MeetupCheckInDocument.questId type (ObjectId)
                status: 'pending_match'
            }).sort({ squadId: 1, serverTimestamp: 1 }).toArray();
            if (pendingCheckInsForQuest.length < minMembers) {
                continue;
            }
            const checkInsBySquad = {};
            for (const checkIn of pendingCheckInsForQuest) {
                if (!checkInsBySquad[checkIn.squadId]) {
                    checkInsBySquad[checkIn.squadId] = [];
                }
                checkInsBySquad[checkIn.squadId].push(checkIn);
            }
            for (const squadId in checkInsBySquad) {
                let squadCheckIns = checkInsBySquad[squadId]; // Make it mutable for potential filtering if needed later
                if (squadCheckIns.length < minMembers)
                    continue;
                console.log(`[MeetupMatcherService] Evaluating squad ${squadId} for quest ${quest._id} with ${squadCheckIns.length} pending check-ins.`);
                const usersInSuccessfulMeetupThisRun = new Set();
                for (let i = 0; i < squadCheckIns.length; i++) {
                    const currentCheckIn = squadCheckIns[i];
                    if (usersInSuccessfulMeetupThisRun.has(currentCheckIn.userId))
                        continue;
                    const potentialGroup = [currentCheckIn];
                    const groupUserIds = new Set([currentCheckIn.userId]);
                    for (let j = i + 1; j < squadCheckIns.length; j++) {
                        const otherCheckIn = squadCheckIns[j];
                        if (usersInSuccessfulMeetupThisRun.has(otherCheckIn.userId))
                            continue;
                        if (groupUserIds.has(otherCheckIn.userId))
                            continue;
                        const timeDiffMinutes = Math.abs(currentCheckIn.serverTimestamp.getTime() - otherCheckIn.serverTimestamp.getTime()) / (1000 * 60);
                        if (timeDiffMinutes > timeWindowMinutes)
                            continue;
                        const distanceKm = calculateHaversineDistance(currentCheckIn.latitude, currentCheckIn.longitude, otherCheckIn.latitude, otherCheckIn.longitude);
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
                            .filter((id) => id !== undefined);
                        await meetupCheckInsCollection.updateMany({ _id: { $in: checkInIdsToUpdate } }, { $set: { status: 'matched', matchGroupId: matchGroupId } });
                        potentialGroup.forEach(p => usersInSuccessfulMeetupThisRun.add(p.userId));
                        await questContributionsCollection.updateOne({ quest_id: quest._id, user_id: squadId, squad_id: squadId }, {
                            $inc: { metric_value: 1 },
                            $setOnInsert: {
                                quest_id: quest._id,
                                user_id: squadId,
                                squad_id: squadId,
                                created_ts: new Date()
                            },
                            $set: { last_contribution_ts: new Date() }
                        }, { upsert: true });
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
    }
    catch (error) {
        console.error('[MeetupMatcherService] Error during processing:', error);
        return { processedGroups, successfulMeetups: 0, error: error.message };
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
