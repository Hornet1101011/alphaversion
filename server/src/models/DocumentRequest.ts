import mongoose, { Document } from 'mongoose';

export interface IDocumentRequest extends Document {
  type: 'barangay_clearance' | 'residency_certificate' | 'business_permit' | 'indigency_certificate' | 'id_application';
  username: string;
  barangayID?: string;
  purpose: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected' | 'completed';
  documentNumber?: string;
  transactionCode?: string;
  validUntil?: Date;
  dateRequested: Date;
  dateProcessed?: Date;
  dateApproved?: Date;
  processedBy?: mongoose.Types.ObjectId;
  paymentStatus: 'pending' | 'paid' | 'waived';
  paymentAmount?: number;
  paymentDate?: Date;
  remarks?: string;
  documentContent?: string;
  generateDocumentContent(): Promise<string>;
  templateText?: string;
  templateFileId?: mongoose.Types.ObjectId;
  fieldValues?: Record<string, string>;
  filledFileId?: mongoose.Types.ObjectId;
}

const documentRequestSchema = new mongoose.Schema({
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
    type: mongoose.Schema.Types.ObjectId,
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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fs.files',
    required: false
  }
  ,
  // Reference to the generated/filled document saved in GridFS 'documents' bucket
  filledFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fs.files',
    required: false
  },
}, {
  timestamps: true
});

// Auto-generate document number when status changes to approved
documentRequestSchema.pre('save', async function(next) {
  if (this.isModified('status') && this.status === 'approved' && !this.documentNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('DocumentRequest').countDocuments({
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
documentRequestSchema.methods.generateDocumentContent = async function(): Promise<string> {
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
  } else {
    // Also replace markers with empty string if transactionCode not set
    content = content.replace(/\[qr\]/g, '');
    content = content.replace(/\$\[qr\]/g, '');
  }
  return content;
};

// Create indexes for faster queries
documentRequestSchema.index({ requesterId: 1, status: 1 });
documentRequestSchema.index({ dateRequested: -1 });

export const DocumentRequest = mongoose.model<IDocumentRequest>('DocumentRequest', documentRequestSchema);
