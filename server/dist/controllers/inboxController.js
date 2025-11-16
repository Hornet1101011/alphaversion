"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResidentInbox = void 0;
const Inquiry_1 = require("../models/Inquiry");
// Get all inquiries for the logged-in resident (for inbox)
const getResidentInbox = async (req, res, next) => {
    try {
        if (!req.user || !req.user.username || !req.user.barangayID) {
            return res.status(401).json({ message: 'Unauthorized: No user found' });
        }
        const { username, barangayID } = req.user;
        // Fetch inquiries by username and barangayID
        const inquiries = await Inquiry_1.Inquiry.find({ username, barangayID }).sort({ createdAt: -1 });
        res.json(inquiries);
    }
    catch (error) {
        next(error);
    }
};
exports.getResidentInbox = getResidentInbox;
