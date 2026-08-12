const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.googleLogin = async (req, res) => {
    try {

        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Credential missing"
            });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const db = req.db;

        let user = await db.collection("users").findOne({
            email: payload.email
        });

        if (!user) {

            const newUser = {

                username: payload.name,

                email: payload.email,

                password: null,

                googleId: payload.sub,

                provider: "google",

                picture: payload.picture,

                role: "user",

                subscriber: false,

                status: "active",

                isVerified: true,

                verificationToken: null,

                verificationExpiry: null,

                createdAt: new Date(),

                updatedAt: new Date()

            };

            const result = await db
                .collection("users")
                .insertOne(newUser);

            user = {
                _id: result.insertedId,
                ...newUser
            };
        }

        const token = jwt.sign(

            {
                id: user._id,
                username: user.username
            },

            process.env.SECRET_KEY,

            {
                expiresIn: "7d"
            }

        );

        delete user.password;

        return res.json({

            success: true,

            message: "Google login successful",

            token,

            user

        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({

            success: false,

            message: "Google authentication failed"

        });

    }
};