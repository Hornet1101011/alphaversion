import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import JSZip from 'jszip';
import { QRCodeService } from '../services/QRCodeService';
import { logActivity } from '../middleware/logActivity';
import { Request, Response, NextFunction } from 'express';
import { DocumentRequest } from '../models/DocumentRequest';
import { sendDocumentNotification } from '../services/EmailService';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import fs from 'fs';
// Generate filled .docx from GridFS template and field values
// Custom parser to support {fieldName}, ${fieldName}, and $[fieldName]
function customParser(tag) {
  // Remove curly braces, ${...}, or $[...]
  const match = tag.match(/^\{?\$?\[?([a-zA-Z0-9_]+)\]?\}?$/);
  return {
    get: (scope) => scope[match ? match[1] : tag],
  };
}

export const generateFilledDocument = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) return res.status(500).json({ message: 'GridFSBucket not initialized.' });
    const fileId = req.params.id;
    const { ObjectId } = require('mongodb');
    let objectId;
    try {
      objectId = new ObjectId(fileId);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid file ID.' });
    }
    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Template file not found.' });
    }
    // Download .docx from GridFS
    const chunks: Buffer[] = [];
    const stream = gridFSBucket.openDownloadStream(objectId);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
  let zip = new PizZip(buffer);
  // Use custom parser to support $[field], [field], {field} tags
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, parser: customParser });
        const data = req.body.fieldValues || {};
        // If a documentRequestId is provided, fetch the DocumentRequest to get/generate transactionCode
        try {
          const documentRequestId = req.body?.documentRequestId || req.body?.requestId || req.query?.documentRequestId || req.query?.requestId;
          if (documentRequestId) {
            const DocumentRequestModel = require('../models/DocumentRequest').DocumentRequest;
            const docReq = await DocumentRequestModel.findById(documentRequestId);
            if (docReq) {
                if (!docReq.transactionCode) {
                  try {
                    const DocumentRequestModel = require('../models/DocumentRequest').DocumentRequest;
                    docReq.transactionCode = await require('../utils/transactionCode').generateUniqueTransactionCode(DocumentRequestModel);
                    try { await docReq.save(); } catch (err) { console.error('Error saving transactionCode on docReq:', err); }
                  } catch (genErr) {
                    console.error('Error generating transactionCode on docReq:', genErr);
                  }
                }
                data.qr = docReq.transactionCode;
                data.transactionCode = docReq.transactionCode;
                data.documentNumber = docReq.documentNumber || '';
                data.validUntil = docReq.validUntil ? docReq.validUntil.toLocaleDateString() : '';
              }
          }
        } catch (err) {
          console.error('Error populating transaction code for template:', err);
        }
        // docxtemplater v3+: deprecated setData(), pass data directly to render()
        try {
          doc.render(data);
        } catch (error) {
          return res.status(500).json({ message: 'Error rendering document', error: (error as Error).message });
        }
        let filledBuffer = doc.getZip().generate({ type: 'nodebuffer' });
        // Attempt literal replacement and QR image embedding inside docx
        try {
          const tx = data.qr || data.transactionCode || '';
          if (tx) {
            const zip = await JSZip.loadAsync(filledBuffer);
            const docXmlFile = zip.file('word/document.xml');
            if (docXmlFile) {
              let xmlText = await docXmlFile.async('string');
              xmlText = xmlText.replace(/\[qr\]/g, tx).replace(/\$\[qr\]/g, tx);

              // Embed QR PNG
              try {
                const qrBuffer = await QRCodeService.generateDocumentQRBuffer(data.qr || data.transactionCode || fileId, true);
                const mediaFolder = 'word/media/';
                const imgName = `qr_${(fileId || '').toString().slice(-6)}.png`;
                zip.file(mediaFolder + imgName, qrBuffer);

                const relsPath = 'word/_rels/document.xml.rels';
                let relsXml = '';
                const relsFile = zip.file(relsPath);
                if (relsFile) relsXml = await relsFile.async('string');
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
        }

        // Return transaction code header if present
        if (data.qr || data.transactionCode) {
          res.set('X-Transaction-Code', data.qr || data.transactionCode);
        }

        // Attempt to persist the generated copy into the processed_documents GridFS bucket so
        // generated copies are stored safely (avoids inline BSON size issues and keeps them separate).
        // default filename (fallback) - may be overridden below if transactionCode is present
        let filename = `filled_${fileId}.docx`;
        try {
          const filesDb = (require('mongoose').connection.db as any);
          if (filesDb) {
            const { GridFSBucket } = require('mongodb');
            const { Readable } = require('stream');
            const processedBucket = new GridFSBucket(filesDb, { bucketName: 'processed_documents' });

            // Prefer transactionCode (if it was set from a DocumentRequest) for filename, otherwise fall back to filled_<fileId>.docx
            const safeTx = (data && data.transactionCode) ? String(data.transactionCode).replace(/[^a-zA-Z0-9-_.]/g, '_') : null;
            filename = safeTx ? `${safeTx}.docx` : `filled_${fileId}.docx`;
            const readable = new Readable();
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            readable._read = () => {};
            readable.push(filledBuffer);
            readable.push(null);

            const uploadStream = processedBucket.openUploadStream(filename, {
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });

            await new Promise((resolve, reject) => {
              readable.pipe(uploadStream)
                .on('error', (err: any) => { console.error('Error uploading filled document to processed_documents GridFS:', err); reject(err); })
                .on('finish', () => resolve(null));
            });

            const savedId = uploadStream.id;
            try { res.set('X-Processed-GridFS-Id', String(savedId)); } catch (e) {}

            // Best-effort: create small metadata records referencing the GridFS file id
            try {
              const GeneratedDocument = require('../../models/GeneratedDocument');
              const genMeta = new GeneratedDocument({
                filename,
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: filledBuffer.length,
                gridFsFileId: savedId,
                metadata: { sourceFileId: fileId },
                sourceTemplateId: require('mongoose').Types.ObjectId.isValid(fileId) ? require('mongoose').Types.ObjectId(fileId) : undefined,
                requestId: req.body && req.body.requestId ? (require('mongoose').Types.ObjectId.isValid(req.body.requestId) ? require('mongoose').Types.ObjectId(req.body.requestId) : undefined) : undefined,
                uploadedBy: req.user && req.user._id ? req.user._id : undefined
              });
              try {
                const savedGen = await genMeta.save();
                try { res.set('X-Generated-Doc-Id', String(savedGen._id)); } catch (e) {}
              } catch (metaErr) {
                console.warn('Failed to save generated document metadata (continuing):', metaErr && (metaErr as any).message ? (metaErr as any).message : metaErr);
              }
            } catch (metaErr2) {
              console.warn('GeneratedDocument model not found or create failed (continuing):', metaErr2 && (metaErr2 as any).message ? (metaErr2 as any).message : metaErr2);
            }

            try {
              const ProcessedDocument = require('../../models/ProcessedDocument');
              const pdQuery: any = {};
              if (require('mongoose').Types.ObjectId.isValid(fileId)) pdQuery.sourceTemplateId = require('mongoose').Types.ObjectId(fileId);
              if (req.body && req.body.requestId && require('mongoose').Types.ObjectId.isValid(req.body.requestId)) pdQuery.requestId = require('mongoose').Types.ObjectId(req.body.requestId);
              if (!pdQuery.sourceTemplateId && !pdQuery.requestId) {
                pdQuery.filename = filename;
                pdQuery['metadata.sourceFileId'] = fileId;
              }
              const existingProcessed = await ProcessedDocument.findOne(pdQuery).lean();
              if (!existingProcessed) {
                const newProcessed = new ProcessedDocument({
                  filename,
                  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  size: filledBuffer.length,
                  gridFsFileId: savedId,
                  metadata: { sourceFileId: fileId },
                  sourceTemplateId: pdQuery.sourceTemplateId,
                  requestId: pdQuery.requestId,
                  uploadedBy: req.user && req.user._id ? req.user._id : undefined
                });
                try {
                  const savedProcessed = await newProcessed.save();
                  try { res.set('X-Processed-Doc-Id', String(savedProcessed._id)); } catch (e) {}
                } catch (procSaveErr) {
                  console.warn('Failed to save processed document metadata (continuing):', (procSaveErr && (procSaveErr as any).message) || procSaveErr);
                }
              } else {
                try { res.set('X-Processed-Doc-Id', String(existingProcessed._id)); } catch (e) {}
              }
            } catch (procErr) {
              console.warn('ProcessedDocument model not available or save failed (continuing):', (procErr && (procErr as any).message) || procErr);
            }
          }
        } catch (uploadErr) {
          console.warn('Failed to upload generated file to processed_documents bucket (continuing to return file):', uploadErr && (uploadErr as any).message);
        }

        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
        res.send(filledBuffer);
      } catch (error) {
        res.status(500).json({ message: 'Error processing filled document', error: (error as Error).message });
      }
    });
    stream.on('error', (err: any) => {
      res.status(500).json({ message: 'Error reading template file', error: err });
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating filled document', error });
  }
};
// Download original .docx file from GridFS for integrity check
export const downloadOriginalDocument = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) {
      return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    }
    const fileId = req.params.id;
    const { ObjectId } = require('mongodb');
    let objectId;
    console.log('[downloadOriginalDocument] Requested fileId:', fileId);
    try {
      objectId = new ObjectId(fileId);
    } catch (e) {
      console.error('[downloadOriginalDocument] Invalid ObjectId:', fileId);
      return res.status(400).json({ success: false, message: 'Invalid file ID.' });
    }
    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      console.error('[downloadOriginalDocument] File not found in GridFS:', fileId);
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    console.log('[downloadOriginalDocument] Found file:', files[0]);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${files[0].filename}"`);
    gridFSBucket.openDownloadStream(objectId).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error downloading original file', error });
  }
};
// Preview .docx as HTML or PDF
export const previewDocument = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) {
      console.error('GridFSBucket not initialized');
      return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    }
    const fileId = req.params.id;
    const { ObjectId } = require('mongodb');
    let objectId;
    try {
      objectId = new ObjectId(fileId);
    } catch (e) {
      console.error('Invalid ObjectId:', fileId);
      return res.status(400).json({ success: false, message: 'Invalid file ID.' });
    }
    const files = await gridFSBucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      console.error('File not found in GridFS:', fileId);
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    // Download .docx from GridFS to buffer
    const chunks: Buffer[] = [];
    const stream = gridFSBucket.openDownloadStream(objectId);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      if (req.query.format === 'html') {
        try {
          const result = await mammoth.convertToHtml({ buffer });
          res.set('Content-Type', 'text/html');
          res.send(result.value);
        } catch (err) {
          console.error('Error converting to HTML:', err);
          res.status(500).json({ success: false, message: 'Error converting to HTML', error: err });
        }
      } else if (req.query.format === 'pdf') {
        try {
          console.log('[previewDocument] Starting PDF conversion for file:', files[0]?.filename);
          const result = await mammoth.convertToHtml({ buffer });
          if (!result.value || result.value.trim() === '') {
            console.error('[previewDocument] Mammoth returned empty HTML for file:', files[0]?.filename);
            return res.status(500).json({ success: false, message: 'Document content is empty or could not be extracted.' });
          }
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage();
          page.drawText(result.value.replace(/<[^>]+>/g, ' ')); // Simple text, not styled
          const pdfBytes = await pdfDoc.save();
          if (!pdfBytes || pdfBytes.length === 0) {
            console.error('[previewDocument] PDF generation returned empty buffer for file:', files[0]?.filename);
            return res.status(500).json({ success: false, message: 'PDF generation failed or returned empty.' });
          }
          res.set('Content-Type', 'application/pdf');
          res.send(Buffer.from(pdfBytes));
        } catch (err) {
          console.error('[previewDocument] Error converting to PDF:', err);
          res.status(500).json({ success: false, message: 'Error converting to PDF', error: err });
        }
      } else {
        res.status(400).json({ success: false, message: 'Specify format=html or format=pdf' });
      }
    });
    stream.on('error', (err: any) => {
      console.error('Error reading file from GridFS:', err);
      res.status(500).json({ success: false, message: 'Error reading file', error: err });
    });
  } catch (error) {
    console.error('Error previewing file:', error);
    res.status(500).json({ success: false, message: 'Error previewing file', error });
  }
};
// List all files in GridFSBucket
export const listDocuments = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    const files = await gridFSBucket.find().toArray();
    res.json(files);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error listing files', error });
  }
};

