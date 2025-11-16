"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const requestController_1 = require("../controllers/requestController");
const router = express_1.default.Router();
// Create a new request
router.post('/', auth_1.auth, requestController_1.createRequest);
// Get all requests
router.get('/', auth_1.auth, requestController_1.getAllRequests);
// Get a specific request
router.get('/:id', auth_1.auth, requestController_1.getRequestById);
// Update a request (admin and staff only)
router.patch('/:id', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), requestController_1.updateRequest);
// Approve a request (promote user & update request)
router.post('/:id/approve', auth_1.auth, (0, auth_1.authorize)('admin', 'staff'), requestController_1.approveRequest);
// Add a comment to a request
router.post('/:id/comments', auth_1.auth, requestController_1.addComment);
exports.default = router;
