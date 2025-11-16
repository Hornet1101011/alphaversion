// Type augmentation for Express Request to include user
import { Request as ExpressRequest } from 'express';
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      _id: string;
      username?: string;
      barangayID?: string;
      email?: string;
      address?: string;
      contactNumber?: string;
      role?: string;
      isActive?: boolean;
      department?: string;
      fullName?: string;
    };
  }
}

import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import * as notificationService from '../services/notificationService';
import { io, userSockets } from '../index';
// Helper to emit to all sockets for a user
function emitToUser(userId: string, event: string, payload: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, payload);
    }
  }
}
// CREATE notification (example, add this to your create notification logic)
// After saving notification:
// emitToUser(notification.userId.toString(), 'new-notification', notification);

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user || !(req.user as any)._id) {
      return res.status(401).json({ message: 'Unauthorized: User not found in request' });
    }
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const search = (req.query.search as string) || '';
    const type = (req.query.type as string) || 'all';
    const sort = (req.query.sort as string) || '-createdAt';
    const result = await notificationService.getNotifications({
      userId: (req.user as any)._id,
      page,
      limit,
      search,
      type: type as 'documents' | 'inquiries' | 'system' | 'all',
      sort,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error });
  }
};

// PATCH /api/notifications/mark-read/:id
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    if (!req.user || !(req.user as any)._id) {
      return res.status(401).json({ message: 'Unauthorized: User not found in request' });
    }
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate({ _id: id, userId: (req.user as any)._id }, { read: true });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    // Emit notifications-updated event to user
    emitToUser((req.user as any)._id, 'notifications-updated', { ids: [id] });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read', error });
  }
};

// PATCH /api/notifications/mark-read (bulk)
export const markManyNotificationsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user || !(req.user as any)._id) {
      return res.status(401).json({ message: 'Unauthorized: User not found in request' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No ids provided' });
    await Notification.updateMany({ _id: { $in: ids }, userId: (req.user as any)._id }, { read: true });
    // Emit notifications-updated event to user
    emitToUser((req.user as any)._id, 'notifications-updated', { ids });
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notifications as read', error });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    if (!req.user || !(req.user as any)._id) {
      return res.status(401).json({ message: 'Unauthorized: User not found in request' });
    }
    const { id } = req.params;
    const notification = await Notification.findOneAndDelete({ _id: id, userId: (req.user as any)._id });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    // Emit notifications-deleted event to user
    emitToUser((req.user as any)._id, 'notifications-deleted', { ids: [id] });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification', error });
  }
};

// DELETE /api/notifications (bulk)
export const deleteManyNotifications = async (req: Request, res: Response) => {
  try {
    if (!req.user || !(req.user as any)._id) {
      return res.status(401).json({ message: 'Unauthorized: User not found in request' });
    }
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'No ids provided' });
    await Notification.deleteMany({ _id: { $in: ids }, userId: (req.user as any)._id });
    // Emit notifications-deleted event to user
    emitToUser((req.user as any)._id, 'notifications-deleted', { ids });
    res.json({ message: 'Notifications deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notifications', error });
  }
};
