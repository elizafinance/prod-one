import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Squad } from '@/models/Squad';
import { SquadMessage } from '@/models/SquadMessage';
import { rabbitmqService } from '@/services/rabbitmq.service.js';
import { rabbitmqConfig } from '@/config/rabbitmq.config.js';

function getCurrentEpochNumber(): number {
  // Using Friday-based epochs similar to proposals route
  const now = new Date();
  const startOfEpoch = new Date(now);
  // Find last Friday (UTC)
  const day = startOfEpoch.getUTCDay();
  const diff = (day >= 5 ? day - 5 : day + 2); // Distance to last Friday
  startOfEpoch.setUTCDate(startOfEpoch.getUTCDate() - diff);
  startOfEpoch.setUTCHours(0, 0, 0, 0);
  return Math.floor(startOfEpoch.getTime() / 1000); // seconds since epoch start date
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMongooseConnected();
  } catch (err) {
    console.error('DB connect error', err);
    return res.status(500).json({ error: 'Database error' });
  }

  const session: any = await getServerSession(req, res, authOptions);
  if (!session?.user?.walletAddress) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userWallet = session.user.walletAddress;
  const { squadId } = req.query;
  if (!squadId || typeof squadId !== 'string') {
    return res.status(400).json({ error: 'Invalid squadId' });
  }

  const squad = await Squad.findOne({ squadId });
  if (!squad) return res.status(404).json({ error: 'Squad not found' });
  if (!squad.memberWalletAddresses.includes(userWallet)) {
    return res.status(403).json({ error: 'Not a member of squad' });
  }

  switch (req.method) {
    case 'GET': {
      const epochParam = req.query.epoch as string | undefined;
      const epoch = epochParam === 'current' || !epochParam ? getCurrentEpochNumber() : parseInt(epochParam, 10);
      const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);

      const messages = await SquadMessage.find({ squadId, epoch })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return res.status(200).json({ messages });
    }
    case 'POST': {
      const { content } = req.body;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content required' });
      }
      if (content.length > 140) {
        return res.status(400).json({ error: 'Content exceeds 140 characters' });
      }
      // Check if user already posted today
      const today = new Date();
      const dayStr = `${today.getUTCFullYear()}-${(today.getUTCMonth() + 1).toString().padStart(2, '0')}-${today
        .getUTCDate()
        .toString()
        .padStart(2, '0')}`;
      const existing = await SquadMessage.findOne({ squadId, authorWalletAddress: userWallet, createdAtDay: dayStr });
      if (existing) {
        return res.status(429).json({ error: 'Already posted today' });
      }
      const newMsg = new SquadMessage({
        squadId,
        authorWalletAddress: userWallet,
        content: content.trim(),
        epoch: getCurrentEpochNumber(),
      });
      await newMsg.save();

      // Publish to RabbitMQ for WebSocket server
      try {
        await rabbitmqService.publishToExchange(
          rabbitmqConfig.eventsExchange,
          `squad.message.new.${squadId}`,
          {
            squadId,
            message: {
              _id: newMsg._id.toString(),
              content: newMsg.content,
              authorWalletAddress: newMsg.authorWalletAddress,
              createdAt: newMsg.createdAt,
              epoch: newMsg.epoch,
            },
          }
        );
      } catch (err) {
        console.error('RabbitMQ publish error', err);
      }

      return res.status(201).json({ message: newMsg });
    }
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default handler; 