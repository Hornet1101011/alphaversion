const express = require('express');
const router = express.Router();
const Message = require('../../models/Message');
const { requireAuth } = require('../middleware/auth');

// Send a message
router.post('/', requireAuth, async (req, res) => {
  try {
    const { recipientId, subject, body } = req.body;
    const senderId = req.user._id;
    const message = await Message.create({ senderId, recipientId, subject, body });
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get inbox messages
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({ recipientId: req.user._id }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get sent messages
router.get('/sent', requireAuth, async (req, res) => {
  try {
    const messages = await Message.find({ senderId: req.user._id }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user._id },
      { status: 'read' },
      { new: true }
    );
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get unread count
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const count = await Message.countDocuments({ recipientId: req.user._id, status: 'unread' });
    res.json({ count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
