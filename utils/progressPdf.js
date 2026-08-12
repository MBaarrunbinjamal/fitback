const PDFDocument = require('pdfkit');

function buildProgressPDF(data) {
    var doc = new PDFDocument({ margin: 50 });
    var buffers = [];

    doc.on('data', buffers.push.bind(buffers));

    doc.fontSize(22).fillColor('#ff6a1a').text('Forge — Progress Report', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(
        'Generated ' + new Date(data.generatedAt).toLocaleDateString()
    );
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#000').text('User: ' + (data.user.fullName || data.user.username));
    doc.fontSize(10).fillColor('#333').text('Email: ' + data.user.email);
    doc.moveDown(1);

    doc.fontSize(16).fillColor('#000').text('Workout Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333');
    doc.text('Total workouts logged: ' + data.totalWorkouts);
    doc.text('Workouts fully completed: ' + data.completedWorkoutsCount);
    doc.moveDown(1);

    if (data.completedWorkouts.length > 0) {
        doc.fontSize(13).fillColor('#000').text('Completed Workouts');
        doc.moveDown(0.3);
        data.completedWorkouts.forEach(function (w) {
            doc.fontSize(10).fillColor('#333').text(
                '• ' + w.workoutName + ' (' + w.category + ') — ' +
                new Date(w.date).toLocaleDateString()
            );
        });
        doc.moveDown(1);
    }

    doc.fontSize(16).fillColor('#000').text('Nutrition Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#333');
    doc.text('Total food entries logged: ' + data.nutritionLogsCount);
    doc.text('Total calories: ' + data.nutritionTotals.calories.toFixed(0) + ' kcal');
    doc.text('Total protein: ' + data.nutritionTotals.protein.toFixed(1) + ' g');
    doc.text('Total carbs: ' + data.nutritionTotals.carbs.toFixed(1) + ' g');
    doc.text('Total fat: ' + data.nutritionTotals.fat.toFixed(1) + ' g');
    doc.moveDown(1);

    if (data.subscriptionProgress) {
        var sp = data.subscriptionProgress;
        doc.fontSize(16).fillColor('#000').text('Subscription Plan Progress');
        doc.moveDown(0.3);
        doc.fontSize(11).fillColor('#333');
        doc.text('Plan: ' + sp.planName);
        doc.text('Days completed: ' + sp.daysCompleted + ' / ' + sp.totalDays + ' (' + sp.percentComplete + '%)');
        if (sp.startDate) doc.text('Started: ' + new Date(sp.startDate).toLocaleDateString());
        if (sp.expiresAt) doc.text('Expires: ' + new Date(sp.expiresAt).toLocaleDateString());
    } else {
        doc.fontSize(11).fillColor('#888').text('No active subscription plan.');
    }

    doc.end();

    return new Promise((resolve) => {
        doc.on('end', () => {
            resolve(Buffer.concat(buffers));
        });
    });
}

module.exports = { buildProgressPDF };