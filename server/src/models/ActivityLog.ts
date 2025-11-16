import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  timestamp: Date;
  userId: mongoose.Types.ObjectId;
  userRole: string;
  module: string;
  action: string;
  description: string;
  ipAddress: string;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  timestamp: { type: Date, default: Date.now, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userRole: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
  description: { type: String, required: true },
  ipAddress: { type: String, required: true },
});

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
