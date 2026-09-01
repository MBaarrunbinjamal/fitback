const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { sendVerificationEmail } = require('../../utils/email');
const { getDB } = require('../../utils/db');

exports.register = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            confirmPassword
        } = req.body;

        // =========================
        // Validate fields
        // =========================

        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // =========================
        // Check passwords
        // =========================

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        // =========================
        // Get MongoDB
        // =========================

        const db = await getDB();

        console.log('✅ DB available in register:', !!db);

        // =========================
        // Check existing user
        // =========================

        const existingUser = await db.collection('users').findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        }

        // =========================
        // Hash password
        // =========================

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(
            password,
            salt
        );

        // =========================
        // Verification token
        // =========================

        const verificationToken = crypto
            .randomBytes(32)
            .toString('hex');

        const verificationExpiry = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        // =========================
        // New user
        // =========================

        const newUser = {
            username,
            email,
            password: hashedPassword,

            role: 'user',

            status: 'pending',

            subscriber: false,

            isVerified: false,

            verificationToken,

            verificationExpiry,

            createdAt: new Date(),

            updatedAt: new Date()
        };

        // =========================
        // Insert user
        // =========================

        const result = await db
            .collection('users')
            .insertOne(newUser);

        // =========================
        // Send verification email
        // =========================

        sendVerificationEmail(
            email,
            verificationToken
        ).catch((err) => {
            console.error(
                'Failed to send verification email:',
                err
            );
        });

        // =========================
        // Success
        // =========================

        return res.status(201).json({
            success: true,
            message:
                'User registered successfully. Please verify your email.',

            user: {
                id: result.insertedId,
                username,
                email
            }
        });

    } catch (error) {

        console.error(
            '❌ Register error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};