const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined');
}

if (!DB_NAME) {
    throw new Error('DB_NAME is not defined');
}

const client = new MongoClient(MONGO_URI);

let db = null;
let connectionPromise = null;

async function getDB() {
    if (db) {
        return db;
    }

    if (!connectionPromise) {
        connectionPromise = client.connect()
            .then(() => {
                db = client.db(DB_NAME);

                console.log('✅ MongoDB connected');
                console.log('✅ Database:', DB_NAME);

                return db;
            })
            .catch((error) => {
                connectionPromise = null;
                console.error('❌ MongoDB connection error:', error);
                throw error;
            });
    }

    return connectionPromise;
}

module.exports = { getDB };