const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { GridFSBucket } = require('mongodb');
const requireAuth = require('../../middleware/requireAuth');
const isAdmin = require('../../middleware/isAdmin');

// Small metadata model that references GridFS file id
const GeneratedDocument = require('../../models/GeneratedDocument');

// Stream raw generated file by generated document id
router.get('/:id/raw', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const meta = await GeneratedDocument.findById(id).lean();
    if (!meta) return res.status(404).json({ success: false, message: 'Generated document not found' });

    if (!meta.gridFsFileId) return res.status(404).json({ success: false, message: 'No file associated with this generated document' });

    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database not available' });

    const bucket = new GridFSBucket(db, { bucketName: 'documents' });
    const fileId = meta.gridFsFileId;
    try {
      res.set('Content-Type', meta.contentType || 'application/octet-stream');
      const filename = meta.filename || `generated_${id}`;
      res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      const downloadStream = bucket.openDownloadStream(ObjectId(fileId));
      downloadStream.on('error', (err) => {
        console.error('GridFS download error for generated document', err);
        return res.status(404).json({ success: false, message: 'File not found in GridFS' });
      });
      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error streaming generated file from GridFS:', err);
      return res.status(500).json({ success: false, message: 'Failed to stream file' });
    }
  } catch (err) {
    console.error('generatedDocuments GET error', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// List generated documents (admin only) - paginated
router.get('/', requireAuth, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    const query = {};
    // optional filters: filename, uploadedBy
    if (req.query.filename) query.filename = { $regex: String(req.query.filename), $options: 'i' };
    if (req.query.uploadedBy && ObjectId.isValid(String(req.query.uploadedBy))) query.uploadedBy = ObjectId(String(req.query.uploadedBy));

    const total = await GeneratedDocument.countDocuments(query);
    const items = await GeneratedDocument.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    return res.json({ success: true, total, page, limit, items });
  } catch (err) {
    console.error('generatedDocuments list error', err);
    return res.status(500).json({ success: false, message: 'Failed to list generated documents' });
  }
});

// Get metadata for a generated document (admin only)
router.get('/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const meta = await GeneratedDocument.findById(id).lean();
    if (!meta) return res.status(404).json({ success: false, message: 'Generated document not found' });
    return res.json({ success: true, item: meta });
  } catch (err) {
    console.error('generatedDocuments metadata error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch metadata' });
  }
});

module.exports = router;
