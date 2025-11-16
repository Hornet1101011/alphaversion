import axios from 'axios';

export async function generateFilledDocx(fileId: string, fieldValues: Record<string, string>, requestId?: string) {
  const payload: any = { fieldValues };
  if (requestId) payload.requestId = requestId;
  const response = await axios.post(`/api/documents/${fileId}/generate-filled`, payload, {
    responseType: 'blob',
  });
  // Parse filename from Content-Disposition header if present
  const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
  let filename = '';
  if (contentDisposition) {
    // Look for filename*=UTF-8''encoded or filename="..." or filename=...
    const fnStarMatch = contentDisposition.match(/filename\*=(?:UTF-8'')?([^;\n\r]+)/i);
    const fnMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (fnStarMatch && fnStarMatch[1]) {
      try {
        filename = decodeURIComponent(fnStarMatch[1].replace(/^UTF-8''/, ''));
      } catch (e) {
        filename = fnStarMatch[1];
      }
    } else if (fnMatch && fnMatch[1]) {
      filename = fnMatch[1];
    }
  }
  const savedId = response.headers['x-filled-file-id'] || response.headers['X-Filled-File-Id'] || null;
  // Prefer the processed GridFS id if available (server may store generated copies in processed_documents bucket)
  const processedGridFsId = response.headers['x-processed-gridfs-id'] || response.headers['X-Processed-GridFS-Id'] || null;
  const finalSavedId = processedGridFsId || savedId;
  const generatedCopyId = response.headers['x-generated-doc-id'] || response.headers['X-Generated-Doc-Id'] || null;
  const processedDocId = response.headers['x-processed-doc-id'] || response.headers['X-Processed-Doc-Id'] || null;
  const transactionCode = response.headers['x-transaction-code'] || response.headers['X-Transaction-Code'] || null;

  // Temporary debug: log what filename and transactionCode were returned by the server
  // Remove or comment out this log after debugging in production
  // eslint-disable-next-line no-console
  console.log('[generateFilledDocx] transactionCode=', transactionCode, 'content-disposition filename=', filename);
  return { blob: response.data, filename, savedId: finalSavedId, generatedCopyId, processedDocId, processedGridFsId, transactionCode };
}
