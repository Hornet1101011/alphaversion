"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import { getMyInquiries } from '../controllers/myInquiryController';
const router = express_1.default.Router();
// Get inquiries created by the current user
// router.get('/my-inquiries', auth, getMyInquiries);
exports.default = router;
