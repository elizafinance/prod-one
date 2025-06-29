# Squad Tier System Documentation

## Overview

The squad tier system allows squads to upgrade their member capacity based on their total accumulated points. This system includes both automatic upgrades (when users earn points) and manual upgrade options for squad leaders.

## Tier Structure

| Tier | Required Points | Max Members |
|------|----------------|-------------|
| 1    | 1,000          | 10          |
| 2    | 5,000          | 50          |
| 3    | 10,000         | 100         |

*Note: These values are configurable via environment variables.*

## How It Works

### Automatic Tier Upgrades
1. When any squad member earns points, the squad's total points increase
2. The system automatically checks if the squad qualifies for a tier upgrade
3. If eligible, the squad is upgraded immediately and the member limit increases

### Manual Tier Check & Upgrade
Squad leaders can:
1. View their squad's current tier and progress on the squad details page
2. See how many points are needed for the next tier
3. Click "Upgrade Tier" button when eligible (appears when squad has enough points)

## Implementation Details

### Key Components

1. **SquadTierService** (`/src/services/squadTierService.ts`)
   - Calculates appropriate tier based on points
   - Handles tier upgrades
   - Provides tier progress information

2. **Points Service Integration** (`/src/services/points.service.ts`)
   - Automatically checks for tier upgrades when points are added
   - Only checks on positive point changes for efficiency

3. **API Endpoints**
   - `GET /api/squads/check-tier?squadId=xxx` - Check current tier and progress
   - `POST /api/squads/check-tier` - Manually trigger tier upgrade (leader only)
   - `POST /api/admin/squads/update-tiers` - Batch update all squads (admin only)

4. **UI Components** (`/src/app/squads/[squadId]/page.tsx`)
   - Displays current tier and member limit
   - Shows progress to next tier
   - Provides upgrade button when eligible

### Environment Variables

```env
TIER_1_POINTS=1000
TIER_1_MAX_MEMBERS=10
TIER_2_POINTS=5000
TIER_2_MAX_MEMBERS=50
TIER_3_POINTS=10000
TIER_3_MAX_MEMBERS=100
```

## User Experience

### For Squad Members
- See current squad tier and member capacity
- View progress toward next tier
- Understand how their points contribute to squad growth

### For Squad Leaders
- All member benefits plus:
- Manually trigger tier upgrades when eligible
- Better visibility into squad growth potential

## Migration for Existing Squads

For squads created before this system:
1. Run the admin batch update endpoint to check all squads
2. Or squad leaders can manually trigger a tier check
3. The system will upgrade eligible squads to their appropriate tier

## Technical Notes

1. **Performance**: Tier checks only occur on positive point changes to minimize database operations
2. **Consistency**: Uses MongoDB transactions to ensure tier and member limit are updated atomically
3. **Scalability**: Batch update endpoint processes squads efficiently for large-scale migrations
4. **Error Handling**: Graceful fallbacks if tier check fails; doesn't interrupt point operations

## Future Enhancements

Potential improvements to consider:
- Email notifications when squads upgrade tiers
- Tier badges or visual indicators
- Tier-based benefits beyond member limits
- Downgrade protection (prevent tier loss if points decrease)
- Historical tier progression tracking