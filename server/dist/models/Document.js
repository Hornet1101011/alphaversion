"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Document = exports.DocumentModel = void 0;
// ...existing code...
// ...existing code...
const mongoose_1 = __importDefault(require("mongoose"));
const documentSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    fileUrl: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    notes: { type: String },
    isUrgent: { type: Boolean, default: false },
    requestedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedByName: { type: String },
    barangayID: { type: String },
    dateRequested: { type: Date },
    approvedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
exports.DocumentModel = mongoose_1.default.model('Document', documentSchema);
exports.Document = exports.DocumentModel;
