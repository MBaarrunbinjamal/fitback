const { ObjectId } = require('mongodb');

async function getProgressData(db, userId) {
    var userObjId = new ObjectId(userId);
    var user = await db.collection('users').findOne({ _id: userObjId });

    var workouts = await db.collection('workouts').find({ userId: userObjId }).toArray();
    var completedWorkouts = workouts.filter(w =>
        w.exercises && w.exercises.length > 0 && w.exercises.every(ex => ex.completed)
    );

    var nutritionLogs = await db.collection('nutrition_logs').find({ userId: userObjId }).toArray();
    var nutritionTotals = nutritionLogs.reduce((acc, log) => {
        acc.calories += log.calories || 0;
        acc.protein += log.protein || 0;
        acc.carbs += log.carbs || 0;
        acc.fat += log.fat || 0;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    var subscriptionProgress = null;
    if (user && user.subscriber) {
        var sub = await db.collection('UserSubscriptions').findOne({
            userId: userObjId,
            status: 'active'
        });

        if (sub) {
            var totalDays = sub.workoutPlan.length;
            var daysCompleted = sub.workoutPlan.filter(day =>
                day.exercises && day.exercises.length > 0 && day.exercises.every(ex => ex.completed)
            ).length;

            subscriptionProgress = {
                planName: sub.subscriptionName,
                totalDays: totalDays,
                daysCompleted: daysCompleted,
                percentComplete: totalDays > 0 ? Math.round((daysCompleted / totalDays) * 100) : 0,
                startDate: sub.startDate,
                expiresAt: sub.expiresAt
            };
        }
    }

    return {
        user: user,
        totalWorkouts: workouts.length,
        completedWorkoutsCount: completedWorkouts.length,
        completedWorkouts: completedWorkouts,
        nutritionLogsCount: nutritionLogs.length,
        nutritionTotals: nutritionTotals,
        subscriptionProgress: subscriptionProgress,
        generatedAt: new Date()
    };
}

module.exports = { getProgressData };