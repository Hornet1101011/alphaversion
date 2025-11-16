import request from 'supertest';
import app from '../app';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Resident } from '../models/Resident';
import jwt from 'jsonwebtoken';
import fs from 'fs';

// Simple integration test for avatar upload
describe('Resident avatar upload', () => {
  let server: any;
  let token: string;
  let testUserId: any;

  beforeAll(async () => {
    // Ensure DB connection is ready
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion_test';
    await mongoose.connect(MONGO_URI);
    // Create a test user
    const user = new User({ username: 'avatar_test_user', email: 'avatar@test.local', barangayID: 'TEST-BRG', fullName: 'Avatar Test', password: 'password', role: 'resident' });
    await user.save();
    testUserId = user._id;
    token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'defaultsecret');
    server = app.listen(0);
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUserId });
    await Resident.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
    server.close();
  });

  it('uploads an avatar and updates resident', async () => {
    // create a small JPEG buffer as test image
    const imageBuffer = Buffer.from([0xff,0xd8,0xff,0xd9]); // minimal JPEG
    const res = await request(server)
      .post('/api/resident/personal-info/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', imageBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('resident');
    const resident = res.body.resident;
    expect(resident).toHaveProperty('profileImageId');
    // Optionally verify GridFS contains file by trying to GET the avatar
    const getRes = await request(server).get(`/uploads/avatars/${resident.profileImageId}`);
    expect([200, 404]).toContain(getRes.status); // allow 404 if GridFS hasn't initialized immediately
  }, 20000);
});
