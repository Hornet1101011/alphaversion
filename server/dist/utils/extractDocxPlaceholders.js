"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocxPlaceholders = extractDocxPlaceholders;
const fs_1 = __importDefault(require("fs"));
const jszip_1 = __importDefault(require("jszip"));
/**
 * Extracts all bracketed placeholders (e.g., [lastname]) from a DOCX file.
 * Returns an array of unique placeholder names (without brackets).
 */
async function extractDocxPlaceholders(docxPath) {
    const fileBuffer = fs_1.default.readFileSync(docxPath);
    const zip = await jszip_1.default.loadAsync(fileBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml)
        return [];
    // Find all $[placeholder] in the XML text
    const matches = documentXml.match(/\$\[[^\[\]]+\]/g) || [];
    // Remove $[ and ] and duplicates
    const placeholders = Array.from(new Set(matches.map(ph => String(ph).replace(/\$\[|\]/g, ''))));
    return placeholders;
}
