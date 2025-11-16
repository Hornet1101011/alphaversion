"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Official = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const officialSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    term: { type: String, trim: true },
    photo: { type: Buffer },
    photoContentType: { type: String },
    photoPath: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
exports.Official = mongoose_1.default.model('Official', officialSchema);
exports.default = exports.Official;
