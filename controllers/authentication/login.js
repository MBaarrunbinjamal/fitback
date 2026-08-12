const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login User
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const db = req.db;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/email and password are required'
            });
        }

        const user = await db.collection('users').findOne({
            $or: [{ username: identifier }, { email: identifier }]
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email first'
            });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated'
            });
        }

      if (!user.password) {
    return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please continue with Google."
    });
}

const isMatch = await bcrypt.compare(password, user.password);

if (!isMatch) {
    return res.status(401).json({
        success: false,
        message: "Invalid credentials"
    });
}

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.SECRET_KEY,
            { expiresIn: '7d' }
        );

        delete user.password;

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};