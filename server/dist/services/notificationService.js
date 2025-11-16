"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.markAsRead = markAsRead;
exports.markManyAsRead = markManyAsRead;
exports.deleteNotification = deleteNotification;
exports.deleteManyNotifications = deleteManyNotifications;
const Notification_1 = require("../models/Notification");
async function getNotifications({ userId, page = 1, limit = 10, search = '', type = 'all', sort = '-createdAt' }) {
    // Accept both `userId` and legacy `user` field names so older seeded docs are returned
    const filter = { $or: [{ userId }, { user: userId }] };
    if (type && type !== 'all')
        filter.type = type;
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { message: { $regex: search, $options: 'i' } },
        ];
    }
    const total = await Notification_1.Notification.countDocuments(filter);
    const data = await Notification_1.Notification.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
    return {
        data,
        total,
        page,
        pages: Math.ceil(total / limit),
    };
}
async function markAsRead(id) {
    return Notification_1.Notification.findByIdAndUpdate(id, { read: true });
}
async function markManyAsRead(ids) {
    return Notification_1.Notification.updateMany({ _id: { $in: ids } }, { read: true });
}
async function deleteNotification(id) {
    return Notification_1.Notification.findByIdAndDelete(id);
}
async function deleteManyNotifications(ids) {
    return Notification_1.Notification.deleteMany({ _id: { $in: ids } });
}
