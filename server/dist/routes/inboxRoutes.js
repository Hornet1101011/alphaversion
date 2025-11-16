"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const inboxController_1 = require("../controllers/inboxController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
console.log('inboxRoutes.ts loaded');
// GET /api/inbox - get all inquiries for the logged-in resident
router.get('/', (req, res, next) => { console.log('GET /api/inbox called'); next(); }, auth_1.auth, inboxController_1.getResidentInbox);
exports.default = router;
