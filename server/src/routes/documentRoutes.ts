import express, { NextFunction } from 'express';
import { auth, authorize } from '../middleware/auth';
import * as documentController from '../controllers/documentController';

import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// Generate filled .docx from template and field values
router.post('/:id/generate-filled', documentController.generateFilledDocument);
// Download original .docx file for integrity check
router.get('/original/:id', documentController.downloadOriginalDocument);

// Preview a document (HTML or PDF)
router.get('/preview/:id', documentController.previewDocument);

// Process a document (fill template, generate PDF)
router.post('/:id/process', documentController.processDocument);

// Upload a document
router.post('/upload', upload.single('file'), documentController.uploadDocument);

// List all uploaded files
router.get('/list', documentController.listDocuments);

// Download a file by id
router.get('/file/:id', documentController.downloadDocument);

// Delete a file by id
router.delete('/file/:id', documentController.deleteDocument);

// Create a new document
router.post('/', auth, documentController.createDocument);

// Get all documents (no auth for testing)
router.get('/', documentController.getDocuments);

// Get a specific document
router.get('/:id', auth, documentController.getDocuments); // Should be getDocuments or getDocumentById?

// Update a document (admin and staff only)
router.patch('/:id', auth, authorize('admin', 'staff'), documentController.updateDocument);

// Preview a document
router.get('/preview/:id', documentController.previewDocument);

export default router;
