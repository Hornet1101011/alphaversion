const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String },
  size: { type: Number },
  // Store full file buffer inline (beware 16MB BSON limit)
  file: { type: Buffer },
  // Optional chunks: store as array of base64 strings to allow partial retrieval
  chunks: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'documents' });

// Guard against model recompile in dev
module.exports = mongoose.models && mongoose.models.Document ? mongoose.model('Document') : mongoose.model('Document', documentSchema);
