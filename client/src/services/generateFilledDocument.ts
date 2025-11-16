// Generate filled document for a document request (staff action)
import axios from 'axios';

export async function generateFilledDocument(requestId: string) {
  const response = await axios.post(`/api/document-requests/${requestId}/generate-filled`);
  return response.data;
}
