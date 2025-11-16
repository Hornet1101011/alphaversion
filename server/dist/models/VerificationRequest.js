"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationRequest = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const verificationRequestSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    files: [{ type: String }],
    gridFileIds: [{ type: mongoose_1.default.Schema.Types.ObjectId }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: false },
});
exports.VerificationRequest = mongoose_1.default.model('VerificationRequest', verificationRequestSchema);
