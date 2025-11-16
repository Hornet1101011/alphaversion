import express from 'express';
import { auth, authorize } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  createInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiry,
  addResponse,
  getMyInquiries,
} from '../controllers/inquiryController';
import { Request, Response, NextFunction } from 'express';

const router = express.Router();

// Ensure uploads directory exists for inquiries
const uploadsDir = path.join(process.cwd(), 'uploads', 'inquiries');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});
const upload = multer({ storage });

// Get inquiries for the logged-in resident
router.get('/my-inquiries', auth, (req: any, res: Response, next: NextFunction) => getMyInquiries(req, res, next));

// Create a new inquiry (supports file attachments)
router.post('/', auth, upload.array('attachments'), (req: any, res: Response, next: NextFunction) => createInquiry(req, res, next));

// Get all inquiries
router.get('/', auth, (req: any, res: Response, next: NextFunction) => getAllInquiries(req, res, next));

// Get a specific inquiry
router.get('/:id', auth, (req: any, res: Response, next: NextFunction) => getInquiryById(req, res, next));
// Update an inquiry (admin and staff only)
router.patch('/:id', auth, authorize('admin', 'staff'), (req: any, res: Response, next: NextFunction) => updateInquiry(req, res, next));

// Add a response to an inquiry (allow resident and staff replies)
// Allow file attachments with responses as well
router.post('/:id/responses', auth, upload.array('attachments'), (req: any, res: Response, next: NextFunction) => addResponse(req, res, next));

export default router;
