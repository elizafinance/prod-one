import mongoose from 'mongoose';

let isConnected = false;

export async function ensureMongooseConnected() {
  if (isConnected) return;

  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable not set');
  }

  await mongoose.connect(uri);
  isConnected = true;
} 