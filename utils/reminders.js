var nodemailer = require('nodemailer');
var { ObjectId } = require('mongodb');

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendReminderEmail(email, reminder) {
    var subjectByType = {
        workout: 'Workout Reminder - Forge',
        meal: 'Meal Time Reminder - Forge',
        goal: 'Fitness Goal Reminder - Forge'
    };

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: subjectByType[reminder.type] || 'Reminder - Forge',
        text: `Hey, this is your reminder: ${reminder.title}`
    });
}

async function dispatchDueReminders(db) {
    var now = new Date();
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    var currentDay = now.getDay();
    var todayStr = now.toDateString();

    var dueReminders = await db.collection('reminders').find({ active: true }).toArray();

    for (var reminder of dueReminders) {
        var [hh, mm] = reminder.time.split(':').map(Number);
        var reminderMinutes = hh * 60 + mm;

        var alreadySentToday = reminder.lastSentAt &&
            new Date(reminder.lastSentAt).toDateString() === todayStr;

        var isDue = nowMinutes >= reminderMinutes && nowMinutes <= reminderMinutes + 2;
        if (!isDue || alreadySentToday) continue;

        if (reminder.date) {
            var reminderDateStr = new Date(reminder.date).toDateString();
            if (reminderDateStr !== todayStr) continue;
        } else {
            var appliesToday = reminder.daysOfWeek.length === 0 || reminder.daysOfWeek.includes(currentDay);
            if (!appliesToday) continue;
        }

        try {
            var user = await db.collection('users').findOne({ _id: reminder.userId });
            if (!user) continue;

            await sendReminderEmail(user.email, reminder);
            console.log(`[REMINDER SENT] to ${user.email}: "${reminder.title}" at ${now.toTimeString().slice(0,5)}`);

            await db.collection('reminders').updateOne(
                { _id: reminder._id },
                { $set: { lastSentAt: now } }
            );

            if (reminder.date) {
                await db.collection('reminders').updateOne(
                    { _id: reminder._id },
                    { $set: { active: false } }
                );
            }
        } catch (err) {
            console.error(`Failed to send reminder to user ${reminder.userId}:`, err);
        }
    }
}

module.exports = { dispatchDueReminders };