// Generate filled document from GridFS file and request data
const requireAuth = require('../../middleware/requireAuth');
const isAdmin = require('../../middleware/isAdmin');
router.post('/:fileId/generate-filled', requireAuth, isAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { ObjectId } = mongoose.Types;
    const { GridFSBucket } = require('mongodb');
    const db = mongoose.connection.db;
    if (!db) {
      console.error('MongoDB connection not available');
      return res.status(500).json({ success: false, message: 'Database not initialized.' });
    }
    const bucket = new GridFSBucket(db, { bucketName: 'documents' });
    const fileId = req.params.fileId;
    const fieldValues = req.body.fieldValues || {};
    // Find file metadata
    const files = await db.collection('documents.files').find({ _id: ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    // Collect binary chunks into a buffer so we can support .docx templates
  const chunks = [];
    const downloadStream = bucket.openDownloadStream(ObjectId(fileId));
    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });
      downloadStream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
          const origFilename = (files[0] && files[0].filename) ? String(files[0].filename) : '';
  // If file is a DOCX template, use docxtemplater to render safely (handles split runs)
          if (/\.docx$/i.test(origFilename)) {
          const PizZip = require('pizzip');
          const Docxtemplater = require('docxtemplater');
          const zip = new PizZip(buffer);
          // nullGetter ensures missing tags render as empty strings instead of throwing or producing 'undefined'
          const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
          // Build a very permissive safeData map containing many variants of each submitted key
          // so the template's tag naming (spaces, punctuation, trailing colons) still matches.
          const safeData = {};
          const makeVariants = (k) => {
            const variants = new Set();
            const orig = (k || '').toString();
            const trimmed = orig.trim();
            variants.add(orig);
            variants.add(trimmed);
            // remove trailing colons
            variants.add(trimmed.replace(/[:\s]+$/,'').trim());
            // collapsed spaces
            variants.add(trimmed.replace(/\s+/g, ''));
            // only alphanumerics
            variants.add(trimmed.replace(/[^a-zA-Z0-9]/g, ''));
            // lowercase versions
            Array.from(Array.from(variants)).forEach(v => variants.add((v || '').toLowerCase()));
            return Array.from(variants);
          };
          Object.keys(fieldValues || {}).forEach((k) => {
            const val = fieldValues[k] != null ? fieldValues[k] : '';
            const variants = makeVariants(k);
            variants.forEach((v) => {
              if (v && typeof v === 'string') safeData[v] = val;
            });
          });
          // Also include the original keys in case tags match them exactly
          Object.keys(fieldValues || {}).forEach((k) => { safeData[k] = fieldValues[k] != null ? fieldValues[k] : ''; });
          // Debug mode: return tag names and safeData keys so we can inspect mismatches
          if (req.query && (req.query.debug === '1' || req.query.debug === 'true')) {
            const tagsObj = (typeof doc.getTags === 'function') ? doc.getTags() : {};
            const tagNames = Object.keys(tagsObj || {});
            return res.json({ success: true, debug: true, filename: originalFilename, tagNames, safeDataKeys: Object.keys(safeData) });
          }
          doc.render(safeData);
          const outBuffer = doc.getZip().generate({ type: 'nodebuffer' });
          // Determine filename: prefer username/barangay/type from request body when provided
          const reqBody = req.body || {};
          const rawUsername = reqBody.username || reqBody.user || reqBody.requester || '';
          const rawBarangay = reqBody.barangayID || reqBody.barangay || '';
            const rawType = reqBody.type || reqBody.docType || reqBody.documentType || origFilename || 'document';
          const makeSafe = (s) => {
            return (s || '').toString().trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0,120);
          };
          const parts = [];
          if (rawUsername) parts.push(makeSafe(rawUsername));
          if (rawBarangay) parts.push(makeSafe(rawBarangay));
          if (rawType) parts.push(makeSafe(rawType));
          const filenameBase = parts.length ? parts.join('_') : (files[0] && files[0].filename ? makeSafe(files[0].filename) : `filled_${fileId}`);
          const filename = `${filenameBase}.docx`;
          // Upload generated file to GridFS 'documents' bucket and persist id
          try {
            const filesDb = mongoose.connection.db;
            // Store generated/processed copies in a dedicated GridFS bucket to avoid mixing with general 'documents' bucket
            const documentsBucket = new GridFSBucket(filesDb, { bucketName: 'processed_documents' });
            const { Readable } = require('stream');
            const readable = new Readable();
            readable._read = () => {};
            readable.push(outBuffer);
            readable.push(null);

            const uploadStream = documentsBucket.openUploadStream(filename, {
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            // Wait for upload to finish before responding so we can attach the file id
            await new Promise((resolve, reject) => {
              readable.pipe(uploadStream)
                .on('error', (err) => {
                  console.error('Error uploading filled document to GridFS:', err);
                  reject(err);
                })
                .on('finish', () => resolve(null));
            });

            const savedId = uploadStream.id;
            // Expose the GridFS id for the processed bucket as well
            try { res.set('X-Processed-GridFS-Id', String(savedId)); } catch (e) {}
            // Create a small metadata document that references the GridFS file id (best-effort)
            try {
              const GeneratedDocument = require('../../models/GeneratedDocument');
              const genDocMeta = new GeneratedDocument({
                filename: filename,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: outBuffer.length,
                gridFsFileId: savedId,
                metadata: { sourceFileId: fileId },
                sourceTemplateId: ObjectId.isValid(fileId) ? ObjectId(fileId) : undefined,
                requestId: (req.body && req.body.requestId) ? (ObjectId.isValid(req.body.requestId) ? ObjectId(req.body.requestId) : undefined) : undefined,
                uploadedBy: req.user && req.user._id ? req.user._id : undefined
              });
              try {
                const savedMeta = await genDocMeta.save();
                res.set('X-Generated-Doc-Id', String(savedMeta._id));
              } catch (metaErr) {
                console.warn('Failed to save generated document metadata (continuing):', metaErr && metaErr.message);
              }
            } catch (metaErr2) {
              console.warn('GeneratedDocument model not found or failed to create metadata:', metaErr2 && metaErr2.message);
            }

            // Also ensure a processed_documents record exists (references the GridFS file id).
            try {
              const ProcessedDocument = require('../../models/ProcessedDocument');
              const pdQuery = {};
              if (ObjectId.isValid(fileId)) pdQuery.sourceTemplateId = ObjectId(fileId);
              if (req.body && req.body.requestId && ObjectId.isValid(req.body.requestId)) pdQuery.requestId = ObjectId(req.body.requestId);
              // If no identifying info available, fall back to filename and source metadata to avoid duplicates by name
              if (!pdQuery.sourceTemplateId && !pdQuery.requestId) {
                pdQuery.filename = filename;
                pdQuery['metadata.sourceFileId'] = fileId;
              }

              const existingProcessed = await ProcessedDocument.findOne(pdQuery).lean();
              if (!existingProcessed) {
                const newProcessed = new ProcessedDocument({
                  filename: filename,
                  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  size: outBuffer.length,
                  gridFsFileId: savedId,
                  metadata: { sourceFileId: fileId },
                  sourceTemplateId: pdQuery.sourceTemplateId,
                  requestId: pdQuery.requestId,
                  uploadedBy: req.user && req.user._id ? req.user._id : undefined
                });
                try {
                  const savedProcessed = await newProcessed.save();
                  // expose processed document id to client
                  try { res.set('X-Processed-Doc-Id', String(savedProcessed._id)); } catch (e) {}
                } catch (procSaveErr) {
                  console.warn('Failed to save processed document metadata (continuing):', procSaveErr && procSaveErr.message);
                }
              } else {
                try { res.set('X-Processed-Doc-Id', String(existingProcessed._id)); } catch (e) {}
              }
            } catch (procErr) {
              console.warn('ProcessedDocument model not available or save failed (continuing):', procErr && procErr.message);
            }
            // If frontend provided a requestId, persist to DocumentRequest.filledFileId
            try {
              const DocumentRequest = require('../models/DocumentRequest').DocumentRequest || require('../models/DocumentRequest').default;
              const requestId = (req.body && req.body.requestId) || req.query.requestId;
              if (requestId) {
                // try-catch to avoid blocking response on DB update failure
                try {
                  await DocumentRequest.findByIdAndUpdate(requestId, { filledFileId: savedId }, { new: true });
                } catch (err) {
                  console.error('Error saving filledFileId on DocumentRequest:', err);
                }
              }
            } catch (err) {
              console.error('DocumentRequest model not available to persist filledFileId:', err);
            }

            // Return file and include saved id in header
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
            res.set('X-Filled-File-Id', String(savedId));
            return res.send(outBuffer);
          } catch (err) {
            console.error('Error during GridFS upload for generated file:', err);
            // Fallback: still return the generated buffer
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
            return res.send(outBuffer);
          }
        }

        // Fallback: treat file as text/HTML and perform safe replacements
        let fileContent = buffer.toString();
        let filled = fileContent;
        const escapeRegExp = (s) => (s || '').toString().replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        Object.keys(fieldValues || {}).forEach((key) => {
          const safeVal = fieldValues[key] != null ? String(fieldValues[key]) : '';
          const regex = new RegExp('\\{' + escapeRegExp(key) + '\\}', 'g');
          filled = filled.replace(regex, safeVal);
        });
        res.set('Content-Type', 'text/plain');
        return res.send(filled);
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Error processing template', error: err.message });
      }
    });
    downloadStream.on('error', () => {
      res.status(404).json({ success: false, message: 'File not found.' });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error generating filled document.', error: err.message });
  }
});
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { GridFSBucket } = require('mongodb');

