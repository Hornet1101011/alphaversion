"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const User_1 = require("../models/User");
// Format date as MM/DD/YYYY for document templates
const formatDate = (date) => {
    if (!date || !(date instanceof Date))
        return '';
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
};
class DocumentTemplateService {
    static officialDetails = {
        barangayName: "Sample Barangay",
        barangayCaptain: "Juan Dela Cruz",
        municipality: "Sample Municipality",
        province: "Sample Province"
    };
    static async getResidentInfo(residentId) {
        const resident = await User_1.User.findById(residentId);
        if (!resident) {
            throw new Error('Resident not found');
        }
        return resident;
    }
    static generateDocumentNumber() {
        const year = new Date().getFullYear();
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `BC-${year}-${randomNum}`;
    }
    static calculateValidityDate() {
        const validUntil = new Date();
        validUntil.setMonth(validUntil.getMonth() + 6); // 6 months validity
        return validUntil;
    }
    static async generateBarangayCertificate(residentId, purpose) {
        const resident = await this.getResidentInfo(residentId);
        const documentNumber = this.generateDocumentNumber();
        const issueDate = new Date();
        const validUntil = this.calculateValidityDate();
        const data = {
            resident,
            purpose,
            documentNumber,
            issueDate,
            validUntil,
            officialDetails: this.officialDetails
        };
        return `
                          Republic of the Philippines
                          Province of ${data.officialDetails.province}
                          Municipality of ${data.officialDetails.municipality}
                          BARANGAY ${data.officialDetails.barangayName.toUpperCase()}

                          OFFICE OF THE PUNONG BARANGAY

                          BARANGAY CERTIFICATION

Document No: ${data.documentNumber}
Issued on: ${formatDate(data.issueDate)}
Valid until: ${formatDate(data.validUntil)}

TO WHOM IT MAY CONCERN:

        THIS IS TO CERTIFY that ${data.resident.fullName}, of legal age, ${data.resident.civilStatus || 'single'}, Filipino, is a bonafide resident of ${data.resident.address}, Barangay ${data.officialDetails.barangayName}, ${data.officialDetails.municipality}, ${data.officialDetails.province}.

        Based on records filed in this office, he/she has been residing at the above address 
for _____ years and is known to be of good moral character.

        This certification is being issued upon the request of the above-named person for 
${data.purpose.toLowerCase()} purposes only.

        Issued this ${formatDate(data.issueDate)} at the Office of the Punong
Barangay, ${data.officialDetails.barangayName}, ${data.officialDetails.municipality}, 
${data.officialDetails.province}.


                                        _____________________________
                                        ${data.officialDetails.barangayCaptain}
                                        Punong Barangay

IMPORTANT:
1. Not valid without official seal
2. Not valid with erasures or alterations
3. Valid only until ${formatDate(data.validUntil)}
    `;
    }
    static async generateCertificateOfIndigency(residentId, purpose) {
        const resident = await this.getResidentInfo(residentId);
        const documentNumber = this.generateDocumentNumber();
        const issueDate = new Date();
        const validUntil = this.calculateValidityDate();
        const data = {
            resident,
            purpose,
            documentNumber,
            issueDate,
            validUntil,
            officialDetails: this.officialDetails
        };
        return `
                          Republic of the Philippines
                          Province of ${data.officialDetails.province}
                          Municipality of ${data.officialDetails.municipality}
                          BARANGAY ${data.officialDetails.barangayName.toUpperCase()}

                          OFFICE OF THE PUNONG BARANGAY

                          CERTIFICATE OF INDIGENCY

Document No: ${data.documentNumber}
Issued on: ${formatDate(data.issueDate)}
Valid until: ${formatDate(data.validUntil)}

TO WHOM IT MAY CONCERN:

        THIS IS TO CERTIFY that ${data.resident.fullName}, of legal age, ${data.resident.civilStatus || 'single'}, Filipino, is a bonafide resident of ${data.resident.address}, Barangay ${data.officialDetails.barangayName}, ${data.officialDetails.municipality}, ${data.officialDetails.province} and belongs 
to the indigent families in this Barangay.

        This certification is being issued upon the request of the above-named person for 
${data.purpose.toLowerCase()} purposes only.

        Issued this ${formatDate(data.issueDate)} at the Office of the Punong
Barangay, ${data.officialDetails.barangayName}, ${data.officialDetails.municipality}, 
${data.officialDetails.province}.


                                        _____________________________
                                        ${data.officialDetails.barangayCaptain}
                                        Punong Barangay

IMPORTANT:
1. Not valid without official seal
2. Not valid with erasures or alterations
3. Valid only until ${formatDate(data.validUntil)}
    `;
    }
}
exports.default = DocumentTemplateService;
