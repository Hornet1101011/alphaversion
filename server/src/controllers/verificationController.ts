import { Request, Response } from 'express';
import { DocumentModel, IDocument } from '../models/Document';

export const verifyDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const document = await DocumentModel.findById(id)
      .populate('requestedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!document) {
      return res.status(404).json({
        isValid: false,
        message: 'Document not found'
      });
    }

    // Check if document is approved
    if ((document as any).status !== 'approved') {
      return res.status(400).json({
        isValid: false,
        message: 'Document is not approved'
      });
    }

    // Check if document has expired
    const now = new Date();
    if (now > (document as any).validUntil) {
      return res.status(400).json({
        isValid: false,
        message: 'Document has expired',
        expiryDate: (document as any).validUntil
      });
    }

    // Document is valid
    return res.status(200).json({
      isValid: true,
      message: 'Document is valid',
      document: {
        documentType: (document as any).documentType,
        dateIssued: (document as any).dateProcessed,
        validUntil: (document as any).validUntil,
        purpose: (document as any).purpose,
        requestedBy: (document as any).requestedBy,
        approvedBy: (document as any).approvedBy,
        verificationHash: (document as any).verificationHash
      }
    });

  } catch (error) {
    console.error('Error verifying document:', error);
    return res.status(500).json({
      isValid: false,
      message: 'Error verifying document'
    });
  }
};
