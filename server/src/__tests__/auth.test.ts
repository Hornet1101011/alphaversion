import request from 'supertest';
// Import the Express app for testing
import app from '../app';
// ...existing code...

describe('Authentication', () => {
  it('should fail login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@example.com', password: 'badpass' });
    expect(res.status).toBe(401);
  });

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'testpass', name: 'Test User' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
  });
});
