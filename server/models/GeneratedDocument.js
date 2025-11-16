const mongoose = require('mongoose');

// Store a small metadata record that references the actual GridFS file id
const generatedDocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  contentType: { type: String },
  size: { type: Number },
  // Reference to the GridFS file id stored in the 'documents' bucket
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  sourceTemplateId: { type: mongoose.Schema.Types.ObjectId, required: false },
  requestId: { type: mongoose.Schema.Types.ObjectId, required: false },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'generated_documents' });

// Guard against model recompile in dev
module.exports = mongoose.models && mongoose.models.GeneratedDocument ? mongoose.model('GeneratedDocument') : mongoose.model('GeneratedDocument', generatedDocumentSchema);
