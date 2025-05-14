import { NextResponse } from 'next/server';
export async function GET() {
    // Get tier point requirements from environment variables with defaults
    const TIER_1_POINTS = parseInt(process.env.TIER_1_POINTS || '1000');
    const TIER_2_POINTS = parseInt(process.env.TIER_2_POINTS || '5000');
    const TIER_3_POINTS = parseInt(process.env.TIER_3_POINTS || '10000');
    const TIER_1_MAX_MEMBERS = parseInt(process.env.TIER_1_MAX_MEMBERS || '10');
    const TIER_2_MAX_MEMBERS = parseInt(process.env.TIER_2_MAX_MEMBERS || '50');
    const TIER_3_MAX_MEMBERS = parseInt(process.env.TIER_3_MAX_MEMBERS || '100');
    // Return the tier requirements for client-side display
    return NextResponse.json({
        tiers: [
            {
                tier: 1,
                minPoints: TIER_1_POINTS,
                maxMembers: TIER_1_MAX_MEMBERS
            },
            {
                tier: 2,
                minPoints: TIER_2_POINTS,
                maxMembers: TIER_2_MAX_MEMBERS
            },
            {
                tier: 3,
                minPoints: TIER_3_POINTS,
                maxMembers: TIER_3_MAX_MEMBERS
            }
        ],
        minRequiredPoints: TIER_1_POINTS
    });
}
