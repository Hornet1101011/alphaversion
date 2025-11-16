const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['unread', 'read'], default: 'unread' },
  createdAt: { type: Date, default: Date.now }
});

// Guard model creation to avoid OverwriteModelError during hot-reloads
module.exports = mongoose.models && mongoose.models.Message
  ? mongoose.model('Message')
  : mongoose.model('Message', MessageSchema);
