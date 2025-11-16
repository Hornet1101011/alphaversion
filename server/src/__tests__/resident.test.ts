import request from 'supertest';
// Import the Express app for testing
import app from '../app';
// ...existing code...

describe('Resident CRUD', () => {
  let residentId: string;

  it('should create a resident', async () => {
    const res = await request(app)
      .post('/api/resident')
      .send({ firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@example.com' });
    expect(res.status).toBe(201);
    residentId = res.body._id;
  });

  it('should get resident by ID', async () => {
    const res = await request(app).get(`/api/resident/${residentId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'juan@example.com');
  });

  it('should update resident', async () => {
    const res = await request(app)
      .put(`/api/resident/${residentId}`)
      .send({ lastName: 'Santos' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('lastName', 'Santos');
  });

  it('should delete resident', async () => {
    const res = await request(app).delete(`/api/resident/${residentId}`);
    expect(res.status).toBe(200);
  });
});
