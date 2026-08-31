const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { expireOldSubscriptions } = require('./utils/subscriptions');
const { dispatchDueReminders } = require('./utils/reminders');
const { sendAllDailyNutritionEmails } = require('./controllers/user/nutritionController');

const app = express();
app.use(express.json());


const allowedOrigins = [
    'http://localhost:3000',
    'https://fitfront-jr3i18fgn-baarrun.vercel.app'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use('/uploads', express.static('uploads'));

let db;
const client = new MongoClient(process.env.MONGO_URL);

async function connectDB() {
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME);
        console.log('MongoDB connected successfully');

        cron.schedule('0 0 * * *', async () => {
            console.log('Running subscription expiry check...');
            try {
                await expireOldSubscriptions(db);
            } catch (err) {
                console.error('Error running subscription expiry check:', err);
            }
        });

        // Reminder dispatcher — checked every minute
        cron.schedule('* * * * *', async () => {
            try {
                await dispatchDueReminders(db);
            } catch (err) {
                console.error('Error dispatching reminders:', err);
            }
        });

        cron.schedule('59 23 * * *', async () => {
            console.log('Sending daily nutrition emails...');
            try {
                await sendAllDailyNutritionEmails(db);
                console.log('Nutrition emails sent successfully.');
            } catch (err) {
                console.error('Error sending nutrition emails:', err);
            }
        });

    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}
connectDB();

app.use((req, res, next) => {
    req.db = db;
    next();
});

const routes = require('./routes/routes');

app.use('/api', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('Server running on port', PORT);
});