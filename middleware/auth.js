const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

module.exports = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token, authorization denied'
            });
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const db = req.db;

        const user = await db.collection('users').findOne(
            { _id: new ObjectId(decoded.id) }, // fixed: "id" not "userId"
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        req.userId = user._id;
        next();

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        console.error('Auth middleware error:', error); // add this too, helps future debugging
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};