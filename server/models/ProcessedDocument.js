const mongoose = require('mongoose');

const processedDocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String },
  size: { type: Number },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sourceTemplateId: { type: mongoose.Schema.Types.ObjectId, required: false },
  requestId: { type: mongoose.Schema.Types.ObjectId, required: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'processed_documents' });

// Guard against model recompilation in dev/hot-reload
module.exports = mongoose.models && mongoose.models.ProcessedDocument ? mongoose.model('ProcessedDocument') : mongoose.model('ProcessedDocument', processedDocumentSchema);
