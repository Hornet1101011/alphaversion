"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuest = void 0;
const Guest_1 = require("../models/Guest");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const createGuest = async (req, res) => {
    try {
        const { name, contactNumber, email, intent } = req.body || {};
        if (!name || !contactNumber || !intent) {
            return res.status(400).json({ message: 'Missing required guest fields: name, contactNumber, intent' });
        }
        // generate a secure session token for guest
        const sessionToken = crypto_1.default.randomBytes(24).toString('hex');
        const guest = new Guest_1.Guest({ name, contactNumber, email, intent, sessionToken });
        await guest.save();
        // create a short-lived JWT so the guest can be treated like a limited user on the client
        const tokenPayload = {
            _id: guest._id.toString(),
            role: 'guest',
            username: (guest.name || 'guest').toString().replace(/\s+/g, '_').toLowerCase(),
        };
        const token = jsonwebtoken_1.default.sign(tokenPayload, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '24h' });
        // respond with minimal guest info and the token
        res.status(201).json({
            _id: guest._id,
            name: guest.name,
            contactNumber: guest.contactNumber,
            email: guest.email,
            intent: guest.intent,
            sessionToken: guest.sessionToken,
            expiresAt: guest.expiresAt,
            token,
        });
    }
    catch (err) {
        console.error('Failed to create guest', err);
        if (err.name === 'ValidationError') {
            const errors = {};
            for (const k in err.errors)
                errors[k] = err.errors[k].message;
            return res.status(400).json({ message: 'Validation failed', errors });
        }
        return res.status(500).json({ message: 'Failed to create guest', error: err.message });
    }
};
exports.createGuest = createGuest;
exports.default = exports.createGuest;
