// Preview filled document without saving request
export const previewFilledDocument = async (req: Request, res: Response) => {
  try {
    const { type, documentType, purpose, fileId, fieldValues } = req.body;
    // Find the template file by fileId
    // For simplicity, assume you have a function to get template content by fileId
    const templateContent = await getTemplateContentByFileId(fileId);
    if (!templateContent) {
      return res.status(404).json({ message: 'Template not found' });
    }
    // Replace $[field] with values
    let filled = templateContent;
    Object.entries(fieldValues || {}).forEach(([key, value]) => {
      const regex = new RegExp(`\\$\\[${key}\\]`, 'g');
      filled = filled.replace(regex, value as string);
    });
    // Generate a non-persistent transaction code for preview and replace [qr] markers
    try {
      const { generateTransactionCode } = require('../utils/transactionCode');
      const tx = generateTransactionCode();
      filled = filled.replace(/\[qr\]/g, tx);
      filled = filled.replace(/\$\[qr\]/g, tx);
    } catch (err) {
      // ignore if generation fails for preview
      console.error('Error generating preview transaction code:', err);
    }
    res.status(200).send(filled);
  } catch (error) {
    res.status(500).json({ message: 'Error generating preview', error: (error as Error).message });
  }
};
import { Request, Response } from 'express';
import { DocumentRequest } from '../models/DocumentRequest';
import mongoose from 'mongoose';
// @ts-ignore
import { GridFSBucket } from 'mongoose/node_modules/mongodb';
import JSZip from 'jszip';
import { QRCodeService } from '../services/QRCodeService';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Readable } from 'stream';
// Generate and return filled document using submitted values
export const generateFilledDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const documentRequest = await DocumentRequest.findById(id);
    if (!documentRequest) {
      return res.status(404).json({ message: 'Document request not found' });
    }
    if (!documentRequest.templateFileId) {
      return res.status(400).json({ message: 'No template file associated with this request.' });
    }
    // Connect to MongoDB native driver for GridFS
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ message: 'Database connection not established.' });
    }
    const bucket = new GridFSBucket(db, { bucketName: 'templates' });
    // Download the .docx file from GridFS
    const fileId = documentRequest.templateFileId;
    const downloadStream = bucket.openDownloadStream(fileId);
    const chunks: Buffer[] = [];
    downloadStream.on('data', (chunk) => chunks.push(chunk));
    downloadStream.on('error', (err) => {
      return res.status(500).json({ message: 'Error reading template file', error: err.message });
    });
    downloadStream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        // Load docx with docxtemplater
        const zip = new PizZip(buffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        // Prepare data for replacement
        const data = documentRequest.fieldValues || {};
        // Ensure a persistent transactionCode exists for this request and inject into template data
        try {
          if (!documentRequest.transactionCode) {
            documentRequest.transactionCode = await require('../utils/transactionCode').generateUniqueTransactionCode(DocumentRequest);
            try { await documentRequest.save(); } catch (saveErr) { console.error('Error saving transactionCode to documentRequest:', saveErr); }
          }
          const tx = documentRequest.transactionCode;
          if (tx) {
            data.qr = tx;
            data.transactionCode = tx;
          }
        } catch (err) {
          console.error('Error generating/saving transaction code:', err);
        }
        doc.setData(data);
        try {
          doc.render();
        } catch (error) {
          return res.status(500).json({ message: 'Error rendering document', error: (error as Error).message });
        }
        let filledBuffer = doc.getZip().generate({ type: 'nodebuffer' });
        // Also perform a literal replacement inside the docx's word/document.xml for any remaining [qr] markers
        try {
          const tx = documentRequest.transactionCode || '';
          if (tx) {
            const zip = await JSZip.loadAsync(filledBuffer);
            const docXmlFile = zip.file('word/document.xml');
            if (docXmlFile) {
              let xmlText = await docXmlFile.async('string');
              xmlText = xmlText.replace(/\[qr\]/g, tx).replace(/\$\[qr\]/g, tx);

              // Embed QR image: generate PNG buffer, add to word/media, add rel, and replace text runs containing tx with drawing markup
              try {
                const qrBuffer = await QRCodeService.generateDocumentQRBuffer(documentRequest._id?.toString() || tx, true);
                // Add image to zip
                const mediaFolder = 'word/media/';
                // choose image name
                const imgName = `qr_${documentRequest._id?.toString().slice(-6) || tx}.png`;
                zip.file(mediaFolder + imgName, qrBuffer);

                // Update relationships: word/_rels/document.xml.rels
                const relsPath = 'word/_rels/document.xml.rels';
                let relsXml = '';
                const relsFile = zip.file(relsPath);
                if (relsFile) relsXml = await relsFile.async('string');
                // Determine next rId
                const existingIds = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g)).map(m => parseInt(m[1], 10));
                const nextIdNum = existingIds.length ? (Math.max(...existingIds) + 1) : 1;
                const newRid = `rId${nextIdNum}`;
                const relEntry = `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgName}"/>`;
                if (relsXml) {
                  relsXml = relsXml.replace('</Relationships>', `${relEntry}</Relationships>`);
                } else {
                  relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relEntry}</Relationships>`;
                }
                zip.file(relsPath, relsXml);

                // Replace all runs that contain the transaction text with a drawing referencing the new rId
                const drawingXml = `
<w:r xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:drawing>
    <wp:inline>
      <wp:extent cx="952500" cy="952500"/>
      <wp:docPr id="1" name="QR"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr>
              <pic:cNvPr id="0" name="QR"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
              <pic:blipFill>
              <a:blip r:embed="${newRid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>
</w:r>`;

                // Regex to find runs with the exact tx
                const runRegex = new RegExp(`<w:r[^>]*>[\s\S]*?<w:t[^>]*>${tx.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}<\\/w:t>[\s\S]*?<\\/w:r>`, 'g');
                // Simpler approach: replace <w:t>tx</w:t> occurrences with drawingXml (inside w:r)
                const textRunRegex = new RegExp(`<w:t[^>]*>${tx.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}<\\/w:t>`, 'g');
                xmlText = xmlText.replace(textRunRegex, drawingXml);
              } catch (embedErr) {
                console.error('Error embedding QR image in docx:', embedErr);
              }

              zip.file('word/document.xml', xmlText);
              filledBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            }
          }
        } catch (zipErr) {
          console.error('Error performing literal [qr] replacement inside docx zip:', zipErr);
          // fallback: keep original filledBuffer
        }

        // Build a safe filename: {username}_{barangayID}_{type}.docx
        const rawUsername = documentRequest.username || 'user';
        const rawBarangay = documentRequest.barangayID || 'barangay';
        const rawType = (documentRequest.type || 'document').toString();

        const makeSafe = (s: string) => {
          // Replace problematic characters with underscores, trim, and collapse multiple underscores
          return s
            .toString()
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 120);
        };

        const filenameBase = [rawUsername, rawBarangay, rawType].map(makeSafe).filter(Boolean).join('_') || `document_${id}`;
        const filename = `${filenameBase}.docx`;

        // Upload the generated file to GridFS 'documents' bucket and persist file id on the request
        try {
          const filesDb = mongoose.connection.db;
          if (!filesDb) {
            console.error('No DB connection available for GridFS upload');
          }
          const documentsBucket = new GridFSBucket(filesDb as any, { bucketName: 'documents' });

          // Create a readable stream from the buffer
          const readable = new Readable();
          readable._read = () => {}; // noop
          readable.push(filledBuffer);
          readable.push(null);

          const uploadStream = documentsBucket.openUploadStream(filename, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });

          readable.pipe(uploadStream)
            .on('error', (err) => {
              console.error('Error uploading filled document to GridFS:', err);
            })
            .on('finish', async () => {
              try {
                // Persist the file id to the document request
                // uploadStream.id is a MongoDB ObjectId - cast to mongoose.Types.ObjectId
                documentRequest.filledFileId = (uploadStream.id as unknown) as mongoose.Types.ObjectId;
                await documentRequest.save();

                // Emit socket event notifying about completed generation
                try { io.emit('documentGenerated', { requestId: id, filledFileId: uploadStream.id, filename }); } catch (e) { /* ignore */ }
              } catch (err) {
                console.error('Error saving filledFileId to DocumentRequest:', err);
              }
            });

          // Return file to client while upload happens in background (upload finishes very quickly)
          // Return transaction code in header so callers can capture it easily
          if (documentRequest.transactionCode) {
            res.set('X-Transaction-Code', documentRequest.transactionCode);
          }
          res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          });
          res.send(filledBuffer);
        } catch (err) {
          console.error('Error while saving filled document to GridFS:', err);
          // Fallback: still return the file
          res.set({
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          });
          res.send(filledBuffer);
        }
      } catch (error) {
        res.status(500).json({ message: 'Error processing filled document', error: (error as Error).message });
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating filled document', error: ((error as Error)?.message) || error });
  }
};
import { User } from '../models/User';
import { Log } from '../models/Log';
import { io } from '../index';

export const createDocumentRequest = async (req: any, res: Response) => {
  try {
  const { type, purpose, fieldValues } = req.body;
    const user = (req as any).user;
    // Use username and barangayID from user object
    const username = user?.username || 'Unknown';
    const barangayID = user?.barangayID || 'Unknown';

    // Create the document request
    const docReqData: any = {
      type,
      purpose,
      username,
      barangayID,
      status: 'pending',
      paymentStatus: 'pending',
      fieldValues: fieldValues || {}
    };
    const documentRequest = new DocumentRequest(docReqData);

    // Generate and persist a patterned transactionCode immediately when the request is created
    try {
      const DocumentRequestModel = require('../models/DocumentRequest').DocumentRequest;
      if (!documentRequest.transactionCode) {
        documentRequest.transactionCode = await require('../utils/transactionCode').generateUniqueTransactionCode(DocumentRequestModel);
      }
    } catch (err) {
      // If generation fails for any reason, continue without blocking creation
      console.error('Error generating transactionCode during request creation:', err);
    }

    // Set payment amount based on document type
    const paymentAmounts: { [key: string]: number } = {
      barangay_clearance: 50,
      residency_certificate: 50,
      business_permit: 100,
      indigency_certificate: 0, // Free for indigents
      id_application: 75
    };

    documentRequest.paymentAmount = paymentAmounts[type];

    await documentRequest.save();
    res.status(201).json({
      message: 'Document request created successfully',
      documentRequest
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error creating document request',
      error: (error as Error).message
    });
  }
};

export const getMyDocumentRequests = async (req: any, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }
    // Find document requests by username and barangayID
    const user = req.user;
    const documentRequests = await DocumentRequest.find({ username: user.username, barangayID: user.barangayID })
      .sort({ dateRequested: -1 })
      .populate('processedBy', 'fullName');

    res.json(documentRequests);
  } catch (error) {
      console.error("Error in getMyDocumentRequests:", error);
      res.status(500).json({ message: "Server error", error: (error as Error).message });
  }
};

export const getAllDocumentRequests = async (req: any, res: Response) => {
  try {
    const { status, type } = req.query;
    const query: any = {};

    if (status) query.status = status;
    if (type) query.type = type;

    const documentRequests = await DocumentRequest.find(query)
      .sort({ dateRequested: -1 })
      .populate('processedBy', 'fullName username barangayID');
    res.json(documentRequests);
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching document requests',
      error: (error as Error).message
    });
  }
};

export const processDocumentRequest = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const processedBy = (req as any).user._id;

    // Find the document request in the collection
    const documentRequest = await DocumentRequest.findById(id);
    if (!documentRequest) {
      return res.status(404).json({ message: 'Document request not found' });
    }

    // Organize for staff processing: update status, remarks, processedBy, and dateProcessed
    documentRequest.status = status;
    documentRequest.remarks = remarks;
    documentRequest.processedBy = processedBy;
    documentRequest.dateProcessed = new Date();

    // If approved, generate document content and log
    if (status === 'approved') {
      // Record approval timestamp
      documentRequest.dateApproved = new Date();
      // Fetch template text (simulate: should fetch from file/db)
      // For demo, use a placeholder template with $[field]s
      documentRequest.templateText = documentRequest.templateText || `Document for ${documentRequest.type}\n$[firstName] $[lastName] $[age]`;
      documentRequest.documentContent = await documentRequest.generateDocumentContent();
      await Log.create({
        type: 'audit',
        message: 'Document request approved',
        details: `Request ID: ${id}, Approved by: ${processedBy}`,
        actor: String(processedBy),
        target: String(id)
      });
      // Emit real-time notification for staff
      io.emit('documentStatusUpdate', {
        requestId: id,
        status,
        remarks,
        processedBy,
        username: documentRequest.username,
        barangayID: documentRequest.barangayID,
        type: documentRequest.type
      });
    }

    await documentRequest.save();
    res.json({
      message: 'Document request processed and organized for staff',
      documentRequest
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error processing document request',
      error: (error as Error).message
    });
  }
};

export const updatePaymentStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const processedBy = (req as any).user._id;

    const documentRequest = await DocumentRequest.findById(id);
    if (!documentRequest) {
      return res.status(404).json({ message: 'Document request not found' });
    }

    documentRequest.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid') {
      documentRequest.paymentDate = new Date();
    }

    await documentRequest.save();

    res.json({
      message: 'Payment status updated successfully',
      documentRequest
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating payment status',
      error: (error as Error).message
    });
  }
};

// Simulated function to get template content by fileId
// In a real app, this would fetch from DB or filesystem
async function getTemplateContentByFileId(fileId: string): Promise<string | null> {
  // Example: hardcoded templates for demonstration
  const templates: { [key: string]: string } = {
    '1': 'Barangay Clearance\nName: $[firstName] $[lastName]\nPurpose: $[purpose]',
    '2': 'Residency Certificate\nResident: $[firstName] $[lastName], Age: $[age]',
    '3': 'Business Permit\nBusiness Name: $[businessName]\nOwner: $[firstName] $[lastName]'
  };
  return templates[fileId] || null;
}

