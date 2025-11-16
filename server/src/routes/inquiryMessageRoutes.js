const express = require('express');
const router = express.Router();
const InquiryMessage = require('../../models/InquiryMessage');
const { requireAuth } = require('../middleware/auth');

// Add a reply to an inquiry
router.post('/', requireAuth, async (req, res) => {
  try {
    const { inquiryId, recipientId, body } = req.body;
    const senderId = req.user._id;
    const message = await InquiryMessage.create({ inquiryId, senderId, recipientId, body });
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch all messages for an inquiry thread
router.get('/:inquiryId', requireAuth, async (req, res) => {
  try {
    const messages = await InquiryMessage.find({ inquiryId: req.params.inquiryId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