// Download a file by id from GridFSBucket
export const downloadDocument = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    const fileId = req.params.id;
    const { ObjectId } = require('mongodb');
    const files = await gridFSBucket.find({ _id: new ObjectId(fileId) }).toArray();
    if (!files || files.length === 0) return res.status(404).json({ success: false, message: 'File not found.' });
    console.log('GridFS file size before download:', files[0].length);
    const mimeType = files[0].contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    res.set('Content-Type', mimeType);
    // If the request has ?inline=1, show in browser, else download
    const disposition = req.query.inline === '1'
      ? `inline; filename="${files[0].filename}"`
      : `attachment; filename="${files[0].filename}"`;
    res.set('Content-Disposition', disposition);
    gridFSBucket.openDownloadStream(new ObjectId(fileId)).pipe(res);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error downloading file', error });
  }
};

// Delete a file by id from GridFSBucket
export const deleteDocument = async (req: Request, res: Response) => {
  try {
    if (!gridFSBucket) return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    const fileId = req.params.id;
    const { ObjectId } = require('mongodb');
    await gridFSBucket.delete(new ObjectId(fileId));
    await logActivity(req, 'DOCUMENT', 'DELETED', `Document file deleted (ID: ${fileId})`);
    res.json({ success: true, message: 'File deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting file', error });
  }
};


