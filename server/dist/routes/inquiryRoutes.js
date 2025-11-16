"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const inquiryController_1 = require("../controllers/inquiryController");
const router = express_1.default.Router();
// Ensure uploads directory exists for inquiries
const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'inquiries');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = (0, multer_1.default)({ storage });
// Get inquiries for the logged-in resident
router.get('/my-inquiries', auth_1.auth, (req, res, next) => (0, inquiryController_1.getMyInquiries)(req, res, next));
// Create a new inquiry (supports file attachments)
router.post('/', auth_1.auth, upload.array('attachments'), (req, res, next) => (0, inquiryController_1.createInquiry)(req, res, next));
// Get all inquiries
router.get('/', auth_1.auth, (req, res, next) => (0, inquiryController_1.getAllInquiries)(req, res, next));
// Get a specific inquiry
router.get('/:id', auth_1.auth, (req, res, next) => (0, inquiryController_1.getInquiryById)(req, res, next));
// Update an inquiry (admin and staff only)
router.patch('/:id', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), (req, res, next) => (0, inquiryController_1.updateInquiry)(req, res, next));
// Add a response to an inquiry (allow resident and staff replies)
// Allow file attachments with responses as well
router.post('/:id/responses', auth_1.auth, upload.array('attachments'), (req, res, next) => (0, inquiryController_1.addResponse)(req, res, next));
exports.default = router;
