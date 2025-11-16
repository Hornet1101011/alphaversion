import QRCode from 'qrcode';
// Stubbed missing config
const config = {};

export class QRCodeService {
  private static readonly BASE_URL = 'http://localhost:3000';

  static async generateDocumentQR(documentId: string, isOnline: boolean = true): Promise<string> {
    try {
      const verificationUrl = isOnline
        ? `${this.BASE_URL}/verify-document/${documentId}`
        : `offline://document/${documentId}`;
      
      // Generate QR code as data URL (base64)
      const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'H', // High error correction level
        margin: 2,
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  static async generateDocumentQRBuffer(documentId: string, isOnline: boolean = true): Promise<Buffer> {
    try {
      const verificationUrl = isOnline
        ? `${this.BASE_URL}/verify-document/${documentId}`
        : `offline://document/${documentId}`;
      
      // Generate QR code as buffer
      const qrBuffer = await QRCode.toBuffer(verificationUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 200,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      return qrBuffer;
    } catch (error) {
      console.error('Error generating QR code buffer:', error);
      throw new Error('Failed to generate QR code buffer');
    }
  }
}
