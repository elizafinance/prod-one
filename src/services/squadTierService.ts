import { connectToDatabase, SquadDocument } from '@/lib/mongodb';
import { Collection } from 'mongodb';

// Get tier requirements from environment variables
const TIER_1_POINTS = parseInt(process.env.TIER_1_POINTS || '1000');
const TIER_2_POINTS = parseInt(process.env.TIER_2_POINTS || '5000');
const TIER_3_POINTS = parseInt(process.env.TIER_3_POINTS || '10000');
const TIER_1_MAX_MEMBERS = parseInt(process.env.TIER_1_MAX_MEMBERS || '10');
const TIER_2_MAX_MEMBERS = parseInt(process.env.TIER_2_MAX_MEMBERS || '50');
const TIER_3_MAX_MEMBERS = parseInt(process.env.TIER_3_MAX_MEMBERS || '100');

export interface TierInfo {
  tier: number;
  maxMembers: number;
  minPoints: number;
}

export class SquadTierService {
  /**
   * Calculate the appropriate tier based on squad points
   */
  static calculateTier(totalSquadPoints: number): TierInfo {
    if (totalSquadPoints >= TIER_3_POINTS) {
      return { tier: 3, maxMembers: TIER_3_MAX_MEMBERS, minPoints: TIER_3_POINTS };
    }
    if (totalSquadPoints >= TIER_2_POINTS) {
      return { tier: 2, maxMembers: TIER_2_MAX_MEMBERS, minPoints: TIER_2_POINTS };
    }
    if (totalSquadPoints >= TIER_1_POINTS) {
      return { tier: 1, maxMembers: TIER_1_MAX_MEMBERS, minPoints: TIER_1_POINTS };
    }
    return { tier: 0, maxMembers: 0, minPoints: 0 }; // Not eligible
  }

  /**
   * Check and update a squad's tier if needed
   * Returns true if tier was updated, false otherwise
   */
  static async checkAndUpdateSquadTier(squadId: string): Promise<{
    updated: boolean;
    oldTier?: number;
    newTier?: number;
    oldMaxMembers?: number;
    newMaxMembers?: number;
  }> {
    try {
      const { db } = await connectToDatabase();
      const squadsCollection = db.collection<SquadDocument>('squads');

      // Get current squad data
      const squad = await squadsCollection.findOne({ squadId });
      if (!squad) {
        console.error(`[SquadTierService] Squad ${squadId} not found`);
        return { updated: false };
      }

      const currentTier = squad.tier || 0;
      const currentMaxMembers = squad.maxMembers || 0;
      
      // Calculate what tier the squad should be
      const calculatedTierInfo = this.calculateTier(squad.totalSquadPoints || 0);
      
      // Check if upgrade is needed
      if (calculatedTierInfo.tier > currentTier) {
        // Update squad tier and max members
        const updateResult = await squadsCollection.updateOne(
          { squadId },
          {
            $set: {
              tier: calculatedTierInfo.tier,
              maxMembers: calculatedTierInfo.maxMembers,
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          console.log(
            `[SquadTierService] Squad ${squadId} upgraded from tier ${currentTier} to ${calculatedTierInfo.tier}, ` +
            `max members increased from ${currentMaxMembers} to ${calculatedTierInfo.maxMembers}`
          );
          
          return {
            updated: true,
            oldTier: currentTier,
            newTier: calculatedTierInfo.tier,
            oldMaxMembers: currentMaxMembers,
            newMaxMembers: calculatedTierInfo.maxMembers
          };
        }
      }

      return { updated: false };
    } catch (error) {
      console.error('[SquadTierService] Error updating squad tier:', error);
      return { updated: false };
    }
  }

  /**
   * Batch check and update all squads that need tier upgrades
   * This could be run as a cron job
   */
  static async updateAllSquadTiers(): Promise<{
    totalChecked: number;
    totalUpdated: number;
    updates: Array<{ squadId: string; oldTier: number; newTier: number }>;
  }> {
    try {
      const { db } = await connectToDatabase();
      const squadsCollection = db.collection<SquadDocument>('squads');

      // Get all squads
      const squads = await squadsCollection.find({}).toArray();
      
      let totalChecked = 0;
      let totalUpdated = 0;
      const updates: Array<{ squadId: string; oldTier: number; newTier: number }> = [];

      for (const squad of squads) {
        totalChecked++;
        
        const currentTier = squad.tier || 0;
        const calculatedTierInfo = this.calculateTier(squad.totalSquadPoints || 0);
        
        // Only update if tier should increase
        if (calculatedTierInfo.tier > currentTier) {
          const updateResult = await squadsCollection.updateOne(
            { squadId: squad.squadId },
            {
              $set: {
                tier: calculatedTierInfo.tier,
                maxMembers: calculatedTierInfo.maxMembers,
                updatedAt: new Date()
              }
            }
          );

          if (updateResult.modifiedCount > 0) {
            totalUpdated++;
            updates.push({
              squadId: squad.squadId,
              oldTier: currentTier,
              newTier: calculatedTierInfo.tier
            });
          }
        }
      }

      console.log(
        `[SquadTierService] Batch update complete: ${totalChecked} checked, ${totalUpdated} updated`
      );

      return { totalChecked, totalUpdated, updates };
    } catch (error) {
      console.error('[SquadTierService] Error in batch update:', error);
      return { totalChecked: 0, totalUpdated: 0, updates: [] };
    }
  }

  /**
   * Get tier progress information for a squad
   */
  static async getSquadTierProgress(squadId: string): Promise<{
    currentTier: number;
    currentMaxMembers: number;
    totalPoints: number;
    nextTier: number | null;
    pointsToNextTier: number | null;
    nextTierMaxMembers: number | null;
  } | null> {
    try {
      const { db } = await connectToDatabase();
      const squadsCollection = db.collection<SquadDocument>('squads');

      const squad = await squadsCollection.findOne({ squadId });
      if (!squad) return null;

      const currentTier = squad.tier || 0;
      const totalPoints = squad.totalSquadPoints || 0;

      // Determine next tier info
      let nextTier = null;
      let pointsToNextTier = null;
      let nextTierMaxMembers = null;

      if (currentTier < 1 && totalPoints < TIER_1_POINTS) {
        nextTier = 1;
        pointsToNextTier = TIER_1_POINTS - totalPoints;
        nextTierMaxMembers = TIER_1_MAX_MEMBERS;
      } else if (currentTier === 1 && totalPoints < TIER_2_POINTS) {
        nextTier = 2;
        pointsToNextTier = TIER_2_POINTS - totalPoints;
        nextTierMaxMembers = TIER_2_MAX_MEMBERS;
      } else if (currentTier === 2 && totalPoints < TIER_3_POINTS) {
        nextTier = 3;
        pointsToNextTier = TIER_3_POINTS - totalPoints;
        nextTierMaxMembers = TIER_3_MAX_MEMBERS;
      }

      return {
        currentTier,
        currentMaxMembers: squad.maxMembers || 0,
        totalPoints,
        nextTier,
        pointsToNextTier,
        nextTierMaxMembers
      };
    } catch (error) {
      console.error('[SquadTierService] Error getting tier progress:', error);
      return null;
    }
  }
}