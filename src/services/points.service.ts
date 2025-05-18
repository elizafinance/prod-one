import { connectToDatabase, UserDocument, ActionDocument, SquadDocument } from '@/lib/mongodb';
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';
import { AIR, ACTION_TYPE_POINTS } from '@/config/points.config'; // Assuming AIR and ACTION_TYPE_POINTS are defined here
import { Db, ObjectId, ClientSession } from 'mongodb';
import { AIR_NFT_TIERS } from '@/config/airNft.config'; 
// Define the type based on the structure of AIR_NFT_TIERS elements
type AirNftTierConfig = typeof AIR_NFT_TIERS[number];
// import { hybridMint } from '@/lib/solana/hybridInteractions'; // Conceptual import for Solana interactions

export interface AwardPointsOptions {
  reason: string; // e.g., 'badge:generous_donor', 'admin:set_points', 'action:followed_on_x'
  metadata?: Record<string, any>; // Any additional data to log with the action
  emitEvent?: boolean; // Default true, whether to publish to RabbitMQ
  allowNegativeTotal?: boolean; // Default false, prevent points from going below zero unless specified
  actionType?: string; // The specific action key, e.g., 'followed_on_x', for logging in completedActions
  dbSession?: ClientSession; // For transactional operations
}

/**
 * Service for managing user points and related actions.
 */
