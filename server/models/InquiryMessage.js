const mongoose = require('mongoose');

const InquiryMessageSchema = new mongoose.Schema({
  inquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inquiry', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Guard model creation to avoid OverwriteModelError during hot-reloads
module.exports = mongoose.models && mongoose.models.InquiryMessage
  ? mongoose.model('InquiryMessage')
  : mongoose.model('InquiryMessage', InquiryMessageSchema);