// Extend Express Request type to include Multer's file property
// Define MulterFile type manually since 'multer' does not export a 'File' type
type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
};

declare global {
  namespace Express {
    interface Request {
      file?: MulterFile;
    }
  }
}

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion';
let gridFSBucket: GridFSBucket | null = null;

mongoose.connection.on('open', () => {
  // @ts-ignore: mongoose.connection.db is always set after 'open'
  gridFSBucket = new GridFSBucket((mongoose.connection.db as any), {
    bucketName: 'documents'
  });
  console.log('GridFSBucket initialized');
});

// Handle document upload
export const uploadDocument = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      console.error('Multer did not receive a file. req.body:', req.body);
      return res.status(400).json({ success: false, message: 'No file uploaded.', debug: req.body });
    }
    if (!gridFSBucket) {
      console.error('GridFSBucket not initialized. Mongoose state:', mongoose.connection.readyState);
      return res.status(500).json({ success: false, message: 'GridFSBucket not initialized.' });
    }
    const filePath = req.file.path;
    try {
      const tempFileSize = fs.statSync(filePath).size;
      console.log('Temp file size before upload:', tempFileSize);
    } catch (err) {
      console.error('Error reading temp file size:', err);
    }
    const uploadStream = gridFSBucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype
    });
    fs.createReadStream(filePath)
      .pipe(uploadStream)
      .on('finish', async () => {
        // Check file size in GridFS after upload
        try {
          if (!gridFSBucket) {
            console.error('GridFSBucket not initialized during post-upload file size check.');
          } else {
            const files = await gridFSBucket.find({ _id: uploadStream.id }).toArray();
            if (files && files[0]) {
              console.log('GridFS file size after upload:', files[0].length);
            }
          }
        } catch (err) {
          console.error('Error reading GridFS file size after upload:', err);
        }
        fs.unlink(filePath, () => {});
        res.status(200).json({
          success: true,
          message: 'File uploaded to GridFSBucket successfully.',
          fileId: uploadStream.id,
          filename: uploadStream.filename
        });
      })
      .on('error', (err: any) => {
        console.error('GridFSBucket upload error:', err);
        res.status(500).json({ success: false, message: 'Error uploading to GridFSBucket', error: err });
      });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: 'Error uploading file', error });
  }
}

