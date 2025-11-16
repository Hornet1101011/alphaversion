"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteManyNotifications = exports.deleteNotification = exports.markManyNotificationsRead = exports.markNotificationRead = exports.getNotifications = void 0;
const Notification_1 = require("../models/Notification");
const notificationService = __importStar(require("../services/notificationService"));
const index_1 = require("../index");
// Helper to emit to all sockets for a user
function emitToUser(userId, event, payload) {
    const sockets = index_1.userSockets.get(userId);
    if (sockets) {
        for (const socketId of sockets) {
            index_1.io.to(socketId).emit(event, payload);
        }
    }
}
// CREATE notification (example, add this to your create notification logic)
// After saving notification:
// emitToUser(notification.userId.toString(), 'new-notification', notification);
// GET /api/notifications
const getNotifications = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Unauthorized: User not found in request' });
        }
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const search = req.query.search || '';
        const type = req.query.type || 'all';
        const sort = req.query.sort || '-createdAt';
        const result = await notificationService.getNotifications({
            userId: req.user._id,
            page,
            limit,
            search,
            type: type,
            sort,
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};
exports.getNotifications = getNotifications;
// PATCH /api/notifications/mark-read/:id
const markNotificationRead = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Unauthorized: User not found in request' });
        }
        const { id } = req.params;
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: id, userId: req.user._id }, { read: true });
        if (!notification)
            return res.status(404).json({ message: 'Notification not found' });
        // Emit notifications-updated event to user
        emitToUser(req.user._id, 'notifications-updated', { ids: [id] });
        res.json({ message: 'Notification marked as read' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error marking notification as read', error });
    }
};
exports.markNotificationRead = markNotificationRead;
// PATCH /api/notifications/mark-read (bulk)
const markManyNotificationsRead = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Unauthorized: User not found in request' });
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0)
            return res.status(400).json({ message: 'No ids provided' });
        await Notification_1.Notification.updateMany({ _id: { $in: ids }, userId: req.user._id }, { read: true });
        // Emit notifications-updated event to user
        emitToUser(req.user._id, 'notifications-updated', { ids });
        res.json({ message: 'Notifications marked as read' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error marking notifications as read', error });
    }
};
exports.markManyNotificationsRead = markManyNotificationsRead;
// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Unauthorized: User not found in request' });
        }
        const { id } = req.params;
        const notification = await Notification_1.Notification.findOneAndDelete({ _id: id, userId: req.user._id });
        if (!notification)
            return res.status(404).json({ message: 'Notification not found' });
        // Emit notifications-deleted event to user
        emitToUser(req.user._id, 'notifications-deleted', { ids: [id] });
        res.json({ message: 'Notification deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting notification', error });
    }
};
exports.deleteNotification = deleteNotification;
// DELETE /api/notifications (bulk)
const deleteManyNotifications = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: 'Unauthorized: User not found in request' });
        }
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0)
            return res.status(400).json({ message: 'No ids provided' });
        await Notification_1.Notification.deleteMany({ _id: { $in: ids }, userId: req.user._id });
        // Emit notifications-deleted event to user
        emitToUser(req.user._id, 'notifications-deleted', { ids });
        res.json({ message: 'Notifications deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Error deleting notifications', error });
    }
};
exports.deleteManyNotifications = deleteManyNotifications;
