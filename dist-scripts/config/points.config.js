var _a;
export const AIR = {
    // The general label for points, defaults to 'AIR' if not set in .env
    LABEL: (_a = process.env.TOKEN_LABEL_POINTS) !== null && _a !== void 0 ? _a : 'AIR',
    // Points for initial actions
    INITIAL_LOGIN: 100, // For first-time login with X
    WALLET_CONNECT_FIRST_TIME: 100, // For connecting a wallet for the first time
    // Points for social sharing and engagement
    PROFILE_SHARE_ON_X: 50, // For sharing their profile on X
    AIRDROP_RESULT_SHARE_ON_X: 50, // For sharing airdrop results on X (distinct from general share)
    FOLLOW_ON_X: 30, // For following the project's X account
    JOIN_TELEGRAM: 25, // For joining the project's Telegram group
    // Points for referrals
    REFERRAL_BONUS_FOR_REFERRER: 20, // Standard points for the referrer
    // POINTS_FOR_BEING_REFERRED: 10, // Optional: Points for the new user who was referred (currently unused)
    // Points for specific achievements/badges
    GENEROUS_DONOR_BADGE_POINTS: 250, // Points awarded with the generous donor badge
    // Airdrop Tier related points (these might be milestone rewards rather than direct point awards)
    // These might be handled differently, e.g., as badge criteria or direct airdrop amounts
    // For now, listing them if they directly grant AIR points
    AIRDROP_TIER_BRONZE_POINTS: 50,
    AIRDROP_TIER_SILVER_POINTS: 150,
    AIRDROP_TIER_GOLD_POINTS: 300,
    AIRDROP_TIER_DIAMOND_POINTS: 500,
    AIRDROP_TIER_MASTER_POINTS: 1000,
    AIRDROP_TIER_GRANDMASTER_POINTS: 5000,
    AIRDROP_TIER_LEGEND_POINTS: 10000,
};
// It might be useful to have a mapping for action types to points
// This can be derived from the AIR object or defined separately if the structure is very different
export const ACTION_TYPE_POINTS = {
    'initial_connection': AIR.INITIAL_LOGIN,
    'wallet_connected_first_time': AIR.WALLET_CONNECT_FIRST_TIME,
    'shared_milestone_profile_on_x': AIR.PROFILE_SHARE_ON_X, // Assuming this ID maps to profile share
    'shared_on_x': AIR.AIRDROP_RESULT_SHARE_ON_X, // Generic share, might need clarification
    'followed_on_x': AIR.FOLLOW_ON_X,
    'joined_telegram': AIR.JOIN_TELEGRAM,
    'referral_bonus': AIR.REFERRAL_BONUS_FOR_REFERRER,
    // 'airdrop_tier_bronze': AIR.AIRDROP_TIER_BRONZE_POINTS, // These are more like tier rewards than direct action points
    // ... and so on for other specific actions if they map directly to keys used in `completedActions`
};