export const processDocument = async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id;
    const document = await DocumentRequest.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    // Fetch template text from GridFS (simulate: use templateText field or placeholder)
    let templateText = document.templateText;
    if (!templateText) {
      // Optionally fetch from GridFSBucket if needed
      templateText = `Document for ${document.type}\n$[firstName] $[lastName] $[age]`;
    }
    // Replace placeholders with submitted field values
    let content = templateText;
    if (document.fieldValues) {
      Object.entries(document.fieldValues).forEach(([key, value]) => {
        const regex = new RegExp(`\\$\\[${key}\\]`, 'g');
        content = content.replace(regex, value);
      });
    }
    // Optionally replace system fields
    content = content.replace(/\\$\\[documentNumber\\]/g, document.documentNumber || '');
    content = content.replace(/\\$\\[validUntil\\]/g, document.validUntil ? document.validUntil.toLocaleDateString() : '');

    // Ensure a transactionCode exists for this document and replace [qr] and $[qr]
    if (!document.transactionCode) {
      // Generate a transaction code: YEAR-<6char alphanumeric>-<shortObjectId>
      const year = new Date().getFullYear();
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const shortId = (document._id && document._id.toString().slice(-6).toUpperCase()) || Math.random().toString(36).substring(2, 6).toUpperCase();
      document.transactionCode = `${year}-${randomPart}-${shortId}`;
      try {
        await document.save();
      } catch (saveErr) {
        console.error('Error saving transactionCode for document:', saveErr);
      }
    }
    const tx = document.transactionCode || '';
    if (tx) {
      content = content.replace(/\[qr\]/g, tx);
      content = content.replace(/\$\[qr\]/g, tx);
    } else {
      content = content.replace(/\[qr\]/g, '');
      content = content.replace(/\$\[qr\]/g, '');
    }

    res.json({ content, transactionCode: document.transactionCode });
  } catch (error) {
    res.status(500).json({ message: 'Error processing document', error });
  }
};

