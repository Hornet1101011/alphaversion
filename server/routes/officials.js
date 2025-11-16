const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const isAdmin = require('../middleware/isAdmin');
const Official = require('../models/Official');
const AuditLog = require('../models/AuditLog');

// Ensure upload dir exists
const uploadDir = path.join(process.cwd(), 'uploads', 'officials');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-]/g,'_')}`)
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

async function recordAudit(userId, action, details, ip) {
  try {
    await AuditLog.create({ userId, action, details, ip });
  } catch (e) {
    console.error('Failed to write audit log for officials', e);
  }
}

// GET /admin/officials - list
router.get('/', isAdmin, async (req, res) => {
  try {
    const list = await Official.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error('Failed to list officials', err);
    res.status(500).json({ message: 'Failed to list officials' });
  }
});

// POST /admin/officials - create
router.post('/', isAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.name || payload.name.toString().trim() === '') return res.status(400).json({ message: 'Name is required' });
    const doc = new Official({
      name: payload.name,
      title: payload.title,
      term: payload.term,
      createdBy: req.user && (req.user._id || req.user.id)
    });
    await doc.save();
    await recordAudit(req.user && (req.user._id || req.user.id), 'create_official', { officialId: doc._id, payload }, req.ip || req.headers['x-forwarded-for']);
    res.json(doc);
  } catch (err) {
    console.error('Failed to create official', err);
    res.status(500).json({ message: 'Failed to create official' });
  }
});

// PUT /admin/officials/:id - update
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const official = await Official.findById(id);
    if (!official) return res.status(404).json({ message: 'Official not found' });
    ['name','title','term'].forEach(k => { if (payload[k] !== undefined) official[k] = payload[k]; });
    await official.save();
    await recordAudit(req.user && (req.user._id || req.user.id), 'update_official', { officialId: id, payload }, req.ip || req.headers['x-forwarded-for']);
    res.json(official);
  } catch (err) {
    console.error('Failed to update official', err);
    res.status(500).json({ message: 'Failed to update official' });
  }
});

// DELETE /admin/officials/:id
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const official = await Official.findById(id);
    if (!official) return res.status(404).json({ message: 'Official not found' });
    // remove photo file if present
    if (official.photoPath) {
      try {
        const p = path.join(process.cwd(), official.photoPath);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) { /* ignore */ }
    }
    await official.deleteOne();
    await recordAudit(req.user && (req.user._id || req.user.id), 'delete_official', { officialId: id }, req.ip || req.headers['x-forwarded-for']);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Failed to delete official', err);
    res.status(500).json({ message: 'Failed to delete official' });
  }
});

// POST /admin/officials/:id/photo - upload photo
router.post('/:id/photo', isAdmin, upload.single('photo'), async (req, res) => {
  try {
    const id = req.params.id;
    const official = await Official.findById(id);
    if (!official) return res.status(404).json({ message: 'Official not found' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Read file buffer and store directly in the document
    try {
      const buf = fs.readFileSync(req.file.path);
      official.photo = buf;
      official.photoContentType = req.file.mimetype;
      // keep legacy path for compatibility
      official.photoPath = path.join('uploads', 'officials', path.basename(req.file.path));
      await official.save();
      // remove the disk file now that we've stored the bytes
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      await recordAudit(req.user && (req.user._id || req.user.id), 'upload_official_photo', { officialId: id }, req.ip || req.headers['x-forwarded-for']);
      res.json({ message: 'Uploaded' });
    } catch (e) {
      console.error('Failed to persist photo bytes', e);
      return res.status(500).json({ message: 'Failed to save photo' });
    }
  } catch (err) {
    console.error('Failed to upload official photo', err);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// GET /admin/officials/:id/photo - serve stored photo bytes
router.get('/:id/photo', async (req, res) => {
  try {
    const id = req.params.id;
    const official = await Official.findById(id).select('photo photoContentType');
    if (!official) return res.status(404).send('Not found');
    if (!official.photo || !official.photoContentType) return res.status(404).send('No photo');
    res.setHeader('Content-Type', official.photoContentType);
    return res.send(official.photo);
  } catch (err) {
    console.error('Failed to serve official photo', err);
    return res.status(500).send('Error');
  }
});

module.exports = router;
