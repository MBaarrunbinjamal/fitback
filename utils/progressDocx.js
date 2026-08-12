const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

async function buildProgressDocx(data) {
    var children = [];

    children.push(new Paragraph({
        text: 'Forge — Progress Report',
        heading: HeadingLevel.TITLE
    }));
    children.push(new Paragraph({
        children: [new TextRun({
            text: 'Generated ' + new Date(data.generatedAt).toLocaleDateString(),
            italics: true,
            color: '888888'
        })]
    }));
    children.push(new Paragraph({ text: '' }));

    children.push(new Paragraph({
        children: [new TextRun({ text: 'User: ', bold: true }), new TextRun(data.user.fullName || data.user.username)]
    }));
    children.push(new Paragraph({
        children: [new TextRun({ text: 'Email: ', bold: true }), new TextRun(data.user.email)]
    }));
    children.push(new Paragraph({ text: '' }));

    children.push(new Paragraph({ text: 'Workout Summary', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph('Total workouts logged: ' + data.totalWorkouts));
    children.push(new Paragraph('Workouts fully completed: ' + data.completedWorkoutsCount));
    children.push(new Paragraph({ text: '' }));

    if (data.completedWorkouts.length > 0) {
        children.push(new Paragraph({ text: 'Completed Workouts', heading: HeadingLevel.HEADING_2 }));
        data.completedWorkouts.forEach(function (w) {
            children.push(new Paragraph(
                '• ' + w.workoutName + ' (' + w.category + ') — ' + new Date(w.date).toLocaleDateString()
            ));
        });
        children.push(new Paragraph({ text: '' }));
    }

    children.push(new Paragraph({ text: 'Nutrition Summary', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph('Total food entries logged: ' + data.nutritionLogsCount));
    children.push(new Paragraph('Total calories: ' + data.nutritionTotals.calories.toFixed(0) + ' kcal'));
    children.push(new Paragraph('Total protein: ' + data.nutritionTotals.protein.toFixed(1) + ' g'));
    children.push(new Paragraph('Total carbs: ' + data.nutritionTotals.carbs.toFixed(1) + ' g'));
    children.push(new Paragraph('Total fat: ' + data.nutritionTotals.fat.toFixed(1) + ' g'));
    children.push(new Paragraph({ text: '' }));

    if (data.subscriptionProgress) {
        var sp = data.subscriptionProgress;
        children.push(new Paragraph({ text: 'Subscription Plan Progress', heading: HeadingLevel.HEADING_1 }));
        children.push(new Paragraph('Plan: ' + sp.planName));
        children.push(new Paragraph('Days completed: ' + sp.daysCompleted + ' / ' + sp.totalDays + ' (' + sp.percentComplete + '%)'));
        if (sp.startDate) children.push(new Paragraph('Started: ' + new Date(sp.startDate).toLocaleDateString()));
        if (sp.expiresAt) children.push(new Paragraph('Expires: ' + new Date(sp.expiresAt).toLocaleDateString()));
    } else {
        children.push(new Paragraph('No active subscription plan.'));
    }

    var doc = new Document({
        sections: [{ children: children }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = { buildProgressDocx };