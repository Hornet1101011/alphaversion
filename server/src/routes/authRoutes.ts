import express, { Request, Response, NextFunction } from 'express';
const authModule = require('../middleware/auth');
// Diagnostic: print raw module for debugging runtime interop issues
// eslint-disable-next-line no-console
console.log('authRoutes: raw auth module =', authModule);
const { auth, authorize } = authModule;
import { User } from '../models/User';
import { loginLimiter } from '../middleware/rateLimit';

import {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword
} from '../controllers/authController';

import {
  forgotPassword,
  resetPassword,
  verifyOtpAndEmailNewPassword
} from '../controllers/otpController';
// load guest controller (use require() to avoid TS module resolution timing issues)
const guestController = require('../controllers/guestController');
const createGuest = guestController.createGuest || guestController.default || guestController;
import { createRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Diagnostic: log auth middleware type to help debug "argument handler must be a function"
try {
  // eslint-disable-next-line no-console
  console.log('authRoutes: auth middleware type =', typeof auth);
  // eslint-disable-next-line no-console
  console.log('authRoutes: auth value =', auth && (auth as any).name ? (auth as any).name : auth);
} catch (e) {
  console.error('authRoutes diagnostic error', e);
}

// OTP and password reset endpoints
// Rate limit forgot-password to 5 requests per hour per IP to prevent abuse
const forgotPasswordLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset attempts from this IP, please try again after an hour.' });
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
// Token-based reset endpoint
// Allow POST reset either via URL token (link flow) or body token (OTP/code flow)
const resetPasswordLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many password reset attempts from this IP, please try again after an hour.' });
router.post('/reset-password/:token', resetPasswordLimiter, resetPassword);
router.post('/reset-password', resetPasswordLimiter, resetPassword);
// Verify OTP and generate/email a temporary password
router.post('/verify-otp', resetPasswordLimiter, verifyOtpAndEmailNewPassword);

// Public routes with rate limiting
// Allow unlimited public registrations for now (no rate-limiter)
router.post('/register', (req: any, res: Response, next?: NextFunction) => register(req, res, next));
router.post('/login', loginLimiter, (req: any, res: Response) => login(req, res));
// Guest creation (public)
router.post('/guest', async (req: any, res: Response) => createGuest(req, res));

// Protected routes (require authentication)
router.get('/me', auth, (req: any, res: Response) => getCurrentUser(req, res));
router.patch('/profile', auth, (req: any, res: Response) => updateProfile(req, res));
router.post('/change-password', auth, (req: any, res: Response) => changePassword(req, res));

// Admin only routes
router.post('/register/staff', auth, authorize('admin'), (req: any, res: Response, next?: NextFunction) => register(req, res, next));
router.get('/users', auth, async (req: any, res: Response, next?: NextFunction) => {
  try {
    const users = await User.find({}).select('-password');
    // Map users to only include fields expected by frontend
    const mapped = users.map(user => ({
      _id: user._id,
      fullName: user.fullName || user.username || '',
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: (user as any).createdAt,
      // expose barangay identifier if present (common variants)
      barangayID: (user as any).barangayID || (user as any).barangayId || (user as any).barangay_id || null,
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
});

// Account management routes
router.patch('/users/:id/status', auth, authorize('admin'), async (req: any, res: Response, next?: NextFunction) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user status', error });
  }
});

// Logout route (JWT: just clear token on client, but for completeness)
router.post('/logout', (req: Request, res: Response) => {
  // If using JWT, instruct client to delete token
  // If using sessions, destroy session here
  res.status(200).json({ message: 'Logged out successfully.' });
});

export default router;
