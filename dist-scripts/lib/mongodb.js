import '../../src/config/env-loader.js';

import { MongoClient } from 'mongodb';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
let cached = global.mongo || { client: null, db: null };
if (!global.mongo) {
    global.mongo = cached;
}
let clientPromise;
if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!global._mongoClientPromise) {
        const client = new MongoClient(MONGODB_URI);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
}
else {
    // In production mode, it's best to not use a global variable.
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
}
export default clientPromise;
export async function connectToDatabase() {
    if (cached.client && cached.db) {
        return cached;
    }
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not defined');
    }
    if (!MONGODB_DB_NAME) {
        throw new Error('MONGODB_DB_NAME environment variable is not defined');
    }
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);
    cached.client = client;
    cached.db = db;
    return cached;
}
