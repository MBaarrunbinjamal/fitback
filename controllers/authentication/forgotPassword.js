const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendResetPasswordEmail } = require('../../utils/email');

// Forgot Password - Send Reset Link
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.db;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await db.collection('users').updateOne(
            { _id: new ObjectId(user._id) },
            { 
                $set: { 
                    resetPasswordToken: resetToken,
                    resetPasswordExpiry: resetExpiry,
                    updatedAt: new Date()
                } 
            }
        );

        await sendResetPasswordEmail(email, resetToken);

        res.json({
            success: true,
            message: 'Password reset link sent to your email'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const db = req.db;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const user = await db.collection('users').findOne({
            resetPasswordToken: token,
            resetPasswordExpiry: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.collection('users').updateOne(
            { _id: new ObjectId(user._id) },
            { 
                $set: { 
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpiry: null,
                    updatedAt: new Date()
                } 
            }
        );

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};