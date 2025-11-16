import { Schema, model, Document as MongooseDocument } from 'mongoose';

export interface ILog extends MongooseDocument {
  type: string;
  message: string;
  details: string;
  actor?: string;
  target?: string;
  createdAt: Date;
}

const LogSchema = new Schema<ILog>({
  type: { type: String },
  message: { type: String },
  details: { type: String },
  actor: { type: String },
  target: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Log = model<ILog>('Log', LogSchema);
