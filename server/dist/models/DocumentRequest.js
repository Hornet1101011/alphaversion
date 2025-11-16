"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentRequest = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const documentRequestSchema = new mongoose_1.default.Schema({
    type: {
        type: String,
        required: true
        // Accept any string so all frontend document types can be saved
    },
    username: {
        type: String,
        required: true
    },
    barangayID: {
        type: String,
        required: false // Not all requests may have this, but we want to save it if present
    },
    purpose: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'approved', 'rejected', 'completed'],
        default: 'pending'
    },
    documentNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    transactionCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    validUntil: {
        type: Date
    },
    dateRequested: {
        type: Date,
        default: Date.now
    },
    dateProcessed: {
        type: Date
    },
    dateApproved: {
        type: Date
    },
    processedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'waived'],
        default: 'pending'
    },
    paymentAmount: {
        type: Number
    },
    paymentDate: {
        type: Date
    },
    remarks: {
        type: String
    },
    documentContent: {
        type: String
    },
    fieldValues: {
        type: Object,
        default: {}
    },
    templateText: {
        type: String,
        default: ''
    },
    templateFileId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'fs.files',
        required: false
    },
    // Reference to the generated/filled document saved in GridFS 'documents' bucket
    filledFileId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'fs.files',
        required: false
    },
}, {
    timestamps: true
});
// Auto-generate document number when status changes to approved
documentRequestSchema.pre('save', async function (next) {
    if (this.isModified('status') && this.status === 'approved' && !this.documentNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose_1.default.model('DocumentRequest').countDocuments({
            status: 'approved',
            documentNumber: { $regex: `^${year}-` }
        });
        this.documentNumber = `${year}-${(count + 1).toString().padStart(5, '0')}`;
        // Set validity period (default 6 months)
        if (!this.validUntil) {
            this.validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
        }
    }
    next();
});
// Method to generate document content based on template
documentRequestSchema.methods.generateDocumentContent = async function () {
    // Fetch template text from storage or file system (simulate here)
    const templateText = this.templateText || '';
    let content = templateText;
    // Replace all $[field] with submitted values
    if (this.fieldValues) {
        Object.entries(this.fieldValues).forEach(([key, value]) => {
            const regex = new RegExp(`\\$\\[${key}\\]`, 'g');
            content = content.replace(regex, value);
        });
    }
    // Optionally replace other system fields
    content = content.replace(/\\$\\[documentNumber\\]/g, this.documentNumber || '');
    content = content.replace(/\\$\\[validUntil\\]/g, this.validUntil ? this.validUntil.toLocaleDateString() : '');
    // Replace QR marker (both [qr] and $[qr]) with transactionCode if present
    const tx = this.transactionCode || '';
    if (tx) {
        content = content.replace(/\[qr\]/g, tx);
        content = content.replace(/\$\[qr\]/g, tx);
    }
    else {
        // Also replace markers with empty string if transactionCode not set
        content = content.replace(/\[qr\]/g, '');
        content = content.replace(/\$\[qr\]/g, '');
    }
    return content;
};
// Create indexes for faster queries
documentRequestSchema.index({ requesterId: 1, status: 1 });
documentRequestSchema.index({ dateRequested: -1 });
exports.DocumentRequest = mongoose_1.default.model('DocumentRequest', documentRequestSchema);
