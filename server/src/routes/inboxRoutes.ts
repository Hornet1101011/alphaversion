import express from 'express';
import { getResidentInbox } from '../controllers/inboxController';
import { auth } from '../middleware/auth';

const router = express.Router();
console.log('inboxRoutes.ts loaded');

// GET /api/inbox - get all inquiries for the logged-in resident
router.get('/', (req, res, next) => { console.log('GET /api/inbox called'); next(); }, auth, getResidentInbox);

export default router;
