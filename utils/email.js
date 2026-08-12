const nodemailer = require('nodemailer');

// Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==============================
// Send Verification Email
// ==============================
const sendVerificationEmail = async (email, token) => {

    // Include BOTH token and email
    const verificationUrl =
        `${process.env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - Fitness Tracker',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
                <h2 style="color:#2563eb;">Verify Your Email</h2>

                <p>Hello,</p>

                <p>
                    Thank you for registering with <strong>Fitness Tracker</strong>.
                    Please verify your email address by clicking the button below.
                </p>

                <p style="margin:30px 0;">
                    <a href="${verificationUrl}"
                       style="
                            background:#2563eb;
                            color:#ffffff;
                            padding:12px 24px;
                            text-decoration:none;
                            border-radius:6px;
                            display:inline-block;
                            font-weight:bold;
                       ">
                        Verify Email
                    </a>
                </p>

                <p>If the button doesn't work, copy and paste this link into your browser:</p>

                <p style="word-break:break-all;">
                    <a href="${verificationUrl}">
                        ${verificationUrl}
                    </a>
                </p>

                <p>
                    <strong>This verification link will expire in 24 hours.</strong>
                </p>

                <hr>

                <p style="font-size:13px;color:#666;">
                    If you didn't create this account, you can safely ignore this email.
                </p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

// ==============================
// Send Reset Password Email
// ==============================
const sendResetPasswordEmail = async (email, token) => {

    const resetUrl =
        `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Reset Password - Fitness Tracker',
        html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;">
                <h2 style="color:#dc2626;">Reset Your Password</h2>

                <p>Click the button below to reset your password.</p>

                <p style="margin:30px 0;">
                    <a href="${resetUrl}"
                       style="
                            background:#dc2626;
                            color:#ffffff;
                            padding:12px 24px;
                            text-decoration:none;
                            border-radius:6px;
                            display:inline-block;
                            font-weight:bold;
                       ">
                        Reset Password
                    </a>
                </p>

                <p>If the button doesn't work, copy and paste this link into your browser:</p>

                <p style="word-break:break-all;">
                    <a href="${resetUrl}">
                        ${resetUrl}
                    </a>
                </p>

                <p>
                    <strong>This link will expire in 1 hour.</strong>
                </p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendResetPasswordEmail
};