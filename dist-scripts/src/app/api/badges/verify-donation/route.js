import { NextResponse } from 'next/server';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connectToDatabase } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';
import { createNotification } from '@/lib/notificationUtils';
import { withRateLimit } from '@/middleware/rateLimiter';
// The donation amount required for the badge (0.1 SOL in lamports)
const REQUIRED_DONATION_AMOUNT = 0.1 * LAMPORTS_PER_SOL;
// The badge ID for the donation badge
const DONATION_BADGE_ID = 'generous_donor_badge';
// This API route verifies a donation transaction and awards a badge if valid
const baseHandler = withAuth(async (request, session) => {
    console.log('[VerifyDonation API] Starting verification process');
    const userWalletAddress = session.user.walletAddress;
    if (!userWalletAddress) {
        console.error('[VerifyDonation API] Wallet address not found in session');
        return NextResponse.json({ error: 'Wallet address not found in session' }, { status: 400 });
    }
    try {
        const { transactionSignature } = await request.json();
        if (!transactionSignature) {
            console.error('[VerifyDonation API] Transaction signature is required but was not provided');
            return NextResponse.json({ error: 'Transaction signature is required' }, { status: 400 });
        }
        // Connect to Solana to verify the transaction
        const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
        if (!rpcUrl) {
            console.error('[VerifyDonation API] Helius RPC URL not configured.');
            return NextResponse.json({ error: 'Server configuration error for RPC.' }, { status: 500 });
        }
        const connection = new Connection(rpcUrl);
        // Get the transaction details
        console.log(`[VerifyDonation API] Getting transaction details for signature: ${transactionSignature}`);
        const transaction = await connection.getTransaction(transactionSignature, {
            maxSupportedTransactionVersion: 0
        });
        if (!transaction) {
            console.error('[VerifyDonation API] Transaction not found on chain');
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        // Get the donation address from environment variable
        const donationAddress = process.env.NEXT_PUBLIC_DONATION_WALLET_ADDRESS;
        if (!donationAddress) {
            console.error('[VerifyDonation API] Donation wallet address not configured.');
            return NextResponse.json({ error: 'Donation address not configured on server.' }, { status: 500 });
        }
        // Verify this transaction:
        // 1. Sender is the user's wallet
        // 2. Receiver is the donation address
        // 3. Amount is at least 0.1 SOL
        let isValid = false;
        // Check the transaction instructions
        if (transaction.meta && transaction.transaction.message) {
            // Get account keys in a way that works with both legacy and versioned transactions
            let accountKeys = [];
            const message = transaction.transaction.message;
            // Handle different transaction message versions
            if (typeof message.getAccountKeys === 'function') {
                // Versioned transaction
                accountKeys = Array.from(message.getAccountKeys().keySegments().flat());
            }
            else {
                // Legacy transaction (handle as any to bypass TS strict checking)
                const legacyMessage = message;
                if (legacyMessage.accountKeys) {
                    accountKeys = legacyMessage.accountKeys;
                }
            }
            // Look through post balances to find the transfer
            for (let i = 0; i < accountKeys.length; i++) {
                const key = accountKeys[i].toString();
                // If this is the donation address
                if (key === donationAddress) {
                    // Get the balance change
                    const preBalance = transaction.meta.preBalances[i];
                    const postBalance = transaction.meta.postBalances[i];
                    const balanceChange = postBalance - preBalance;
                    // Check if the balance increased by the required amount
                    if (balanceChange >= REQUIRED_DONATION_AMOUNT) {
                        // Now verify the sender
                        const senderIndex = accountKeys.findIndex((key) => key.toString() === userWalletAddress);
                        if (senderIndex !== -1) {
                            const senderPreBalance = transaction.meta.preBalances[senderIndex];
                            const senderPostBalance = transaction.meta.postBalances[senderIndex];
                            // Check if sender's balance decreased (accounting for fees)
                            if (senderPreBalance > senderPostBalance) {
                                isValid = true;
                                break;
                            }
                        }
                    }
                }
            }
        }
        if (!isValid) {
            console.error('[VerifyDonation API] Transaction verification failed');
            return NextResponse.json({
                error: 'Transaction verification failed. Ensure you sent at least 0.1 SOL to the correct address.'
            }, { status: 400 });
        }
        // Connect to database and update the user's badges
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        // Get the user
        const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
        if (!user) {
            console.error(`[VerifyDonation API] User with wallet ${userWalletAddress} not found in DB`);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // Check if the user already has the badge
        if (user.earnedBadgeIds && user.earnedBadgeIds.includes(DONATION_BADGE_ID)) {
            console.log(`[VerifyDonation API] User ${userWalletAddress} already has the badge`);
            return NextResponse.json({
                message: 'You already have the Generous Donor badge!',
                alreadyEarned: true
            });
        }
        // Add the badge to the user
        const earnedBadgeIds = user.earnedBadgeIds || [];
        console.log(`[VerifyDonation API] Updating user ${userWalletAddress} with badge and points`);
        await usersCollection.updateOne({ walletAddress: userWalletAddress }, {
            $set: {
                earnedBadgeIds: [...earnedBadgeIds, DONATION_BADGE_ID],
                updatedAt: new Date()
            },
            $inc: { points: 250 } // Also give them 250 points for the donation
        });
        // Create a notification for the user
        await createNotification(db, userWalletAddress, 'badge_earned', // Type cast to resolve type issue
        'You earned the ✨ Generous Donor badge for your SOL donation! +250 points added to your profile.', undefined, undefined, undefined, undefined, undefined);
        console.log(`[VerifyDonation API] Successfully awarded badge to ${userWalletAddress}`);
        // Return success
        return NextResponse.json({
            message: 'Congratulations! You earned the Generous Donor badge and 250 points!',
            badgeId: DONATION_BADGE_ID,
            pointsAwarded: 250
        });
    }
    catch (error) {
        console.error('Error verifying donation:', error);
        return NextResponse.json({ error: 'Failed to verify donation' }, { status: 500 });
    }
});
export const POST = withRateLimit(baseHandler);
