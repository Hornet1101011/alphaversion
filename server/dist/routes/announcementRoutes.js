"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Announcement_1 = require("../models/Announcement");
const router = express_1.default.Router();
// GET / - list announcements (public) (exclude binary image data)
router.get('/', async (req, res) => {
    try {
        const anns = await Announcement_1.Announcement.find({}, '-imageData -imageContentType').sort({ createdAt: -1 }).lean();
        res.json(anns);
    }
    catch (err) {
        console.error('Failed to fetch announcements', err);
        res.status(500).json({ message: 'Failed to fetch announcements', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// GET /:id - single announcement
router.get('/:id', async (req, res) => {
    try {
        const ann = await Announcement_1.Announcement.findById(req.params.id, '-imageData -imageContentType').lean();
        if (!ann)
            return res.status(404).json({ message: 'Announcement not found' });
        res.json(ann);
    }
    catch (err) {
        console.error('Failed to fetch announcement', err);
        res.status(500).json({ message: 'Failed to fetch announcement', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
// GET /:id/image - serve the announcement image (from DB if available else disk file)
router.get('/:id/image', async (req, res) => {
    try {
        const ann = await Announcement_1.Announcement.findById(req.params.id).lean();
        if (!ann)
            return res.status(404).json({ message: 'Announcement not found' });
        if (ann.imageData && ann.imageContentType) {
            res.set('Content-Type', ann.imageContentType);
            // ann.imageData may be a Buffer or a BSON Binary; normalize to Buffer
            const data = ann.imageData;
            const buf = Buffer.isBuffer(data) ? data : (data && data.buffer ? Buffer.from(data.buffer) : Buffer.from(data));
            return res.send(buf);
        }
        if (ann.imagePath) {
            const filePath = path_1.default.join(process.cwd(), ann.imagePath);
            if (fs_1.default.existsSync(filePath)) {
                return res.sendFile(filePath);
            }
        }
        return res.status(404).json({ message: 'No image available for this announcement' });
    }
    catch (err) {
        console.error('Failed to fetch announcement image', err);
        res.status(500).json({ message: 'Failed to fetch announcement image', error: err && typeof err === 'object' && 'message' in err ? err.message : err });
    }
});
exports.default = router;
