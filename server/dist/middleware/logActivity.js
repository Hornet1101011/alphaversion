"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
const ActivityLog_1 = require("../models/ActivityLog");
async function logActivity(req, module, action, description) {
    try {
        const user = req.user;
        if (!user || !user._id) {
            // Skip logging if userId is missing
            return;
        }
        const userId = user._id;
        const userRole = user.role || 'GUEST';
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        await ActivityLog_1.ActivityLog.create({
            timestamp: new Date(),
            userId,
            userRole,
            module,
            action,
            description,
            ipAddress,
        });
    }
    catch (err) {
        // Optionally log error
        console.error('Activity log error:', err);
    }
}
