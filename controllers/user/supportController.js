const { ObjectId } = require('mongodb');

// ===============================
// User-facing endpoints
// ===============================

async function submitContact(req, res) {
    try {
        var { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required.'
            });
        }

        var data = {
            name: name.trim(),
            email: email.trim(),
            message: message.trim(),
            date: new Date()
        };

        var result = await req.db.collection('contacts').insertOne(data);

        res.status(201).json({
            success: true,
            message: 'Contact message sent successfully',
            id: result.insertedId
        });
    } catch (error) {
        console.error('Error in submitContact:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function submitFeedback(req, res) {
    try {
        var { rating, comments } = req.body;

        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'A rating between 1 and 5 is required.'
            });
        }

        var data = {
            userId: req.user._id,
            username: req.user.username,
            rating: Number(rating),
            comments: comments ? comments.trim() : '',
            date: new Date()
        };

        var result = await req.db.collection('feedbacks').insertOne(data);

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            id: result.insertedId
        });
    } catch (error) {
        console.error('Error in submitFeedback:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function submitComplaint(req, res) {
    try {
        var { complaintText } = req.body;

        if (!complaintText || !complaintText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Complaint text is required.'
            });
        }

        var data = {
            userId: req.user._id,
            username: req.user.username,
            complaintText: complaintText.trim(),
            status: 'Pending',
            date: new Date()
        };

        var result = await req.db.collection('complaints').insertOne(data);

        res.status(201).json({
            success: true,
            message: 'Complaint registered successfully',
            id: result.insertedId
        });
    } catch (error) {
        console.error('Error in submitComplaint:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

async function getMyComplaints(req, res) {
    try {
        var complaints = await req.db.collection('complaints')
            .find({ userId: req.user._id })
            .sort({ date: -1 })
            .toArray();

        res.json({ success: true, complaints });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// ===============================
// Admin-facing endpointsfeed
// ===============================

async function getAllContacts(req, res) {
    try {
        var contacts = await req.db.collection('contacts').find().sort({ date: -1 }).toArray();
        res.json({ success: true, contacts });
    } catch (error) {
        console.error('Error in getAllContacts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getAllFeedback(req, res) {
    try {
        var feedback = await req.db.collection('feedbacks').find().sort({ date: -1 }).toArray();
        res.json({ success: true, feedback });
    } catch (error) {
        console.error('Error in getAllFeedback:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getAllComplaints(req, res) {
    try {
        var complaints = await req.db.collection('complaints').find().sort({ date: -1 }).toArray();
        res.json({ success: true, complaints });
    } catch (error) {
        console.error('Error in getAllComplaints:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function updateComplaintStatus(req, res) {
    try {
        var { status } = req.body;
        var validStatuses = ['Pending', 'In Progress', 'Resolved'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        var result = await req.db.collection('complaints').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: status } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Complaint not found' });
        }

        res.json({ success: true, message: 'Complaint status updated' });
    } catch (error) {
        console.error('Error in updateComplaintStatus:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    submitContact,
    submitFeedback,
    submitComplaint,
    getMyComplaints,
    getAllContacts,
    getAllFeedback,
    getAllComplaints,
    updateComplaintStatus
};