"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Create middleware functions
const authMiddleware = async (req, res, next) => {
    try {
        let token = req.header('Authorization')?.replace('Bearer ', '');
        // Also check cookies for token (for browser auth)
        if (!token && req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        if (!token) {
            throw new Error();
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'defaultsecret');
        // Fetch user from database
        const { User } = require('../models/User');
        const user = await User.findOne({ _id: decoded._id });
        if (!user) {
            throw new Error();
        }
        // Ensure downstream code always gets username and barangayID
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
            verified: user.verified || false
        };
        next();
    }
    catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};
// Role authorization middleware factory
const authorizeMiddleware = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};
// Named ES exports for TypeScript imports
exports.auth = authMiddleware;
exports.authorize = authorizeMiddleware;
// Also provide CommonJS default export for compatibility with require()
// (some compiled JS files in dist may use require('../middleware/auth'))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
module.exports = { auth: exports.auth, authorize: exports.authorize };
// Diagnostic log to help debug runtime import issues
try {
    // eslint-disable-next-line no-console
    console.log('middleware/auth.ts loaded — auth typeof:', typeof authMiddleware, 'authorize typeof:', typeof authorizeMiddleware);
}
catch (e) {
    // ignore
}
