"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Announcement = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const AnnouncementSchema = new mongoose_1.default.Schema({
    text: { type: String, required: true },
    imagePath: { type: String },
    // store a copy of the image binary inside the document
    imageData: { type: Buffer },
    imageContentType: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});
exports.Announcement = mongoose_1.default.model('Announcement', AnnouncementSchema);
