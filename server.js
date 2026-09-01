require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const routes = require("./routes/routes");

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "https://fitfront-two.vercel.app",
    process.env.FRONTEND_URI
].filter(Boolean);

// Matches any Vercel preview deployment for this project, e.g.
// https://fitfront-b591puvyh-baarrun.vercel.app
const previewOriginPattern = /^https:\/\/fitfront-[a-z0-9]+-baarrun\.vercel\.app$/;

function isAllowedOrigin(origin) {
    if (!origin) return false;
    return allowedOrigins.includes(origin) || previewOriginPattern.test(origin);
}

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    next();
});

app.use(express.json());

app.use("/uploads", express.static("uploads"));

const client = new MongoClient(process.env.MONGO_URI);

let dbPromise;

async function getDB() {
    if (!dbPromise) {
        dbPromise = client.connect()
            .then(() => {
                console.log("✅ MongoDB connected");
                return client.db(process.env.DB_NAME);
            })
            .catch((error) => {
                dbPromise = null; // clear cache so the next request retries instead of reusing a dead connection
                throw error;
            });
    }

    return dbPromise;
}

app.use(async (req, res, next) => {
    try {
        req.db = await getDB();
        next();
    } catch (error) {
        console.error("❌ Database connection error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

app.use("/api", routes);

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Fitness API is running"
    });
});

module.exports = app;