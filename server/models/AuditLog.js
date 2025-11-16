const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: { type: Object },
  ip: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

// Guard model creation to avoid OverwriteModelError during hot-reloads
module.exports = mongoose.models && mongoose.models.AuditLog
  ? mongoose.model('AuditLog')
  : mongoose.model('AuditLog', auditLogSchema);
