import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema({
  text: { type: String, required: true },
  imagePath: { type: String },
  // store a copy of the image binary inside the document
  imageData: { type: Buffer },
  imageContentType: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

export const Announcement = mongoose.model('Announcement', AnnouncementSchema);
