import express from 'express';
import path from 'path';
import fs from 'fs';
import { Announcement } from '../models/Announcement';

const router = express.Router();

// GET / - list announcements (public) (exclude binary image data)
router.get('/', async (req, res) => {
  try {
    const anns = await Announcement.find({}, '-imageData -imageContentType').sort({ createdAt: -1 }).lean();
    res.json(anns);
  } catch (err) {
    console.error('Failed to fetch announcements', err);
    res.status(500).json({ message: 'Failed to fetch announcements', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
  }
});

// GET /:id - single announcement
router.get('/:id', async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id, '-imageData -imageContentType').lean();
    if (!ann) return res.status(404).json({ message: 'Announcement not found' });
    res.json(ann);
  } catch (err) {
    console.error('Failed to fetch announcement', err);
    res.status(500).json({ message: 'Failed to fetch announcement', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
  }
});

// GET /:id/image - serve the announcement image (from DB if available else disk file)
router.get('/:id/image', async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id).lean();
    if (!ann) return res.status(404).json({ message: 'Announcement not found' });
    if (ann.imageData && ann.imageContentType) {
      res.set('Content-Type', ann.imageContentType);
      // ann.imageData may be a Buffer or a BSON Binary; normalize to Buffer
      const data = (ann.imageData as any);
      const buf = Buffer.isBuffer(data) ? data : (data && data.buffer ? Buffer.from(data.buffer) : Buffer.from(data));
      return res.send(buf);
    }
    if (ann.imagePath) {
      const filePath = path.join(process.cwd(), ann.imagePath);
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }
    return res.status(404).json({ message: 'No image available for this announcement' });
  } catch (err) {
    console.error('Failed to fetch announcement image', err);
    res.status(500).json({ message: 'Failed to fetch announcement image', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
  }
});

export default router;
