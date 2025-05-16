#!/usr/bin/env node

import mongoose from 'mongoose';
import crypto from 'crypto';
import 'dotenv/config';
import { Proposal } from '../src/models/Proposal.js';

async function main() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    console.error('⚠️  MONGODB_URI environment variable not set.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const proposalsWithoutSlug = await Proposal.find({ $or: [{ slug: { $exists: false } }, { slug: null }] });

  if (proposalsWithoutSlug.length === 0) {
    console.log('All proposals already have slugs. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  for (const proposal of proposalsWithoutSlug) {
    const slug = crypto.randomBytes(6).toString('base64url');
    proposal.slug = slug;
    await proposal.save();
    console.log(`📝 Proposal ${proposal._id.toString()} updated with slug '${slug}'`);
  }

  console.log('✨ Finished updating proposals.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Error running script:', err);
  process.exit(1);
}); 