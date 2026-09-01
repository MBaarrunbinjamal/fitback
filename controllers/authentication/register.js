const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../../utils/email');

// Register User
exports.register = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;
        const db = req.db;

        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        const existingUser = await db.collection('users').findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newUser = {
            username,
            email,
            password: hashedPassword,
            role: 'user',
            status: 'pending',
            subscriber: false,
            isVerified: false,
            verificationToken: verificationToken,
            verificationExpiry: verificationExpiry,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('users').insertOne(newUser);

        // Fire-and-forget: don't let email failures block registration
        sendVerificationEmail(email, verificationToken).catch(err => {
            console.error('Failed to send verification email:', err);
        });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully. Please verify your email.',
            user: {
                id: result.insertedId,
                username,
                email
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};