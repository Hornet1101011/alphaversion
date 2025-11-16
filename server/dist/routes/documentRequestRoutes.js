"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const documentRequestController_1 = require("../controllers/documentRequestController");
const router = express_1.default.Router();
// Resident routes
// Allow public creation of document requests so guests (who may have a short-lived
// guest token or session) can submit requests without requiring a full JWT.
// The controller will still validate required fields and persist the request.
router.post('/', (req, res) => (0, documentRequestController_1.createDocumentRequest)(req, res));
router.get('/my-requests', auth_1.auth, (req, res) => (0, documentRequestController_1.getMyDocumentRequests)(req, res));
// Generate and return filled document for a request (staff action)
router.post('/:id/generate-filled', (req, res) => (0, documentRequestController_1.generateFilledDocument)(req, res));
// Staff and Admin routes
router.get('/all', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.getAllDocumentRequests)(req, res));
router.patch('/:id/process', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.processDocumentRequest)(req, res));
router.patch('/:id/payment', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.updatePaymentStatus)(req, res));
// Note: POST / is intentionally public (see above). Keep my-requests protected.
router.get('/my-requests', auth_1.auth, (req, res) => (0, documentRequestController_1.getMyDocumentRequests)(req, res));
// Staff and Admin routes
router.get('/all', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.getAllDocumentRequests)(req, res));
router.patch('/:id/process', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.processDocumentRequest)(req, res));
router.patch('/:id/payment', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res) => (0, documentRequestController_1.updatePaymentStatus)(req, res));
// Route to get filled document for print/preview
// Route to get filled document for print/preview
// router.get('/:id/filled', auth, (req: any, res: Response) => getFilledDocument(req, res));
router.post('/preview-filled', auth_1.auth, (req, res) => (0, documentRequestController_1.previewFilledDocument)(req, res));
exports.default = router;
