"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
// Fallback: return empty array if no notifications exist (for dashboard stability)
router.get('/fallback', (req, res) => {
    res.json([]);
});
// GET /api/notifications
router.get('/', auth_1.auth, notificationController_1.getNotifications);
// PATCH /api/notifications/mark-read/:id
router.patch('/mark-read/:id', auth_1.auth, notificationController_1.markNotificationRead);
// PATCH /api/notifications/mark-read (bulk)
router.patch('/mark-read', auth_1.auth, notificationController_1.markManyNotificationsRead);
// DELETE /api/notifications/:id
router.delete('/:id', auth_1.auth, notificationController_1.deleteNotification);
// DELETE /api/notifications (bulk)
router.delete('/', auth_1.auth, notificationController_1.deleteManyNotifications);
exports.default = router;
