import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';

let redisClient = null;
let connectionPromise = null;

async function connectRedis() {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  // If a connection is already in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  console.log('Attempting to connect to Redis...');
  const client = new Redis(redisConfig.url, {
    // Optional: Add ioredis specific options here
    // lazyConnect: true, // Example: connect only when a command is issued
    maxRetriesPerRequest: 3, // Example
    enableReadyCheck: true,
  });

  connectionPromise = new Promise((resolve, reject) => {
    client.on('connect', () => {
      console.log('Connecting to Redis...');
    });

    client.on('ready', () => {
      console.log('Successfully connected to Redis and ready!');
      redisClient = client;
      connectionPromise = null; // Clear the promise once connected
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('Redis connection error:', err);
      // ioredis handles reconnection attempts by default for many errors
      // If the error is fatal or retries are exhausted, it might land here.
      if (redisClient && redisClient.status !== 'ready') {
          redisClient = null; // Clear client if connection failed
      }
      connectionPromise = null; // Clear the promise on error
      reject(err); // Reject the connection promise
    });

    client.on('close', () => {
      console.warn('Redis connection closed.');
      // redisClient = null; // Consider if you want to nullify on close, ioredis might be reconnecting
    });

    client.on('reconnecting', () => {
      console.log('Reconnecting to Redis...');
    });
  });

  try {
    // For non-lazy connect, this await might not be strictly necessary if relying on 'ready' event for resolution.
    // However, if connect() itself throws an error for invalid URL etc., it can be caught here.
    // await client.connect(); // Not needed for ioredis, it connects automatically or lazily
  } catch (initialConnectError) {
      console.error('Redis initial connection attempt failed:', initialConnectError);
      connectionPromise = null;
      throw initialConnectError;
  }
  
  return connectionPromise;
}

async function getRedisClient() {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  return connectRedis();
}

// Example utility function (can be expanded)
async function setCache(key, value, ttlSeconds) {
  const client = await getRedisClient();
  if (ttlSeconds) {
    return client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
  return client.set(key, JSON.stringify(value));
}

async function getCache(key) {
  const client = await getRedisClient();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function deleteCache(key) {
  const client = await getRedisClient();
  return client.del(key);
}

async function incrementCache(key, incrementBy = 1) {
  const client = await getRedisClient();
  return client.incrby(key, incrementBy);
}

export const redisService = {
  connect: connectRedis,
  getClient: getRedisClient,
  set: setCache,
  get: getCache,
  del: deleteCache,
  incrBy: incrementCache,
  // Expose the raw client if needed for more complex operations
  getRawClient: () => redisClient 
}; 