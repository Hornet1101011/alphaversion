const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { GridFSBucket } = require('mongodb');
const requireAuth = require('../../middleware/requireAuth');
const isAdmin = require('../../middleware/isAdmin');

const ProcessedDocument = require('../../models/ProcessedDocument');

// Stream raw processed file by processed document id
// Stream endpoint: allow any authenticated user (staff) to download processed copies
router.get('/:id/raw', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    console.log('[processed-documents] raw download requested id=', id, 'user=', req.user && req.user._id);
    if (!ObjectId.isValid(id)) {
      console.warn('[processed-documents] invalid id requested:', id);
      res.set('X-Processed-Source', 'invalid-id');
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    // Try to find a ProcessedDocument metadata record first
    const meta = await ProcessedDocument.findById(id).lean();
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
    const bucket = new GridFSBucket(db, { bucketName: 'processed_documents' });

    // If metadata exists, stream by meta.gridFsFileId
    if (meta && meta.gridFsFileId) {
      const fileId = meta.gridFsFileId;
      try {
        res.set('Content-Type', meta.contentType || 'application/octet-stream');
        const filename = meta.filename || `processed_${id}`;
        res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        // Indicate for debugging which source served the file
        res.set('X-Processed-Source', 'metadata');
        res.set('X-Processed-Meta-Id', String(meta._id));
        const downloadStream = bucket.openDownloadStream(ObjectId(fileId));
        downloadStream.on('error', (err) => {
          console.error('GridFS download error for processed document', err);
          res.set('X-Processed-Source', 'metadata-error');
          return res.status(404).json({ success: false, message: 'File not found in GridFS' });
        });
        return downloadStream.pipe(res);
      } catch (err) {
        console.error('Error streaming processed file from GridFS (meta):', err);
        res.set('X-Processed-Source', 'metadata-exception');
        return res.status(500).json({ success: false, message: 'Failed to stream file' });
      }
    }

    // If no metadata record, try treating the provided id as a GridFS file id (fallback for older files)
    if (ObjectId.isValid(id)) {
      try {
        // Attempt to find the GridFS file doc
        const filesColl = db.collection('processed_documents.files');
        const fileDoc = await filesColl.findOne({ _id: ObjectId(id) });
        if (!fileDoc) {
          console.warn('[processed-documents] GridFS fallback lookup failed for id=', id);
          res.set('X-Processed-Source', 'not-found');
          return res.status(404).json({ success: false, message: 'Processed document not found' });
        }

        const filename = fileDoc.filename || `processed_${id}`;
        res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.set('X-Processed-Source', 'gridfs');
        res.set('X-Processed-GridFS-Id', String(fileDoc._id));
        const downloadStream = bucket.openDownloadStream(ObjectId(id));
        downloadStream.on('error', (err) => {
          console.error('GridFS download error for fallback processed document', err);
          res.set('X-Processed-Source', 'gridfs-error');
          return res.status(404).json({ success: false, message: 'File not found in GridFS' });
        });
        return downloadStream.pipe(res);
      } catch (err) {
        console.error('Error streaming processed file from GridFS (fallback):', err);
        res.set('X-Processed-Source', 'gridfs-exception');
        return res.status(500).json({ success: false, message: 'Failed to stream fallback file' });
      }
    }

    // Otherwise, not found
  res.set('X-Processed-Source', 'not-found');
  return res.status(404).json({ success: false, message: 'Processed document not found' });
  } catch (err) {
    console.error('processedDocuments GET error', err);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

// List processed documents (admin only) - paginated
// List processed documents: allow authenticated staff to list processed copies
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;
    const query = {};
    if (req.query.filename) query.filename = { $regex: String(req.query.filename), $options: 'i' };
    if (req.query.uploadedBy && ObjectId.isValid(String(req.query.uploadedBy))) query.uploadedBy = ObjectId(String(req.query.uploadedBy));

    const total = await ProcessedDocument.countDocuments(query);
      let items = await ProcessedDocument.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

      // If there are no metadata records, but GridFS files exist (older uploads or missing metadata),
      // fall back to reading the processed_documents.files collection so the UI can still list files.
      if ((total === 0 || (Array.isArray(items) && items.length === 0))) {
        try {
          const db = require('mongoose').connection.db;
          if (db) {
            const filesColl = db.collection('processed_documents.files');
            const fileQuery = {};
            if (req.query.filename) fileQuery.filename = { $regex: String(req.query.filename), $options: 'i' };
            // count gridfs files
            const fallbackTotal = await filesColl.countDocuments(fileQuery);
            const fileDocs = await filesColl.find(fileQuery).sort({ uploadDate: -1 }).skip(skip).limit(limit).toArray();
            // Map GridFS file docs into the same shape expected by the client
            items = fileDocs.map(f => ({
              _id: f._id,
              filename: f.filename,
              contentType: (f.contentType || 'application/octet-stream'),
              size: f.length || f.size || 0,
              gridFsFileId: f._id,
              createdAt: f.uploadDate || f.uploadDate,
              metadata: f.metadata || {}
            }));
            return res.json({ success: true, total: fallbackTotal, page, limit, items });
          }
        } catch (fbErr) {
          console.warn('Fallback to GridFS files failed:', fbErr && fbErr.message);
        }
      }

      return res.json({ success: true, total, page, limit, items });
  } catch (err) {
    console.error('processedDocuments list error', err);
    return res.status(500).json({ success: false, message: 'Failed to list processed documents' });
  }
});