export class PointsService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Adds a delta of points to a user's total.
   * @param walletAddress The user's wallet address.
   * @param pointsDelta The number of points to add (can be negative).
   * @param options Options for awarding points.
   */
  async addPoints(walletAddress: string, pointsDelta: number, options: AwardPointsOptions): Promise<UserDocument | null> {
    if (!walletAddress) throw new Error('Wallet address is required.');
    if (typeof pointsDelta !== 'number' || isNaN(pointsDelta)) throw new Error('pointsDelta must be a valid number.');

    const { 
        reason, 
        metadata = {}, 
        emitEvent = true, 
        allowNegativeTotal = false, 
        actionType, 
        dbSession 
    } = options;

    const usersCollection = this.db.collection<UserDocument>('users');
    const actionsCollection = this.db.collection<ActionDocument>('actions');
    const squadsCollection = this.db.collection<SquadDocument>('squads');

    // 1. Fetch the user
    const user = await usersCollection.findOne({ walletAddress }, { session: dbSession });
    if (!user) {
      console.warn(`[PointsService] User not found for wallet: ${walletAddress}. Cannot add points.`);
      return null;
    }

    // 2. Calculate new points total
    const currentPoints = user.points || 0;
    let newPointsTotal = currentPoints + pointsDelta;

    if (!allowNegativeTotal && newPointsTotal < 0) {
      newPointsTotal = 0; // Prevent points from going below zero
    }

    // 3. Prepare user update
    const userUpdate: any = { $set: { points: newPointsTotal, updatedAt: new Date() } };
    if (pointsDelta > 0 && actionType && !user.completedActions?.includes(actionType)) {
      userUpdate.$addToSet = { completedActions: actionType };
    }
    
    // TODO: Recompute highestAirdropTierLabel, badges based on newPointsTotal (complex logic, defer)

    // 4. Perform user update
    await usersCollection.updateOne({ walletAddress }, userUpdate, { session: dbSession });

    // 5. Log the action
    const actionLog: ActionDocument = {
      walletAddress,
      actionType: actionType || reason, // Use actionType if specific, otherwise reason
      pointsAwarded: pointsDelta,
      timestamp: new Date(),
      notes: reason, 
      metadata: metadata,
    };
    await actionsCollection.insertOne(actionLog, { session: dbSession });

    // 6. Update squad total points (if applicable and pointsDelta is positive)
    if (user.squadId && pointsDelta !== 0) { // Update if points change, positive or negative
      const squadUpdateResult = await squadsCollection.updateOne(
        { squadId: user.squadId },
        { 
          $inc: { totalSquadPoints: pointsDelta },
          $set: { updatedAt: new Date() }
        },
        { session: dbSession }
      );
      if (squadUpdateResult.modifiedCount > 0 && emitEvent) {
        try {
          await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            rabbitmqConfig.routingKeys.squadPointsUpdated,
            {
              squadId: user.squadId,
              pointsChange: pointsDelta,
              reason: `points_service:${reason}`,
              timestamp: new Date().toISOString(),
              responsibleUserId: walletAddress,
            }
          );
        } catch (publishError) {
          console.error(`[PointsService] Failed to publish squad.points.updated for squad ${user.squadId}:`, publishError);
        }
      }
    }

    // 7. Emit event for user points updated
    if (emitEvent) {
      try {
        await rabbitmqService.publishToExchange(
          rabbitmqConfig.eventsExchange, 
          rabbitmqConfig.routingKeys.userPointsUpdated, // Ensure this routing key is defined in rabbitmqConfig
          {
            walletAddress,
            oldPoints: currentPoints,
            newPoints: newPointsTotal,
            pointsChange: pointsDelta,
            reason: reason,
            timestamp: new Date().toISOString(),
            metadata: metadata
          }
        );
      } catch (publishError) {
        console.error(`[PointsService] Failed to publish user.points.updated for ${walletAddress}:`, publishError);
      }
    }
    
    // 8. Return updated user (or fetch again if needed)
    // For simplicity, returning a partial update. A full re-fetch might be better.
    return { ...user, points: newPointsTotal, completedActions: userUpdate.$addToSet ? [...(user.completedActions || []), actionType] : user.completedActions } as UserDocument;
  }

  /**
   * Sets a user's points to an absolute value.
   * This internally calls addPoints with the calculated delta.
   * @param walletAddress The user's wallet address.
   * @param absolutePoints The absolute number of points to set.
   * @param options Options for awarding points.
   */
  async setPoints(walletAddress: string, absolutePoints: number, options: AwardPointsOptions): Promise<UserDocument | null> {
    if (!walletAddress) throw new Error('Wallet address is required.');
    if (typeof absolutePoints !== 'number' || isNaN(absolutePoints) || absolutePoints < 0) {
      throw new Error('absolutePoints must be a valid non-negative number.');
    }

    const usersCollection = this.db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ walletAddress }, { session: options.dbSession });
    if (!user) {
      console.warn(`[PointsService] User not found for wallet: ${walletAddress}. Cannot set points.`);
      return null;
    }

    const currentPoints = user.points || 0;
    const pointsDelta = absolutePoints - currentPoints;

    return this.addPoints(walletAddress, pointsDelta, options);
  }
  
  /**
   * Converts a user's AIR points into an AIR NFT of a specific tier.
   * This involves checking eligibility and then (conceptually) minting the NFT on-chain.
   * @param walletAddress The user's wallet address.
   * @param requestedTierId The ID of the AIR NFT tier the user wants to mint.
   * @param options Options for the operation (e.g., dbSession).
   */
  async convertPointsToAirNft(
    walletAddress: string, 
    requestedTierId: number,
    options?: { dbSession?: ClientSession }
  ): Promise<{ success: boolean; message: string; txSignature?: string; nftId?: string }> {
    if (!walletAddress) throw new Error('Wallet address is required.');

    const usersCollection = this.db.collection<UserDocument>('users');

    // 1. Find the requested tier configuration
    const tierConfig: AirNftTierConfig | undefined = AIR_NFT_TIERS.find(t => t.tier === requestedTierId);
    if (!tierConfig) {
      return { success: false, message: `Invalid AIR NFT tier ID: ${requestedTierId}` };
    }

    // 2. Fetch user's current AIR points
    const user = await usersCollection.findOne({ walletAddress }, { session: options?.dbSession });
    if (!user) {
      return { success: false, message: 'User not found.' };
    }
    const currentUserPoints = user.points || 0;

    // 3. Check if user has enough points
    if (currentUserPoints < tierConfig.pointsPerNft) {
      return {
        success: false,
        message: `Insufficient AIR points. Tier ${tierConfig.name} requires ${tierConfig.pointsPerNft}, you have ${currentUserPoints}.`,
      };
    }

    // 4. (Conceptual) On-chain interaction: Mint the AIR NFT via MPL-Hybrid
    // This would involve calling a Solana transaction signing and sending utility.
    // const mintResult = await hybridMint(walletAddress, tierConfig, umiSigner); // Conceptual
    const simulatedTxSignature = `sim_tx_${Date.now()}`;
    const simulatedNftId = `sim_nft_${tierConfig.name.toLowerCase()}_${Date.now()}`;

    console.log(`[PointsService] Conceptual AIR NFT Mint for ${walletAddress}: Tier ${tierConfig.name}, Signature: ${simulatedTxSignature}`);

    // 5. Deduct points from the user
    const pointsToDeduct = tierConfig.pointsPerNft;
    await this.addPoints(walletAddress, -pointsToDeduct, {
      reason: `air_nft_minted:${tierConfig.name}`,
      metadata: { tier: tierConfig.tier, nftId: simulatedNftId, tx: simulatedTxSignature },
      allowNegativeTotal: false, 
      emitEvent: true,
      actionType: 'air_nft_mint',
      dbSession: options?.dbSession,
    });

    // 6. Optionally, record the NFT mint
    // Example: await this.db.collection('userNfts').insertOne({ walletAddress, nftId: simulatedNftId, ... });

    // 7. Publish event for AIR NFT minted
    if (rabbitmqConfig.routingKeys.airNftMinted) { // Check if routing key is defined
        try {
            await rabbitmqService.publishToExchange(
              rabbitmqConfig.eventsExchange,
              rabbitmqConfig.routingKeys.airNftMinted,
              {
                walletAddress,
                tierId: tierConfig.tier,
                tierName: tierConfig.name,
                nftId: simulatedNftId,
                pointsSpent: pointsToDeduct,
                txSignature: simulatedTxSignature,
                timestamp: new Date().toISOString(),
              }
            );
          } catch (publishError) {
            console.error(`[PointsService] Failed to publish air.nft.minted for ${walletAddress}:`, publishError);
          }
    } else {
        console.warn('[PointsService] rabbitmqConfig.routingKeys.airNftMinted is not defined. Skipping event publication.');
    }
    

    return {
      success: true,
      message: `Successfully minted AIR NFT Tier ${tierConfig.name}! Points deducted: ${pointsToDeduct}.`,
      txSignature: simulatedTxSignature,
      nftId: simulatedNftId,
    };
  }
}

// Helper to get an instance of the service
// This would typically be instantiated once per request or application lifecycle
let pointsServiceInstance: PointsService;

export async function getPointsService(): Promise<PointsService> {
  if (!pointsServiceInstance) {
    const { db } = await connectToDatabase();
    pointsServiceInstance = new PointsService(db);
  }
  return pointsServiceInstance;
} 