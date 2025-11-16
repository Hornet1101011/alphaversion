import { plainAddPlaceholder } from 'node-signpdf';
import { SignPdf } from 'node-signpdf';
import fs from 'fs';
import path from 'path';

export class DigitalSignatureService {
  static signPDF({ pdfBuffer, p12Buffer, passphrase }: {
    pdfBuffer: Buffer;
    p12Buffer: Buffer;
    passphrase: string;
  }): Buffer {
    // Add a signature placeholder to the PDF
    const pdfWithPlaceholder = plainAddPlaceholder({ pdfBuffer, reason: 'Document signed electronically' });
    // Sign the PDF
  const signer = new SignPdf(); // Create a SignPdf instance
  const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, { passphrase }); // Sign the PDF
    return signedPdf;
  }

  static signPDFFile({ pdfPath, p12Path, passphrase, outputPath }: {
    pdfPath: string;
    p12Path: string;
    passphrase: string;
    outputPath: string;
  }): string {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const p12Buffer = fs.readFileSync(p12Path);
    const signedPdf = DigitalSignatureService.signPDF({ pdfBuffer, p12Buffer, passphrase });
    fs.writeFileSync(outputPath, signedPdf);
    return outputPath;
  }
}
