
var nodemailer = require('nodemailer');
var path = require('path');
var { ObjectId } = require('mongodb');
var multer = require('multer');
var fs = require('fs');
var auth = require('../../middleware/auth');

async function getAllUsers(req, res) {
    try {
        var users = await req.db.collection('users').find().toArray();
        res.json({ success: true, users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function getworkoutRequests(req, res) {
    try {
        var requests = await req.db.collection('UserSubscriptions').aggregate([{
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails'
            }
        }]).toArray();
        res.json({ success: true, requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function deleteUser(req, res) {
    try {
        var userId = req.params.id;
        await req.db.collection('users').deleteOne({ _id: new ObjectId(userId) });
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
function generateWorkoutPlan(user, durationDays) {
    var goal = user.fitnessGoal;
    var level = user.experienceLevel;

    var templates = {
        lose_weight: [
            { exerciseName: 'Jumping Jacks', sets: 3, reps: 20 },
            { exerciseName: 'Bodyweight Squats', sets: 3, reps: 15 },
            { exerciseName: 'Mountain Climbers', sets: 3, reps: 20 },
            { exerciseName: 'Running', sets: 1, reps: 1, notes: '20-30 minutes' }
        ],
        build_muscle: [
            { exerciseName: 'Push Ups', sets: 4, reps: level === 'beginner' ? 8 : 15 },
            { exerciseName: 'Squats', sets: 4, reps: level === 'beginner' ? 8 : 12 },
            { exerciseName: 'Plank', sets: 3, reps: 1, notes: '30-60 seconds' },
            { exerciseName: 'Lunges', sets: 3, reps: 12 }
        ],
        maintain: [
            { exerciseName: 'Bodyweight Squats', sets: 3, reps: 12 },
            { exerciseName: 'Push Ups', sets: 3, reps: 10 },
            { exerciseName: 'Plank', sets: 2, reps: 1, notes: '30 seconds' }
        ],
        improve_endurance: [
            { exerciseName: 'Running', sets: 1, reps: 1, notes: '30-40 minutes' },
            { exerciseName: 'Jump Rope', sets: 3, reps: 50 },
            { exerciseName: 'Burpees', sets: 3, reps: 10 }
        ]
    };

    var baseExercises = templates[goal] || templates.maintain;
    var plan = [];

    for (var day = 1; day <= durationDays; day++) {
        var isRestDay = day % 7 === 0;
        plan.push({
            day: day,
            title: isRestDay ? 'Rest Day' : `Day ${day} — ${goal.replace('_', ' ')}`,
            exercises: isRestDay ? [] : baseExercises.map(ex => ({ ...ex, completed: false }))
        });
    }

    return plan;
}
async function acceptrequest(req, res) {
    try {
        var requestId = req.params.id;
        var request = await req.db.collection('UserSubscriptions').findOne({ _id: new ObjectId(requestId) });

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        if (request.status === 'accepted' || request.status === 'active') {
            return res.status(400).json({ success: false, message: 'Request already accepted' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Invalid request status' });
        }

        var user = await req.db.collection('users').findOne({ _id: request.userId });

        var workoutPlan = generateWorkoutPlan(user, request.subscriptionDuration);
        var startDate = new Date();
        var expiresAt = new Date(startDate);
        expiresAt.setDate(expiresAt.getDate() + request.subscriptionDuration);

        await req.db.collection('UserSubscriptions').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'active', workoutPlan, startDate, expiresAt } }
        );

        await req.db.collection('users').updateOne(
            { _id: request.userId },
            { $set: { subscriber: true } }
        );

        try {
           
        } catch (err) {
            console.error('Failed to send accept notification email:', err);
        }
 await sendacceptNotification(req.db, request.userId);
        res.json({ success: true, message: 'Request accepted and workout plan generated.' });

    } catch (err) {
        console.error('Error in acceptrequest:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function rejectrequest(req, res) {
    try {
        var requestId = req.params.id;
        var request = await req.db.collection('UserSubscriptions').findOne({ _id: new ObjectId(requestId) });

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }
        if (request.status === 'rejected') {
            return res.status(400).json({ success: false, message: 'Request already rejected' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Invalid request status' });
        }

        await req.db.collection('UserSubscriptions').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'rejected' } }
        );

        try {
            await sendrejectNotification(req.db, request.userId);
        } catch (err) {
            console.error('Failed to send reject notification email:', err);
        }

        res.json({ success: true, message: 'Request rejected successfully' });
    } catch (err) {
        console.error('Error in rejectrequest:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function addsubscriptionPlan(req, res) {
    try {
        var { name, plan, price, description, duration } = req.body;
        var subscriptionData = {
            name: name,
            plan: plan,
            price: price,
            description: description,
            duration: duration
        };
        var result = await req.db.collection('Subscriptions').insertOne(subscriptionData);
        res.json({ success: true, message: 'Subscription added successfully', subscription: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function sendacceptNotification(db, userIdtoSend) {
    var user = await db.collection('users').findOne({ _id: new ObjectId(userIdtoSend) });
    var useremail = user.email;
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: useremail,
        subject: 'Your Professional Workout Request Has Been Approved',
        text: `Good news!\n\nYour professional workout request has been approved.\n\nUser ID: ${userIdtoSend}\nStatus: Approved\n\nYou can now access your professional workout plan in the app.`
    });
}

async function sendrejectNotification(db, userIdtoSend) {
    var user = await db.collection('users').findOne({ _id: new ObjectId(userIdtoSend) });
    var useremail = user.email;
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: useremail,
        subject: 'Your Professional Workout Request Was Not Approved',
        text: `We're writing to let you know that your professional workout request was not approved at this time.\n\nUser ID: ${userIdtoSend}\nStatus: Rejected\n\nIf you have questions or would like to submit a new request, please reach out through the app and your payment would be returned effective and immediately.`
    });
}


module.exports = {
    getAllUsers, getworkoutRequests, deleteUser, acceptrequest, rejectrequest,
    addsubscriptionPlan, sendacceptNotification, sendrejectNotification,
};