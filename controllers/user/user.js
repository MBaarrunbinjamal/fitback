var path = require('path');

var { ObjectId } = require('mongodb');
var multer = require('multer');
var fs = require('fs');
var nodemailer = require('nodemailer');

var auth = require('../../middleware/auth');
var API_KEY = process.env.USDA_API_KEY;

var diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        var dir = 'uploads/profile-pics';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

var fileFilter = (req, file, cb) => {
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WEBP images are allowed'), false);
    }
};

var upload = multer({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

async function getUser(req, res) {
    try {
        return res.json({ success: true, user: req.user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function updateUser(req, res) {
    try {
        var db = req.db;
        var userId = req.user._id;

        var {
            username,
            fullName,
            height,
            weight,
            dateOfBirth,
            gender,
            fitnessGoal,
            activityLevel,
            experienceLevel,
            targetWeight,
            unitPreference
        } = req.body;

        var updateFields = { updatedAt: new Date() };

        if (username !== undefined) updateFields.username = username;
        if (fullName !== undefined) updateFields.fullName = fullName;
        if (height !== undefined) updateFields.height = height;
        if (weight !== undefined) updateFields.weight = weight;
        if (dateOfBirth !== undefined) updateFields.dateOfBirth = new Date(dateOfBirth);
        if (gender !== undefined) updateFields.gender = gender;
        if (fitnessGoal !== undefined) updateFields.fitnessGoal = fitnessGoal;
        if (activityLevel !== undefined) updateFields.activityLevel = activityLevel;
        if (experienceLevel !== undefined) updateFields.experienceLevel = experienceLevel;
        if (targetWeight !== undefined) updateFields.targetWeight = targetWeight;
        if (unitPreference !== undefined) updateFields.unitPreference = unitPreference;

        if (username) {
            var existingUser = await db.collection('users').findOne({
                username,
                _id: { $ne: new ObjectId(userId) }
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
        }

        let oldProfilePicToDelete = null;

        if (req.file) {
            updateFields.profilePicture = `/uploads/profile-pics/${req.file.filename}`;

            if (req.user.profilePicture) {
                oldProfilePicToDelete = path.join(
                    process.cwd(),
                    req.user.profilePicture.replace(/^\//, '')
                );
            }
        }

        var result = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(userId) },
            { $set: updateFields },
            {
                returnDocument: 'after',
                projection: { password: 0, verificationToken: 0, verificationExpiry: 0 }
            }
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (oldProfilePicToDelete) {
            fs.unlink(oldProfilePicToDelete, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Failed to delete old profile picture:', err);
                }
            });
        }

        return res.json({
            success: true,
            message: 'Profile updated successfully',
            user: result
        });

    } catch (error) {
        console.error('Update user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
}

async function createWorkout(req, res) {
  try {
    var {
      workoutName,
      category,
      date,
      tags,
      description,
      exercises,
      reminderTime,
    } = req.body;

    if (!workoutName || !category) {
      return res.status(400).json({
        success: false,
        message: "Workout name and category are required.",
      });
    }

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one exercise is required.",
      });
    }

    for (var exercise of exercises) {
      if (
        !exercise.exerciseName ||
        exercise.sets == null ||
        exercise.reps == null
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each exercise must have exerciseName, sets, and reps.",
        });
      }
    }

    var extinguisher = await req.db.collection('workouts').findOne({ workoutName, userId: req.user._id });
    if (extinguisher) {
      return res.status(400).json({
        success: false,
        message: "A workout with this name already exists.",
      });
    }

    var workoutDate = date ? new Date(date) : new Date();
    var cleanedExercises = exercises.map(ex => ({ ...ex, completed: false }));

    var workout = await req.db.collection('workouts').insertOne({
      userId: req.user._id,
      workoutName,
      category,
      date: workoutDate,
      tags: tags || [],
      description: description || "",
      exercises: cleanedExercises,
      createdAt: new Date(),
    });

    if (reminderTime) {
      await req.db.collection('reminders').insertOne({
        userId: req.user._id,
        type: 'workout',
        title: `Time for your workout: ${workoutName}`,
        time: reminderTime,
        date: workoutDate,
        daysOfWeek: [],
        active: true,
        lastSentAt: null,
        createdAt: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      message: "Workout created successfully.",
      data: workout,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}
async function toggleExerciseComplete(req, res) {
    try {
        var { workoutId, exerciseIndex } = req.params;
        var { completed } = req.body;

        var workout = await req.db.collection('workouts').findOne({
            _id: new ObjectId(workoutId),
            userId: req.user._id
        });

        if (!workout) {
            return res.status(404).json({ success: false, message: 'Workout not found' });
        }

        var idx = parseInt(exerciseIndex, 10);
        if (!workout.exercises[idx]) {
            return res.status(400).json({ success: false, message: 'Invalid exercise index' });
        }

        var updateKey = `exercises.${idx}.completed`;

        await req.db.collection('workouts').updateOne(
            { _id: new ObjectId(workoutId), userId: req.user._id },
            { $set: { [updateKey]: completed } }
        );

        res.json({ success: true, message: 'Exercise updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
async function getWorkouts(req, res) {
    try {
        var workouts = await req.db.collection('workouts').find({ userId: req.user._id }).toArray();
        res.json({ success: true, workouts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
async function getTodaysWorkouts(req, res) {
    try {
        var startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        var endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        var workouts = await req.db.collection('workouts').find({
            userId: req.user._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).toArray();

        res.json({ success: true, workouts });
    } catch (error) {
        console.error('Error in getTodaysWorkouts:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function getSingleWorkout(req, res) {
    try {
        var workout = await req.db.collection('workouts').findOne({
            _id: new ObjectId(req.params.id),
            userId: req.user._id
        });
        if (!workout) {
            return res.status(404).json({ success: false, message: 'Workout not found' });
        }
        res.json({ success: true, workout });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateWorkout(req, res) {
    try {
        var result = await req.db.collection('workouts').updateOne(
            { _id: new ObjectId(req.params.id), userId: req.user._id },
            { $set: req.body }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Workout not found' });
        }
        res.json({ success: true, message: 'Workout updated', result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function deleteWorkout(req, res) {
    try {
        var result = await req.db.collection('workouts').deleteOne({
            _id: new ObjectId(req.params.id),
            userId: req.user._id
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Workout not found' });
        }
        res.json({ success: true, message: 'Workout deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function sendAdminNotification(db, userId) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'New Professional Workout Request',
        text: `A new professional workout request has been submitted.\n\nUser ID: ${userId}\nStatus: Pending\n\nPlease review this request in the admin panel.`
    });
}

async function getsubscriptionPlans(req, res) {
    try {
        var plans = await req.db.collection('Subscriptions').find().toArray();
        res.json({ success: true, plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getsinglesubscriptionPlan(req, res) {
    try {
        var planId = req.params.id;
        var plan = await req.db.collection('Subscriptions').findOne({ _id: new ObjectId(planId) });
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Subscription plan not found' });
        }
        res.json({ success: true, plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function subscribe(req, res) {
    try {
        var userId = req.user._id;
        var { address, planId, cardnumber } = req.body;

        var requiredFields = ['height', 'weight', 'dateOfBirth', 'gender', 'fitnessGoal', 'activityLevel', 'experienceLevel'];
        var missingFields = requiredFields.filter(field => !req.user[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Please complete your profile before subscribing. Missing: ${missingFields.join(', ')}`
            });
        }
var existingActive = await req.db.collection('UserSubscriptions').findOne({
    userId: userId,
    status: { $in: ['pending', 'active'] }
});

if (existingActive) {
    return res.status(400).json({
        success: false,
        message: 'You already have a pending or active subscription.'
    });
}
        var subscription = await req.db.collection('Subscriptions').findOne({ _id: new ObjectId(planId) });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        var subscriptionData = {
            userId: userId,
            cardnumber: cardnumber,
            planId: subscription._id,
            address: address,
            requestedAt: new Date(),
            subscriptionName: subscription.name,
            subscriptionPlan: subscription.plan,
            subscriptionPrice: subscription.price,
            subscriptionDescription: subscription.description,
            subscriptionDuration: subscription.duration,
            status: 'pending',
            workoutPlan: [],
            startDate: null,
            expiresAt: null
        };

        var result = await req.db.collection('UserSubscriptions').insertOne(subscriptionData);

        sendAdminNotification(req.db, userId).catch(err => {
            console.error('Failed to send admin notification email:', err);
        });

        return res.json({ success: true, message: 'Subscription request submitted', subscription: result });

    } catch (err) {
        console.error('Error in subscribe:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function getMyWorkoutPlan(req, res) {
    try {
        var sub = await req.db.collection('UserSubscriptions').findOne({
            userId: req.user._id,
            status: 'active'
        });

        if (!sub) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }

        var daysElapsed = Math.floor((new Date() - sub.startDate) / (1000 * 60 * 60 * 24));
        var todaysWorkout = sub.workoutPlan[daysElapsed] || null;

        res.json({
            success: true,
            fullPlan: sub.workoutPlan,
            today: todaysWorkout,
            dayNumber: daysElapsed + 1,
            expiresAt: sub.expiresAt   // ← added
        });
    } catch (err) {
        console.error('Error in getMyWorkoutPlan:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}
async function createReminder(req, res) {
    try {
        var { type, title, time, daysOfWeek } = req.body;

        if (!type || !title || !time) {
            return res.status(400).json({ success: false, message: 'type, title, and time are required' });
        }
        if (!['workout', 'meal', 'goal'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid reminder type' });
        }

        var reminder = {
            userId: req.user._id,
            type,
            title,
            time, 
            daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
            active: true,
            lastSentAt: null,
            createdAt: new Date()
        };

        var result = await req.db.collection('reminders').insertOne(reminder);
        res.json({ success: true, reminder: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getReminders(req, res) {
    try {
        var reminders = await req.db.collection('reminders').find({ userId: req.user._id }).toArray();
        res.json({ success: true, reminders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateReminder(req, res) {
    try {
        var { title, time, daysOfWeek, active } = req.body;
        var updateFields = {};
        if (title !== undefined) updateFields.title = title;
        if (time !== undefined) updateFields.time = time;
        if (daysOfWeek !== undefined) updateFields.daysOfWeek = daysOfWeek;
        if (active !== undefined) updateFields.active = active;

        var result = await req.db.collection('reminders').updateOne(
            { _id: new ObjectId(req.params.id), userId: req.user._id },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }
        res.json({ success: true, message: 'Reminder updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function deleteReminder(req, res) {
    try {
        var result = await req.db.collection('reminders').deleteOne({
            _id: new ObjectId(req.params.id),
            userId: req.user._id
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }
        res.json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
async function toggleSubscriptionExerciseComplete(req, res) {
    try {
        var { dayIndex, exerciseIndex } = req.params;
        var { completed } = req.body;

        var sub = await req.db.collection('UserSubscriptions').findOne({
            userId: req.user._id,
            status: 'active'
        });

        if (!sub) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }

        var dIdx = parseInt(dayIndex, 10);
        var eIdx = parseInt(exerciseIndex, 10);

        if (!sub.workoutPlan[dIdx] || !sub.workoutPlan[dIdx].exercises[eIdx]) {
            return res.status(400).json({ success: false, message: 'Invalid day or exercise index' });
        }

        var updateKey = `workoutPlan.${dIdx}.exercises.${eIdx}.completed`;

        await req.db.collection('UserSubscriptions').updateOne(
            { _id: sub._id },
            { $set: { [updateKey]: completed } }
        );

        res.json({ success: true, message: 'Updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
module.exports = {
    getUser, updateUser, upload, createWorkout, getWorkouts,
    getSingleWorkout, updateWorkout, deleteWorkout,
    getsubscriptionPlans, getsinglesubscriptionPlan, subscribe,
    getMyWorkoutPlan,getTodaysWorkouts,deleteReminder,updateReminder,getReminders,createReminder
    ,toggleExerciseComplete ,toggleSubscriptionExerciseComplete
};