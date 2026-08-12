const nodemailer = require('nodemailer');
const { getProgressData } = require('../../utils/progressReport');
const { buildProgressPDF } = require('../../utils/progressPdf');
const { buildProgressDocx } = require('../../utils/progressDocx');

// View report data as JSON (for an in-app preview page)
async function getProgressReport(req, res) {
    try {
        var data = await getProgressData(req.db, req.user._id);
        res.json({ success: true, report: data });
    } catch (err) {
        console.error('Error in getProgressReport:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

// Download as PDF
async function downloadProgressPDF(req, res) {
    try {
        var data = await getProgressData(req.db, req.user._id);
        var pdfBuffer = await buildProgressPDF(data);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="progress-report.pdf"'
        });
        res.send(pdfBuffer);
    } catch (err) {
        console.error('Error in downloadProgressPDF:', err);
        res.status(500).json({ success: false, message: 'Could not generate PDF' });
    }
}

// Download as Word (.docx)
async function downloadProgressDocx(req, res) {
    try {
        var data = await getProgressData(req.db, req.user._id);
        var docxBuffer = await buildProgressDocx(data);

        res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="progress-report.docx"'
        });
        res.send(docxBuffer);
    } catch (err) {
        console.error('Error in downloadProgressDocx:', err);
        res.status(500).json({ success: false, message: 'Could not generate Word document' });
    }
}

// Email the report as a PDF attachment
async function emailProgressReport(req, res) {
    try {
        var data = await getProgressData(req.db, req.user._id);
        var pdfBuffer = await buildProgressPDF(data);

        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: data.user.email,
            subject: 'Your Forge Progress Report',
            text: 'Attached is your latest progress report — workouts completed, nutrition totals, and subscription plan progress.',
            attachments: [
                {
                    filename: 'progress-report.pdf',
                    content: pdfBuffer
                }
            ]
        });

        res.json({ success: true, message: 'Progress report emailed successfully' });
    } catch (err) {
        console.error('Error in emailProgressReport:', err);
        res.status(500).json({ success: false, message: 'Could not send progress report email' });
    }
}
async function getWeeklyProgress(req, res) {
    try {
        var sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
 
        var workouts = await req.db.collection('workouts').find({
            userId: req.user._id,
            date: { $gte: sevenDaysAgo }
        }).toArray();
 
        var total = workouts.length;
        var completed = workouts.filter(w =>
            w.exercises && w.exercises.length > 0 && w.exercises.every(ex => ex.completed)
        ).length;
 
        var percent = total > 0 ? Math.round((completed / total) * 100) : 0;
 
        res.json({ success: true, percent: percent, total: total, completed: completed });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
module.exports = {
    getProgressReport,
    downloadProgressPDF,
    downloadProgressDocx,
    emailProgressReport,
    getWeeklyProgress
};