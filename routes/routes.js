var express = require('express');
var router = express.Router();
var auth = require('../middleware/auth');
const { googleLogin } = require("../controllers/authentication/googleLogin");
var adminAuth = require('../middleware/Adminauth');
var loginController = require('../controllers/authentication/login');
var registerController = require('../controllers/authentication/register');
var verifyEmailController = require('../controllers/authentication/verifyEmail');
var forgotPasswordController = require('../controllers/authentication/forgotPassword');
var adminController = require('../controllers/admin/admin');
var userController = require('../controllers/user/user');
var {
    createNutritionLog,
    getTodayNutrition,
    getNutritionByDate,
    deleteNutritionLog,
    getNutritionHistory
} = require("../controllers/user/nutritionController");
var supportController = require('../controllers/user/supportController');

const progressController = require('../controllers/user/progressController');

// Register
router.post('/auth/register', registerController.register);

// Login
router.post('/auth/login', loginController.login);

// Logout
router.post('/auth/logout', auth, loginController.logout);

// Verify Email
router.get('/auth/verify-email', verifyEmailController.verifyEmail);

// Resend Verification
router.post('/auth/resend-verification', verifyEmailController.resendVerification);

// Forgot Password
router.post('/auth/forgot-password', forgotPasswordController.forgotPassword);

// Reset Password
router.post('/auth/reset-password', forgotPasswordController.resetPassword);
router.post("/auth/google", googleLogin);
router.post('/workouts', auth, userController.createWorkout);
router.get('/workouts', auth, userController.getWorkouts);
router.get('/workouts/today', auth, userController.getTodaysWorkouts); 
router.get('/workouts/:id', auth, userController.getSingleWorkout);
router.put('/workouts/:id', auth, userController.updateWorkout);
router.delete('/workouts/:id', auth, userController.deleteWorkout);
router.post('/reminders', auth, userController.createReminder);
router.get('/reminders', auth, userController.getReminders);
router.put('/reminders/:id', auth, userController.updateReminder);
router.delete('/reminders/:id', auth, userController.deleteReminder);
router.patch('/workouts/:workoutId/exercises/:exerciseIndex', auth, userController.toggleExerciseComplete);

router.get('/auth/me', auth, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});


router.get('/getuser', auth,userController.getUser);
router.put('/update', auth, userController.upload.single('profilePicture'), userController.updateUser);

router.post('/subscribe', auth, userController.subscribe);
router.get('/my-workout-plan', auth, userController.getMyWorkoutPlan);
router.get('/subscription-plans', userController.getsubscriptionPlans);
router.get('/subscription-plans/:id', userController.getsinglesubscriptionPlan);

router.post("/nutrition", auth, createNutritionLog);


router.get("/nutrition/today", auth, getTodayNutrition);

router.get("/nutrition/date/:date", auth, getNutritionByDate);
router.get("/nutrition/history", auth, getNutritionHistory);

router.delete("/nutrition/:id", auth, deleteNutritionLog);  
router.get('/admin/users',  auth, adminController.getAllUsers);
router.delete('/admin/users/:id',  auth, adminController.deleteUser);
router.get('/admin/requests',  auth, adminController.getworkoutRequests);
router.post('/admin/requests/:id/accept',  auth, adminController.acceptrequest);
router.post('/admin/requests/:id/reject',  auth, adminController.rejectrequest);
router.patch('/my-workout-plan/:dayIndex/exercises/:exerciseIndex', auth, userController.toggleSubscriptionExerciseComplete);
router.post('/admin/subscription-plans',  adminController.addsubscriptionPlan);
router.get('/progress-report', auth, progressController.getProgressReport);
router.get('/progress-report/pdf', auth, progressController.downloadProgressPDF);
router.get('/progress-report/docx', auth, progressController.downloadProgressDocx);
router.post('/progress-report/email', auth, progressController.emailProgressReport);
router.get('/progress/weekly', auth, progressController .getWeeklyProgress);
router.post('/contact',auth, supportController.submitContact); 
router.post('/feedback', auth, supportController.submitFeedback);
router.post('/complain', auth, supportController.submitComplaint);
router.get('/my-complaints', auth, supportController.getMyComplaints);
router.get('/admin/contacts', auth,  supportController.getAllContacts);
router.get('/admin/feedback',   supportController.getAllFeedback);
router.get('/admin/complaints', auth,  supportController.getAllComplaints);
router.put('/admin/complaints/:id/status', auth, supportController.updateComplaintStatus);
module.exports = router;