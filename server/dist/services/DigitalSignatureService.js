"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalSignatureService = void 0;
const node_signpdf_1 = require("node-signpdf");
const node_signpdf_2 = require("node-signpdf");
const fs_1 = __importDefault(require("fs"));
class DigitalSignatureService {
    static signPDF({ pdfBuffer, p12Buffer, passphrase }) {
        // Add a signature placeholder to the PDF
        const pdfWithPlaceholder = (0, node_signpdf_1.plainAddPlaceholder)({ pdfBuffer, reason: 'Document signed electronically' });
        // Sign the PDF
        const signer = new node_signpdf_2.SignPdf(); // Create a SignPdf instance
        const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase }); // Sign the PDF
        return signedPdf;
    }
    static signPDFFile({ pdfPath, p12Path, passphrase, outputPath }) {
        const pdfBuffer = fs_1.default.readFileSync(pdfPath);
        const p12Buffer = fs_1.default.readFileSync(p12Path);
        const signedPdf = DigitalSignatureService.signPDF({ pdfBuffer, p12Buffer, passphrase });
        fs_1.default.writeFileSync(outputPath, signedPdf);
        return outputPath;
    }
}
exports.DigitalSignatureService = DigitalSignatureService;