// Get metadata for a processed document (admin only)
// Get metadata for a processed document: allow authenticated staff to view metadata
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const meta = await ProcessedDocument.findById(id).lean();
    if (!meta) return res.status(404).json({ success: false, message: 'Processed document not found' });
    return res.json({ success: true, item: meta });
  } catch (err) {
    console.error('processedDocuments metadata error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch metadata' });
  }
});

module.exports = router;

// Register an upload endpoint to save arbitrary files into the processed_documents GridFS
// This is used by clients as a fallback to ensure generated copies are persisted in the
// processed_documents bucket. Protected by requireAuth + isAdmin.
try {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB

  // Allow any authenticated staff (requireAuth) to upload processed copies — do not require admin role here.
  router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
      const buffer = req.file.buffer;
      const filename = req.file.originalname || `uploaded_${Date.now()}`;
      const contentType = req.file.mimetype || 'application/octet-stream';

      const db = require('mongoose').connection.db;
      if (!db) return res.status(500).json({ success: false, message: 'Database not available' });
      const { Readable } = require('stream');
      const { GridFSBucket } = require('mongodb');
      const bucket = new GridFSBucket(db, { bucketName: 'processed_documents' });

      const readable = new Readable();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);

      const uploadStream = bucket.openUploadStream(filename, { contentType });
      await new Promise((resolve, reject) => {
        readable.pipe(uploadStream)
          .on('error', (err) => { console.error('Error uploading to processed_documents GridFS', err); reject(err); })
          .on('finish', () => resolve(null));
      });

      const savedId = uploadStream.id;

      // Create processed document metadata
      try {
        const ProcessedDocumentModel = require('../../models/ProcessedDocument');
        const pd = new ProcessedDocumentModel({
          filename,
          contentType,
          size: buffer.length,
          gridFsFileId: savedId,
          metadata: req.body.metadata ? JSON.parse(req.body.metadata || '{}') : {},
          sourceTemplateId: req.body.sourceTemplateId && require('mongoose').Types.ObjectId.isValid(req.body.sourceTemplateId) ? require('mongoose').Types.ObjectId(req.body.sourceTemplateId) : undefined,
          requestId: req.body.requestId && require('mongoose').Types.ObjectId.isValid(req.body.requestId) ? require('mongoose').Types.ObjectId(req.body.requestId) : undefined,
          uploadedBy: req.user && req.user._id ? req.user._id : undefined
        });
        const saved = await pd.save();
        res.set('X-Processed-Doc-Id', String(saved._id));
      } catch (metaErr) {
        console.warn('Failed to save processed document metadata (continuing):', metaErr && metaErr.message);
      }

      return res.json({ success: true, gridFsFileId: String(savedId) });
    } catch (err) {
      console.error('processedDocuments upload error', err);
      return res.status(500).json({ success: false, message: 'Upload failed', error: err && err.message });
    }
  });
} catch (e) {
  console.error('Failed to register processed-documents upload route', e);
}
