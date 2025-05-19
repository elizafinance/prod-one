import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';
let redisClient = null;
let connectionPromise = null;
async function connectRedis() {
    if ((redisClient === null || redisClient === void 0 ? void 0 : redisClient.status) === 'ready') {
        return redisClient;
    }
    if (connectionPromise) {
        return connectionPromise;
    }
    console.log('Attempting to connect to Redis...');
    // Use URL if provided, otherwise use individual connection options
    const client = redisConfig.url
        ? new Redis(redisConfig.url)
        : new Redis({
            host: redisConfig.options.host || 'localhost',
            port: redisConfig.options.port || 6379,
            username: redisConfig.options.username,
            password: redisConfig.options.password,
            maxRetriesPerRequest: redisConfig.options.maxRetriesPerRequest,
            enableReadyCheck: redisConfig.options.enableReadyCheck,
            retryStrategy: redisConfig.options.retryStrategy,
            reconnectOnError: redisConfig.options.reconnectOnError,
        });
    connectionPromise = new Promise((resolve, reject) => {
        client.on('connect', () => {
            console.log('Connecting to Redis...');
        });
        client.on('ready', () => {
            console.log('Successfully connected to Redis and ready!');
            redisClient = client;
            connectionPromise = null;
            resolve(client);
        });
        client.on('error', (err) => {
            console.error('Redis connection error:', err);
            if ((redisClient === null || redisClient === void 0 ? void 0 : redisClient.status) !== 'ready') {
                redisClient = null;
            }
            connectionPromise = null;
            reject(err);
        });
        client.on('close', () => {
            console.log('Redis connection closed.');
        });
        client.on('reconnecting', () => {
            console.log('Reconnecting to Redis...');
        });
    });
    return connectionPromise;
}
async function getRedisClient() {
    if ((redisClient === null || redisClient === void 0 ? void 0 : redisClient.status) === 'ready') {
        return redisClient;
    }
    return connectRedis();
}
async function setCache(key, value, ttlSeconds) {
    try {
        const client = await getRedisClient();
        if (ttlSeconds) {
            return client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        }
        return client.set(key, JSON.stringify(value));
    }
    catch (error) {
        console.error('Redis setCache error:', error);
        return null;
    }
}
async function getCache(key) {
    try {
        const client = await getRedisClient();
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        console.error('Redis getCache error:', error);
        return null;
    }
}
async function deleteCache(key) {
    try {
        const client = await getRedisClient();
        return client.del(key);
    }
    catch (error) {
        console.error('Redis deleteCache error:', error);
        return 0;
    }
}
async function incrementCache(key, incrementBy = 1) {
    try {
        const client = await getRedisClient();
        return client.incrby(key, incrementBy);
    }
    catch (error) {
        console.error('Redis incrementCache error:', error);
        return 0;
    }
}
export const redisService = {
    connect: connectRedis,
    getClient: getRedisClient,
    set: setCache,
    get: getCache,
    del: deleteCache,
    incrBy: incrementCache,
    getRawClient: () => redisClient
};
