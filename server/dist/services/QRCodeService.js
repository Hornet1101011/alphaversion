"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QRCodeService = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
// Stubbed missing config
const config = {};
class QRCodeService {
    static BASE_URL = 'http://localhost:3000';
    static async generateDocumentQR(documentId, isOnline = true) {
        try {
            const verificationUrl = isOnline
                ? `${this.BASE_URL}/verify-document/${documentId}`
                : `offline://document/${documentId}`;
            // Generate QR code as data URL (base64)
            const qrDataUrl = await qrcode_1.default.toDataURL(verificationUrl, {
                errorCorrectionLevel: 'H', // High error correction level
                margin: 2,
                width: 200,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            return qrDataUrl;
        }
        catch (error) {
            console.error('Error generating QR code:', error);
            throw new Error('Failed to generate QR code');
        }
    }
    static async generateDocumentQRBuffer(documentId, isOnline = true) {
        try {
            const verificationUrl = isOnline
                ? `${this.BASE_URL}/verify-document/${documentId}`
                : `offline://document/${documentId}`;
            // Generate QR code as buffer
            const qrBuffer = await qrcode_1.default.toBuffer(verificationUrl, {
                errorCorrectionLevel: 'H',
                margin: 2,
                width: 200,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
            return qrBuffer;
        }
        catch (error) {
            console.error('Error generating QR code buffer:', error);
            throw new Error('Failed to generate QR code buffer');
        }
    }
}
exports.QRCodeService = QRCodeService;