// Preview document file from GridFS
router.get('/preview/:fileId', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const bucket = new GridFSBucket(db, { bucketName: 'documents' });
    const fileId = req.params.fileId;
    // Find file metadata
    const files = await db.collection('documents.files').find({ _id: ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    const downloadStream = bucket.openDownloadStream(ObjectId(fileId));
    downloadStream.on('error', () => {
      res.status(404).json({ success: false, message: 'File not found.' });
    });
    downloadStream.pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error streaming file.', error: err.message });
  }
});
const express = require('express');
const router = express.Router();

// Accept an uploaded file and save it inline into the `documents` collection
// (stores file Buffer in `file` field and optional base64 `chunks` array).
try {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit
  const DocumentModel = require('../../models/Document');

  router.post('/upload-inline', requireAuth, isAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
      const fileBuffer = req.file.buffer;
      const filename = req.file.originalname || `uploaded_${Date.now()}`;
      const contentType = req.file.mimetype || 'application/octet-stream';
      // Create small base64 chunks (optional). Keep chunk size small to avoid huge arrays
      const CHUNK_SIZE = 1024 * 256; // 256KB
      const chunks = [];
      for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
        const slice = fileBuffer.slice(i, i + CHUNK_SIZE);
        chunks.push(slice.toString('base64'));
      }

      const doc = new DocumentModel({
        filename,
        contentType,
        size: fileBuffer.length,
        file: fileBuffer,
        chunks,
        metadata: req.body.metadata ? JSON.parse(req.body.metadata || '{}') : {},
        uploadedBy: req.user && req.user._id ? req.user._id : undefined
      });

      await doc.save();
      return res.json({ success: true, id: doc._id });
    } catch (err) {
      console.error('upload-inline error', err);
      return res.status(500).json({ success: false, message: 'Failed to save file inline', error: err.message });
    }
  });
} catch (e) {
  console.error('Failed to register upload-inline route', e);
}

// Placeholder route for documents
router.get('/', (req, res) => {
  res.json({ message: 'Documents route placeholder' });
});

module.exports = router;
