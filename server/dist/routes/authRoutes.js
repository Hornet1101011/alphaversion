"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authModule = require('../middleware/auth');
// Diagnostic: print raw module for debugging runtime interop issues
// eslint-disable-next-line no-console
console.log('authRoutes: raw auth module =', authModule);
const { auth, authorize } = authModule;
const User_1 = require("../models/User");
const rateLimit_1 = require("../middleware/rateLimit");
const authController_1 = require("../controllers/authController");
const otpController_1 = require("../controllers/otpController");
// load guest controller (use require() to avoid TS module resolution timing issues)
const guestController = require('../controllers/guestController');
const createGuest = guestController.createGuest || guestController.default || guestController;
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = express_1.default.Router();
// Diagnostic: log auth middleware type to help debug "argument handler must be a function"
try {
    // eslint-disable-next-line no-console
    console.log('authRoutes: auth middleware type =', typeof auth);
    // eslint-disable-next-line no-console
    console.log('authRoutes: auth value =', auth && auth.name ? auth.name : auth);
}
catch (e) {
    console.error('authRoutes diagnostic error', e);
}
// OTP and password reset endpoints
// Rate limit forgot-password to 5 requests per hour per IP to prevent abuse
const forgotPasswordLimiter = (0, rateLimiter_1.createRateLimiter)({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset attempts from this IP, please try again after an hour.' });
router.post('/forgot-password', forgotPasswordLimiter, otpController_1.forgotPassword);
// Token-based reset endpoint
// Allow POST reset either via URL token (link flow) or body token (OTP/code flow)
const resetPasswordLimiter = (0, rateLimiter_1.createRateLimiter)({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset attempts from this IP, please try again after an hour.' });
router.post('/reset-password/:token', resetPasswordLimiter, otpController_1.resetPassword);
router.post('/reset-password', resetPasswordLimiter, otpController_1.resetPassword);
// Verify OTP and generate/email a temporary password
router.post('/verify-otp', resetPasswordLimiter, otpController_1.verifyOtpAndEmailNewPassword);
// Public routes with rate limiting
// Allow unlimited public registrations for now (no rate-limiter)
router.post('/register', (req, res, next) => (0, authController_1.register)(req, res, next));
router.post('/login', rateLimit_1.loginLimiter, (req, res) => (0, authController_1.login)(req, res));
// Guest creation (public)
router.post('/guest', async (req, res) => createGuest(req, res));
// Protected routes (require authentication)
router.get('/me', auth, (req, res) => (0, authController_1.getCurrentUser)(req, res));
router.patch('/profile', auth, (req, res) => (0, authController_1.updateProfile)(req, res));
router.post('/change-password', auth, (req, res) => (0, authController_1.changePassword)(req, res));
// Admin only routes
router.post('/register/staff', auth, authorize('admin'), (req, res, next) => (0, authController_1.register)(req, res, next));
router.get('/users', auth, async (req, res, next) => {
    try {
        const users = await User_1.User.find({}).select('-password');
        // Map users to only include fields expected by frontend
        const mapped = users.map(user => ({
            _id: user._id,
            fullName: user.fullName || user.username || '',
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            // expose barangay identifier if present (common variants)
            barangayID: user.barangayID || user.barangayId || user.barangay_id || null,
        }));
        res.json(mapped);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching users', error });
    }
});
// Account management routes
router.patch('/users/:id/status', auth, authorize('admin'), async (req, res, next) => {
    try {
        const { isActive } = req.body;
        const user = await User_1.User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({
            message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
            user
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating user status', error });
    }
});
// Logout route (JWT: just clear token on client, but for completeness)
router.post('/logout', (req, res) => {
    // If using JWT, instruct client to delete token
    // If using sessions, destroy session here
    res.status(200).json({ message: 'Logged out successfully.' });
});
exports.default = router;
