"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyDocument = void 0;
const Document_1 = require("../models/Document");
const verifyDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document_1.DocumentModel.findById(id)
            .populate('requestedBy', 'firstName lastName')
            .populate('approvedBy', 'firstName lastName');
        if (!document) {
            return res.status(404).json({
                isValid: false,
                message: 'Document not found'
            });
        }
        // Check if document is approved
        if (document.status !== 'approved') {
            return res.status(400).json({
                isValid: false,
                message: 'Document is not approved'
            });
        }
        // Check if document has expired
        const now = new Date();
        if (now > document.validUntil) {
            return res.status(400).json({
                isValid: false,
                message: 'Document has expired',
                expiryDate: document.validUntil
            });
        }
        // Document is valid
        return res.status(200).json({
            isValid: true,
            message: 'Document is valid',
            document: {
                documentType: document.documentType,
                dateIssued: document.dateProcessed,
                validUntil: document.validUntil,
                purpose: document.purpose,
                requestedBy: document.requestedBy,
                approvedBy: document.approvedBy,
                verificationHash: document.verificationHash
            }
        });
    }
    catch (error) {
        console.error('Error verifying document:', error);
        return res.status(500).json({
            isValid: false,
            message: 'Error verifying document'
        });
    }
};
exports.verifyDocument = verifyDocument;
