const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { User } = require('../models/User');
const { Message } = require('../models/Message');
const { auth } = require('../middleware/auth');

// Create notification
router.post('/', auth, async (req, res) => {
  try {
    const { userId, type, message } = req.body;
    const notification = await Notification.create({ userId, type, message });
    res.status(201).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get notifications for a user
router.get('/:userId', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET / - if user is authenticated, return their notifications, else return empty array
router.get('/', auth, async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.json([]);
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

// Approve a staff request - expects { userId, notificationId }
router.post('/approve', auth, async (req, res) => {
  try {
    const { userId, notificationId } = req.body;
    if (!userId || !notificationId) return res.status(400).json({ message: 'userId and notificationId are required' });
    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // If already staff, just mark notification read
    if (user.role === 'staff') {
      await Notification.findByIdAndUpdate(notificationId, { read: true });
      return res.json({ message: 'User already staff, notification marked read' });
    }
    // Promote to staff
    user.role = 'staff';
    user.isActive = true;
    await user.save();
    // Mark notification as read (or remove)
    await Notification.findByIdAndDelete(notificationId);
    // Optionally, send a confirmation message to the user
    try {
      await Message.create({
        to: user._id,
        from: req.user && req.user._id ? req.user._id : undefined,
        subject: 'Staff access approved',
        text: 'Your request for staff access has been approved. You now have staff privileges.'
      });
    } catch (e) {
      console.warn('Failed to create approval message', e);
    }
    res.json({ message: 'User promoted to staff' });
  } catch (err) {
    console.error('Error approving staff request', err);
    res.status(500).json({ error: err.message || err });
  }
});

// Reject a staff request - expects { notificationId, reason }
router.post('/reject', auth, async (req, res) => {
  try {
    const { notificationId, reason } = req.body;
    if (!notificationId) return res.status(400).json({ message: 'notificationId is required' });
    const notif = await Notification.findById(notificationId);
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    const requesterId = notif.data && notif.data.userId ? notif.data.userId : notif.userId || notif.user;
    // Delete the staff request notification
    await Notification.findByIdAndDelete(notificationId);
    // Send a rejection message to the requester if we can find them
    if (requesterId) {
      try {
        await Message.create({
          to: requesterId,
          from: req.user && req.user._id ? req.user._id : undefined,
          subject: 'Staff access rejected',
          text: reason && reason.trim() !== '' ? reason : 'Your request for staff access has been rejected.'
        });
      } catch (e) {
        console.warn('Failed to create rejection message', e);
      }
    }
    res.json({ message: 'Staff request rejected and requester notified' });
  } catch (err) {
    console.error('Error rejecting staff request', err);
    res.status(500).json({ error: err.message || err });
  }
});

// Mark a notification as read
router.post('/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ message: 'notificationId is required' });
    await Notification.findByIdAndUpdate(notificationId, { read: true });
    res.json({ message: 'Notification marked read' });
  } catch (err) {
    console.error('Error marking notification read', err);
    res.status(500).json({ error: err.message || err });
  }
});
