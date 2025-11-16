"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogs = void 0;
const ActivityLog_1 = require("../models/ActivityLog");
// GET /activity-logs?userId=&module=&action=&fromDate=&toDate=&page=&pageSize=&search=
const getActivityLogs = async (req, res) => {
    try {
        const { userId, module, action, fromDate, toDate, page = 1, pageSize = 20, search } = req.query;
        const filter = {};
        if (userId)
            filter.userId = userId;
        if (module)
            filter.module = module;
        if (action)
            filter.action = action;
        if (fromDate || toDate) {
            filter.timestamp = {};
            if (fromDate)
                filter.timestamp.$gte = new Date(fromDate);
            if (toDate)
                filter.timestamp.$lte = new Date(toDate);
        }
        if (search) {
            filter.$or = [
                { description: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } },
                { module: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (Number(page) - 1) * Number(pageSize);
        const total = await ActivityLog_1.ActivityLog.countDocuments(filter);
        const logs = await ActivityLog_1.ActivityLog.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(Number(pageSize))
            .populate('userId', 'username fullName email role');
        res.json({
            data: logs,
            total,
            page: Number(page),
            pageSize: Number(pageSize)
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching activity logs', error });
    }
};
exports.getActivityLogs = getActivityLogs;
