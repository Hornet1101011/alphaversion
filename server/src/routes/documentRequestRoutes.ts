import express, { Request, Response, NextFunction } from 'express';
import { auth, authorize } from '../middleware/auth';
import {
  createDocumentRequest,
  getMyDocumentRequests,
  getAllDocumentRequests,
  processDocumentRequest,
  updatePaymentStatus,
  previewFilledDocument,
  generateFilledDocument,
} from '../controllers/documentRequestController';

const router = express.Router();

// Resident routes
// Allow public creation of document requests so guests (who may have a short-lived
// guest token or session) can submit requests without requiring a full JWT.
// The controller will still validate required fields and persist the request.
router.post('/', (req: any, res: Response) => createDocumentRequest(req, res));
router.get('/my-requests', auth, (req: any, res: Response) => getMyDocumentRequests(req, res));
// Generate and return filled document for a request (staff action)
router.post('/:id/generate-filled', (req, res) => generateFilledDocument(req, res));

// Staff and Admin routes
router.get('/all', auth, authorize('admin', 'staff'), (req: any, res: Response) => getAllDocumentRequests(req, res));
router.patch('/:id/process', auth, authorize('admin', 'staff'), (req: any, res: Response) => processDocumentRequest(req, res));
router.patch('/:id/payment', auth, authorize('admin', 'staff'), (req: any, res: Response) => updatePaymentStatus(req, res));
// Note: POST / is intentionally public (see above). Keep my-requests protected.
router.get('/my-requests', auth, (req: any, res: Response) => getMyDocumentRequests(req, res));

// Staff and Admin routes
router.get('/all', auth, authorize('admin', 'staff'), (req: any, res: Response) => getAllDocumentRequests(req, res));
router.patch('/:id/process', auth, authorize('admin', 'staff'), (req: any, res: Response) => processDocumentRequest(req, res));
router.patch('/:id/payment', auth, authorize('admin', 'staff'), (req: any, res: Response) => updatePaymentStatus(req, res));
// Route to get filled document for print/preview
// Route to get filled document for print/preview
// router.get('/:id/filled', auth, (req: any, res: Response) => getFilledDocument(req, res));
router.post('/preview-filled', auth, (req: any, res: Response) => previewFilledDocument(req, res));

export default router;
