"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveStaffActivityLog = saveStaffActivityLog;
const Log_1 = require("../models/Log");
/**
 * Save a staff activity log to MongoDB.
 * @param type - The type of activity (e.g., 'CREATE', 'UPDATE', 'DELETE', etc.)
 * @param message - A short description of the activity
 * @param details - Additional details about the activity
 * @param actor - The staff member who performed the activity
 * @param target - The target of the activity (optional)
 */
async function saveStaffActivityLog({ type, message, details, actor, target }) {
    const log = new Log_1.Log({
        type,
        message,
        details,
        actor,
        target
    });
    await log.save();
}
