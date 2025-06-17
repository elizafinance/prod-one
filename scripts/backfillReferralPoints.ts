// @ts-nocheck
import { connectToDatabase, UserDocument, ActionDocument } from '@/lib/mongodb';
import { AIR } from '@/config/points.config';

(async () => {
  console.log('Starting referral points back-fill...');
  const { db } = await connectToDatabase();
  const usersCollection = db.collection<UserDocument>('users');
  const actionsCollection = db.collection<ActionDocument>('actions');

  const cursor = usersCollection.find({ referralsMadeCount: { $gt: 0 } });
  let updatedCount = 0;
  while (await cursor.hasNext()) {
    const user = await cursor.next();
    if (!user) continue;
    const standardPointsShouldHave = (user.referralsMadeCount || 0) * AIR.REFERRAL_BONUS_FOR_REFERRER;

    // Sum of logged referral_bonus actions for this user
    const pipeline = [
      { $match: { walletAddress: user.walletAddress || user.xUserId || user._id.toString(), actionType: 'referral_bonus' } },
      { $group: { _id: null, total: { $sum: '$pointsAwarded' } } },
    ];
    const agg = await actionsCollection.aggregate(pipeline).toArray();
    const totalAwarded = agg[0]?.total || 0;

    if (totalAwarded < standardPointsShouldHave) {
      const missing = standardPointsShouldHave - totalAwarded;
      console.log(`User ${user.walletAddress || user._id.toString()} missing ${missing} referral points – crediting.`);
      const pointsService = await (await import('@/services/points.service')).getPointsService();
      if (user.walletAddress) {
        await pointsService.addPoints(user.walletAddress, missing, {
          reason: 'backfill:referral_points_shortfall',
          actionType: 'referral_bonus_backfill',
          emitEvent: false,
        });
      } else if (user._id) {
        await pointsService.addPointsByUserId(user._id.toString(), missing, {
          reason: 'backfill:referral_points_shortfall',
          actionType: 'referral_bonus_backfill',
          emitEvent: false,
        });
      }
      updatedCount += 1;
    }
  }
  console.log(`Back-fill complete. Updated ${updatedCount} users.`);
  process.exit(0);
})(); 