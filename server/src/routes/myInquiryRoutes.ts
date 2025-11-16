import express from 'express';
import { auth } from '../middleware/auth';
// import { getMyInquiries } from '../controllers/myInquiryController';

const router = express.Router();

// Get inquiries created by the current user
// router.get('/my-inquiries', auth, getMyInquiries);

export default router;
