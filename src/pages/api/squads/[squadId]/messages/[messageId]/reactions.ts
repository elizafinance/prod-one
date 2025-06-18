import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Squad } from '@/models/Squad';
import { SquadMessage } from '@/models/SquadMessage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} not allowed`);
  }

  await ensureMongooseConnected();

  const session: any = await getServerSession(req, res, authOptions);
  if (!session?.user?.walletAddress) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const userWallet = session.user.walletAddress;
  const { squadId, messageId } = req.query;
  if (typeof squadId !== 'string' || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'Invalid params' });
  }
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== 'string') {
    return res.status(400).json({ error: 'Emoji required' });
  }

  const squad = await Squad.findOne({ squadId });
  if (!squad) return res.status(404).json({ error: 'Squad not found' });
  if (!squad.memberWalletAddresses.includes(userWallet)) {
    return res.status(403).json({ error: 'Not a member of squad' });
  }

  const msg = await SquadMessage.findById(messageId);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const reactions = msg.reactions || {};
  const usersForEmoji = new Set(reactions[emoji] || []);
  if (usersForEmoji.has(userWallet)) {
    usersForEmoji.delete(userWallet);
  } else {
    usersForEmoji.add(userWallet);
  }
  reactions[emoji] = Array.from(usersForEmoji);
  msg.reactions = reactions;
  await msg.save();

  return res.status(200).json({ message: 'Reaction updated', reactions: msg.reactions });
} 