export const createDocument = async (req: Request, res: Response) => {
  try {
    // Accept both 'type' and 'documentType' from frontend
    const { documentType, type, purpose, additionalDetails, barangayID } = req.body;
    const docType = type || documentType;
    // Use barangayID as the unique resident identifier
    if (!docType || !purpose || !barangayID) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    // Find resident by barangayID
    const Resident = require('../models/Resident').default || require('../models/Resident').Resident;
    const resident = await Resident.findOne({ barangayID });
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found for provided barangayID.' });
    }
    // Check for existing document of same type in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const existing = await DocumentRequest.findOne({
      type: docType,
      barangayID,
      dateRequested: { $gte: sevenDaysAgo }
    });
    if (existing) {
      return res.status(400).json({ message: 'You can only submit one copy of this document every 7 days.' });
    }
    let requestedByName = [resident.firstName, resident.middleName, resident.lastName].filter(Boolean).join(' ');
    const document = new DocumentRequest({
      type: docType,
      purpose,
      username: resident.username,
      barangayID,
      requestedByName,
      status: 'pending',
      dateRequested: new Date(),
      remarks: additionalDetails?.remarks,
    });
    await document.save();
    const populatedDocument = await DocumentRequest.findById(document._id);
    await logActivity(req, 'DOCUMENT', 'CREATED', `Document ${docType} created for barangayID ${barangayID}`);
    res.status(201).json(populatedDocument);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document', error });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const documents = await DocumentRequest.find();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents', error });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
  try {
    const document = await DocumentRequest.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    // Send email notification if status is approved or rejected
    const status = document.status;
    const notes = document.remarks;
    // Fetch resident for email using username and barangayID
    const Resident = require('../models/Resident').default || require('../models/Resident').Resident;
    const resident = await Resident.findOne({ username: document.username, barangayID: document.barangayID });
    const email = resident?.email;
    if ((status === 'approved' || status === 'rejected') && email) {
      await sendDocumentNotification(email, status, document.type, notes);
    }
    await logActivity(req, 'DOCUMENT', 'UPDATED', `Document ${document?.type || ''} updated (ID: ${req.params.id})`);
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document', error });
  }
};

export const getDocumentById = async (req: Request, res: Response) => {
  try {
    const document = await DocumentRequest.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document', error });
  }
};

