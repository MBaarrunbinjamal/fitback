const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

// =====================================
// Verify Email
// =====================================
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;
        const db = req.db;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        const user = await db.collection('users').findOne({
            verificationToken: token,
            verificationExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        // Activate account
        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    isVerified: true,
                    status: 'active',
                    updatedAt: new Date()
                },
                $unset: {
                    verificationToken: "",
                    verificationExpiry: ""
                }
            }
        );

        // Generate JWT
        const jwtToken = jwt.sign(
            {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.SECRET_KEY,
            {
                expiresIn: '7d'
            }
        );

        // Remove sensitive fields before sending user
        delete user.password;
        delete user.verificationToken;
        delete user.verificationExpiry;

        // Update returned user object
        user.isVerified = true;
        user.status = "active";

        return res.status(200).json({
            success: true,
            message: "Email verified successfully.",
            token: jwtToken,
            user
        });

    } catch (error) {
        console.error("Verify email error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

// =====================================
// Resend Verification Email
// =====================================
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.db;
        const crypto = require('crypto');
        const { sendVerificationEmail } = require('../../utils/email');

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await db.collection('users').findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiry = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        await db.collection('users').updateOne(
            { _id: user._id },
            {
                $set: {
                    verificationToken,
                    verificationExpiry,
                    updatedAt: new Date()
                }
            }
        );

        await sendVerificationEmail(user.email, verificationToken);

        return res.status(200).json({
            success: true,
            message: "Verification email sent successfully."
        });

    } catch (error) {
        console.error("Resend verification error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};