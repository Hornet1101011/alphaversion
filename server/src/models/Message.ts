import mongoose, { Document } from 'mongoose';

export interface IMessage extends Document {
  to: mongoose.Types.ObjectId; // Resident user
  from: mongoose.Types.ObjectId; // Staff user
  inquiryId?: mongoose.Types.ObjectId; // optional for system messages
  text: string; // message body
  subject?: string; // optional subject for generic messages
  createdAt: Date;
  read: boolean;
}

const messageSchema = new mongoose.Schema({
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // allow system messages where 'from' may be unspecified
  },
  inquiryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inquiry',
    required: false,
  },
  text: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

export const Message = mongoose.model<IMessage>('Message', messageSchema);
