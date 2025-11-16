import express from 'express';
import { auth, authorize } from '../middleware/auth';
import {
  createRequest,
  getAllRequests,
  getRequestById,
  updateRequest,
  addComment,
  approveRequest,
} from '../controllers/requestController';

const router = express.Router();

// Create a new request
router.post('/', auth, createRequest);

// Get all requests
router.get('/', auth, getAllRequests);

// Get a specific request
router.get('/:id', auth, getRequestById);

// Update a request (admin and staff only)
router.patch('/:id', auth, authorize('admin', 'staff'), updateRequest);

// Approve a request (promote user & update request)
router.post('/:id/approve', auth, authorize('admin', 'staff'), approveRequest);

// Add a comment to a request
router.post('/:id/comments', auth, addComment);

export default router;
