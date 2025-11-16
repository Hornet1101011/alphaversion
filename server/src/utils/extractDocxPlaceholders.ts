import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * Extracts all bracketed placeholders (e.g., [lastname]) from a DOCX file.
 * Returns an array of unique placeholder names (without brackets).
 */
export async function extractDocxPlaceholders(docxPath: string): Promise<string[]> {
  const fileBuffer = fs.readFileSync(docxPath);
  const zip = await JSZip.loadAsync(fileBuffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return [];
  // Find all $[placeholder] in the XML text
  const matches = documentXml.match(/\$\[[^\[\]]+\]/g) || [];
  // Remove $[ and ] and duplicates
  const placeholders: string[] = Array.from(new Set(matches.map(ph => String(ph).replace(/\$\[|\]/g, ''))));
  return placeholders;
}
