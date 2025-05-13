import { rabbitmqService } from './rabbitmq.service'; // Adjust path as needed
import { rabbitmqConfig } from '../config/rabbitmq.config'; // Adjust path as needed
// import User from '../models/user.model'; // Or your UserDocument + db connection
import { connectToDatabase, UserDocument } from '../lib/mongodb'; // Using UserDocument approach

/**
 * THIS IS AN ILLUSTRATIVE SERVICE.
 * You need to integrate the RabbitMQ publishing logic into your actual user tier update mechanism.
 */

/**
 * Example function that might update a user's tier in the database
 * and then publishes an event.
 *
 * @param {string} userId - The ID of the user (e.g., walletAddress or MongoDB _id).
 * @param {string} newTierName - The new tier the user has achieved (e.g., 'Gold', 'Platinum').
 * @param {any} [additionalTierData] - Any other relevant data about the tier or achievement.
 */
export async function updateUserTierAndPublishEvent(userId, newTierName, additionalTierData = {}) {
  console.log(`[UserTierService] Attempting to update tier for user ${userId} to ${newTierName}`);

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    // 1. Your actual logic to update the user's tier in the database
    // This might involve finding the user, checking conditions, and then updating a 'tier' field.
    // For illustration, let's assume a field `current_tier_name` is updated.
    const userUpdateResult = await usersCollection.updateOne(
      { walletAddress: userId }, // Assuming userId is walletAddress here, adjust if it's _id
      { $set: { current_tier_name: newTierName, tier_updated_at: new Date(), updatedAt: new Date() } }
    );

    if (userUpdateResult.matchedCount === 0) {
      console.warn(`[UserTierService] User ${userId} not found during tier update.`);
      return { success: false, message: 'User not found' };
    }
    if (userUpdateResult.modifiedCount === 0) {
      console.log(`[UserTierService] User ${userId} tier already set to ${newTierName} or no change made.`);
      // Still might want to publish if an event is expected regardless of DB change, but typically not for idempotent checks.
    }

    console.log(`[UserTierService] User ${userId} tier updated to ${newTierName} in database.`);

    // 2. Publish the user.tier.updated event
    const eventPayload = {
      userId: userId, // WalletAddress or MongoDB _id as string
      newTier: newTierName,
      // oldTier: previousTier, // Optional: if you want to include the previous tier
      timestamp: new Date().toISOString(),
      // Include any other relevant data from additionalTierData if needed
      ...additionalTierData,
    };

    await rabbitmqService.publishToExchange(
      rabbitmqConfig.eventsExchange,
      rabbitmqConfig.routingKeys.userTierUpdated,
      eventPayload
    );
    console.log('[UserTierService] Successfully published user.tier.updated event:', eventPayload);

    return { success: true, message: 'Tier updated and event published' };

  } catch (error) {
    console.error('[UserTierService] Error updating user tier and publishing event:', error);
    // Handle error appropriately (e.g., retry, log, but don't let it crash the calling process)
    return { success: false, message: 'Error processing tier update', error };
  }
}

// Example of how this might be called from an API route or another service:
// async function someProcessThatTriggersTierUpdate(userWalletAddress) {
//   // ... logic to determine if user qualifies for Gold tier ...
//   const qualifiesForGold = true; 
//   if (qualifiesForGold) {
//     await updateUserTierAndPublishEvent(userWalletAddress, 'Gold', { reason: 'Reached 5000 points' });
//   }
// } 