"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notificationSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    // legacy field name sometimes used by scripts
    user: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    // allow arbitrary type strings so staff-related notifications are supported
    type: { type: String, required: true },
    title: { type: String },
    message: { type: String, required: true },
    // store additional payload such as requester info
    data: { type: mongoose_1.default.Schema.Types.Mixed },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
exports.Notification = mongoose_1.default.model('Notification', notificationSchema);
