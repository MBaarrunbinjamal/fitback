
require('dotenv').config();

const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();

// ========================================
// CORS
// ========================================

const allowedOrigins = [
    'http://localhost:3000',
    'https://fitfront-jr3i18fgn-baarrun.vercel.app'
];

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );

    res.header(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );

    // Handle browser CORS preflight immediately
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// ========================================
// Middleware
// ========================================

app.use(express.json());

app.use('/uploads', express.static('uploads'));

// ========================================
// MongoDB
// ========================================

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI is missing');
    process.exit(1);
}

if (!DB_NAME) {
    console.error('❌ DB_NAME is missing');
    process.exit(1);
}

const client = new MongoClient(MONGO_URI);

let db = null;
let connectingPromise = null;

// ========================================
// Database Connection
// ========================================

async function connectDB() {
    // Already connected
    if (db) {
        return db;
    }

    // Connection already in progress
    if (connectingPromise) {
        return connectingPromise;
    }

    connectingPromise = client.connect()
        .then(() => {
            db = client.db(DB_NAME);

            console.log('✅ MongoDB connected successfully');
            console.log(`✅ Database: ${DB_NAME}`);

            return db;
        })
        .catch((error) => {
            connectingPromise = null;

            console.error('❌ MongoDB connection error:', error);

            throw error;
        });

    return connectingPromise;
}

// ========================================
// Database Middleware
// ========================================

app.use(async (req, res, next) => {
    try {
        req.db = await connectDB();
        next();
    } catch (error) {
        console.error('❌ Database middleware error:', error);

        return res.status(500).json({
            success: false,
            message: 'Database connection failed'
        });
    }
});

// ========================================
// Routes
// ========================================

const routes = require('./routes/routes');

app.use('/api', routes);

// ========================================
// Health Check
// ========================================

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Fitness API is running'
    });
});

// ========================================
// Start Server
// ========================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// ========================================
// Optional local initialization
// ========================================

connectDB().catch(() => {
    // Request middleware will retry/handle connection failures.
});

