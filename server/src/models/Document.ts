// ...existing code...
// ...existing code...
import mongoose, { Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  title: string;
  type: string;
  description: string;
  fileUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  isUrgent: boolean;
  barangayID?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  fileUrl: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  notes: { type: String },
  isUrgent: { type: Boolean, default: false },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedByName: { type: String },
  barangayID: { type: String },
  dateRequested: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });


export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
export const Document = DocumentModel;
