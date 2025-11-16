import express from 'express';
import { auth, authorize } from '../middleware/auth';
import {
	getNotifications,
	markNotificationRead,
	markManyNotificationsRead,
	deleteNotification,
	deleteManyNotifications
} from '../controllers/notificationController';

const router = express.Router();
// Fallback: return empty array if no notifications exist (for dashboard stability)
router.get('/fallback', (req, res) => {
	res.json([]);
});


// GET /api/notifications
router.get('/', auth, getNotifications);

// PATCH /api/notifications/mark-read/:id
router.patch('/mark-read/:id', auth, markNotificationRead);

// PATCH /api/notifications/mark-read (bulk)
router.patch('/mark-read', auth, markManyNotificationsRead);

// DELETE /api/notifications/:id
router.delete('/:id', auth, deleteNotification);

// DELETE /api/notifications (bulk)
router.delete('/', auth, deleteManyNotifications);

export default router;
