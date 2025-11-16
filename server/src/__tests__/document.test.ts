import request from 'supertest';
// Import the Express app for testing
import app from '../app';
// ...existing code...

describe('Document Requests', () => {
  let docId: string;

  it('should create a document request', async () => {
    const res = await request(app)
      .post('/api/document/request')
      .send({ type: 'Barangay Clearance', residentId: '12345' });
    expect(res.status).toBe(201);
    docId = res.body._id;
  });

  it('should get document request by ID', async () => {
    const res = await request(app).get(`/api/document/request/${docId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('type', 'Barangay Clearance');
  });

  it('should update document request status', async () => {
    const res = await request(app)
      .put(`/api/document/request/${docId}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'approved');
  });

  it('should delete document request', async () => {
    const res = await request(app).delete(`/api/document/request/${docId}`);
    expect(res.status).toBe(200);
  });
});
