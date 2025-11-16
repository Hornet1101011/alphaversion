"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inquiry = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const inquirySchema = new mongoose_1.default.Schema({
    subject: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: false,
        default: 'General'
    },
    message: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved'],
        default: 'open',
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
    barangayID: {
        type: String,
        required: true,
    },
    assignedTo: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
        }],
    assignedRole: {
        type: String,
        enum: ['admin', 'staff', 'resident'],
        required: false,
    },
    responses: [{
            text: {
                type: String,
                required: true,
            },
            createdBy: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            // Store display author name and role for client rendering convenience
            authorName: { type: String },
            authorRole: { type: String },
            attachments: [{
                    filename: { type: String },
                    path: { type: String },
                    url: { type: String },
                    contentType: { type: String },
                    size: { type: Number },
                    uploadedAt: { type: Date, default: Date.now }
                }],
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    attachments: [{
            filename: { type: String },
            path: { type: String },
            url: { type: String },
            contentType: { type: String },
            size: { type: Number },
            uploadedAt: { type: Date, default: Date.now }
        }],
}, {
    timestamps: true,
});
exports.Inquiry = mongoose_1.default.model('Inquiry', inquirySchema);
