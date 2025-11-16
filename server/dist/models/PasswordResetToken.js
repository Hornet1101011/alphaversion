"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetToken = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const passwordResetTokenSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    // store a SHA-256 hash of the token for safety in case DB is leaked
    // unique: true will create the index; avoid duplicate `index: true` flag
    tokenHash: { type: String, required: true, unique: true },
    // TTL index is created below via schema.index(); avoid per-field index: true to prevent duplicate index warnings
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
// Create TTL index so MongoDB automatically deletes expired tokens
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.PasswordResetToken = mongoose_1.default.model('PasswordResetToken', passwordResetTokenSchema);
