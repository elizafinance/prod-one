// src/services/userSpend.service.js (Illustrative - Integrate into your actual spend processing logic)
import { rabbitmqService } from './rabbitmq.service.js'; // Adjust path as needed
import { rabbitmqConfig } from '../config/rabbitmq.config.js'; // Adjust path as needed
// Import user/order models if needed for validation or fetching additional data

/**
 * THIS IS AN ILLUSTRATIVE SERVICE.
 * You need to integrate the RabbitMQ publishing logic into your actual spend/purchase confirmation mechanism.
 */

/**
 * Example function that might be called after a user's spend is confirmed.
 *
 * @param {string} userId - The ID of the user (e.g., walletAddress or MongoDB _id).
 * @param {number} amountSpent - The amount spent.
 * @param {string} [currency='default'] - Optional: currency or type of item spent.
 * @param {object} [transactionDetails={}] - Optional: any other details about the transaction.
 */
export async function recordUserSpendAndPublishEvent(userId, amountSpent, currency = 'default', transactionDetails = {}) {
  console.log(`[UserSpendService] Recording spend for user ${userId}: ${amountSpent} ${currency}`);

  if (typeof amountSpent !== 'number' || amountSpent <= 0) {
    console.warn('[UserSpendService] Invalid amountSpent. Aborting event publish.');
    return { success: false, message: 'Invalid spend amount' };
  }

  try {
    // 1. Your actual logic to record the spend in your database (e.g., in an orders table, update user stats)
    // This is assumed to have happened before this function is called, or happens here.
    // For example: await Order.create({ userId, amountSpent, currency, ...transactionDetails });
    console.log(`[UserSpendService] Spend of ${amountSpent} ${currency} by user ${userId} recorded (simulated).`);

    // 2. Publish the user.spend.recorded event
    const eventPayload = {
      userId: userId, 
      amountSpent: amountSpent,
      currency: currency,
      transactionDetails: transactionDetails, // e.g., { orderId: '123', item: 'special_pass' }
      timestamp: new Date().toISOString(),
    };

    await rabbitmqService.publishToExchange(
      rabbitmqConfig.eventsExchange,
      rabbitmqConfig.routingKeys.userSpendRecorded,
      eventPayload
    );
    console.log('[UserSpendService] Successfully published user.spend.recorded event:', eventPayload);

    return { success: true, message: 'Spend recorded and event published' };

  } catch (error) {
    console.error('[UserSpendService] Error recording spend and publishing event:', error);
    return { success: false, message: 'Error processing spend event', error };
  }
}

// Example of how this might be called:
// async function handlePurchaseCompletion(order) {
//   // ... after payment is confirmed and order is finalized ...
//   await recordUserSpendAndPublishEvent(order.userId, order.totalAmount, order.currency, { orderId: order.id });
// } 