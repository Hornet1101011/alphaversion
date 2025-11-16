import mongoose, { Document } from 'mongoose';

export interface IInquiry extends Document {
  subject: string;
  message: string;
  type?: string;
  status: 'open' | 'in-progress' | 'resolved';
  createdBy: mongoose.Types.ObjectId;
  username: string;
  barangayID: string;
  assignedTo?: mongoose.Types.ObjectId;
  responses?: Array<{
    text: string;
    createdBy: mongoose.Types.ObjectId;
    authorName?: string;
    authorRole?: string;
    createdAt: Date;
    attachments?: Array<{
      filename: string;
      path?: string;
      url?: string;
      contentType?: string;
      size?: number;
      uploadedAt?: Date;
    }>;
  }>;
  attachments?: Array<{
    filename: string;
    path?: string;
    url?: string;
    contentType?: string;
    size?: number;
    uploadedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const inquirySchema = new mongoose.Schema({
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
    type: mongoose.Schema.Types.ObjectId,
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
    type: mongoose.Schema.Types.ObjectId,
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
      type: mongoose.Schema.Types.ObjectId,
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

export const Inquiry = mongoose.model<IInquiry>('Inquiry', inquirySchema);
