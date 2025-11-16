import mongoose, { Document } from 'mongoose';

export interface IRequest extends Document {
  type: string;
  subject: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'approved';
  priority: 'low' | 'medium' | 'high';
  requestedBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  comments?: Array<{
    text: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected', 'approved'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  comments: [{
    text: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

export const Request = mongoose.model<IRequest>('Request', requestSchema);
