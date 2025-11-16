"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const documentController = __importStar(require("../controllers/documentController"));
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ dest: 'uploads/' });
const router = express_1.default.Router();
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
router.post('/', auth_1.auth, documentController.createDocument);
// Get all documents (no auth for testing)
router.get('/', documentController.getDocuments);
// Get a specific document
router.get('/:id', auth_1.auth, documentController.getDocuments); // Should be getDocuments or getDocumentById?
// Update a document (admin and staff only)
router.patch('/:id', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), documentController.updateDocument);
// Preview a document
router.get('/preview/:id', documentController.previewDocument);
exports.default = router;
