import { Schema, model, Document as MongooseDocument } from 'mongoose';

export interface IGuest extends MongooseDocument {
  name: string;
  contactNumber: string;
  email?: string;
  intent: string;
  sessionToken: string;
  role: 'guest';
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/**
 * Guest schema
 * - Used for short-lived guest accounts created via the public UI
 * - `expiresAt` is indexed with a TTL so documents are removed automatically
 */
const guestSchema = new Schema<IGuest>(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      match: [/^[0-9+\-\s()]+$/, 'Please enter a valid contact number'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
      required: false,
    },
    intent: { type: String, required: [true, 'Intent is required'] },
    sessionToken: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['guest'], default: 'guest' },
    // When the guest account should expire; default to 24 hours from creation
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically remove expired guest documents
guestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Guest = model<IGuest>('Guest', guestSchema);

export default Guest;
