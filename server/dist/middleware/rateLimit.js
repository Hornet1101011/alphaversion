"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLimiter = exports.loginLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Common options for all rate limiters
const commonOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    // Use the default IP key generator which handles IPv4 and IPv6 properly
    keyGenerator: undefined, // This will use the built-in IP key generator
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later'
        });
    }
};
// Login-specific rate limiter
exports.loginLimiter = (0, express_rate_limit_1.default)({
    ...commonOptions,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // More lenient limit for development
    skipFailedRequests: true, // Only count successful requests
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many login attempts from this IP, please try again after 15 minutes'
        });
    }
});
// Registration rate limiter
exports.registerLimiter = (0, express_rate_limit_1.default)({
    ...commonOptions,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 requests per windowMs
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many registration attempts from this IP, please try again after an hour'
        });
    }
});
