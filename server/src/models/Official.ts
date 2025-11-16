import mongoose from 'mongoose';

const officialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  title: { type: String, trim: true },
  term: { type: String, trim: true },
  photo: { type: Buffer },
  photoContentType: { type: String },
  photoPath: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Official = mongoose.model('Official', officialSchema);

export default Official;
