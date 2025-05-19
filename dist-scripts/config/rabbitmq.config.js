export const rabbitmqConfig = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    eventsExchange: 'defai.events',
    routingKeys: {
        userReferredSuccess: 'user.referred.success', // When a referral is successfully processed
        userTierUpdated: 'user.tier.updated', // When a user's airdrop tier changes
        userSpendRecorded: 'user.spend.recorded', // When user spend is recorded for quests
        squadPointsUpdated: 'squad.points.updated', // When a squad's total points change
        userPointsUpdated: 'user.points.updated', // When a user's points change
        questActivated: 'quest.status.activated', // When a quest becomes active
        questExpired: 'quest.status.expired', // When a quest expires
        questCompletedManually: 'quest.status.completed', // When a quest is manually marked as complete
        airNftMinted: 'air.nft.minted', // When a user successfully mints an AIR NFT
        // Add more routing keys as needed for other events
    },
    // ... other RabbitMQ configurations like queues, prefetch counts, etc.
};
