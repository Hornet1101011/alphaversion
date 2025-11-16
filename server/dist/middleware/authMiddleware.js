"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
// isAdmin middleware: verifies JWT (from Authorization header or cookie) and ensures role === 'admin'
const isAdmin = async (req, res, next) => {
    try {
        // Get token from Authorization header or cookies (same behavior as auth middleware)
        let token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token && req.cookies && req.cookies.token)
            token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }
        // Use the same secret fallback as auth middleware to avoid mismatch
        const secret = process.env.JWT_SECRET || 'defaultsecret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // Support tokens that encode either `._id` or `.id`
        const userId = decoded._id || decoded.id || decoded.uid || decoded.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        // Prevent disabled or suspended users from accessing admin routes
        if (!user.isActive) {
            return res.status(403).json({ message: 'Account is deactivated' });
        }
        if (user.suspendedUntil && user.suspendedUntil instanceof Date && user.suspendedUntil > new Date()) {
            return res.status(403).json({ message: `Account suspended until ${user.suspendedUntil.toISOString()}` });
        }
        if (user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admin role required.' });
        }
        // Attach a lightweight user object similar to auth middleware
        req.user = {
            _id: user._id,
            username: user.username,
            barangayID: user.barangayID,
            email: user.email,
            address: user.address,
            contactNumber: user.contactNumber,
            role: user.role,
            isActive: user.isActive,
            department: user.department,
            fullName: user.fullName,
        };
        next();
    }
    catch (error) {
        // Handle JWT-specific errors more explicitly to give clearer responses and avoid noisy stack traces
        const errAny = error;
        if (errAny && (errAny.name === 'TokenExpiredError' || errAny.name === 'token expired')) {
            // TokenExpiredError includes an `expiredAt` property
            console.warn('isAdmin auth token expired:', errAny.expiredAt || errAny.message);
            return res.status(401).json({ message: 'Token expired', expiredAt: errAny.expiredAt });
        }
        if (errAny && errAny.name === 'JsonWebTokenError') {
            console.warn('isAdmin auth invalid token:', errAny.message);
            return res.status(401).json({ message: 'Invalid token' });
        }
        // Fallback for other errors
        console.error('isAdmin auth error:', errAny && errAny.message ? errAny.message : errAny);
        res.status(401).json({ message: 'Token is not valid' });
    }
};
exports.isAdmin = isAdmin;
