"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSetting = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const smtpSchema = new mongoose_1.Schema({
    host: { type: String },
    port: { type: Number },
    secure: { type: Boolean },
    user: { type: String },
    encryptedPassword: { type: String },
    fromName: { type: String },
});
const systemSettingSchema = new mongoose_1.Schema({
    siteName: { type: String },
    barangayName: { type: String },
    barangayAddress: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    maintenanceMode: { type: Boolean, default: false },
    allowRegistrations: { type: Boolean, default: true },
    requireEmailVerification: { type: Boolean, default: true },
    maxDocumentRequestsPerUser: { type: Number, default: 5 },
    documentProcessingDays: { type: Number, default: 3 },
    systemNotice: { type: String },
    smtp: { type: smtpSchema, default: {} },
}, { timestamps: true });
const modelName = 'SystemSetting';
exports.SystemSetting = (mongoose_1.default.models && mongoose_1.default.models[modelName])
    ? mongoose_1.default.models[modelName]
    : mongoose_1.default.model(modelName, systemSettingSchema);
exports.default = exports.SystemSetting;
