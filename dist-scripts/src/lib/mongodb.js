import { MongoClient } from 'mongodb';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
let cached = global.mongo || { client: null, db: null };
if (!global.mongo) {
    global.mongo = cached;
}
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
