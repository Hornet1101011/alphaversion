"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
    to: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    from: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // allow system messages where 'from' may be unspecified
    },
    inquiryId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
exports.Message = mongoose_1.default.model('Message', messageSchema);
