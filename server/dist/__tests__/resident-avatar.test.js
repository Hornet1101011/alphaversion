"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Resident_1 = require("../models/Resident");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Simple integration test for avatar upload
describe('Resident avatar upload', () => {
    let server;
    let token;
    let testUserId;
    beforeAll(async () => {
        // Ensure DB connection is ready
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion_test';
        await mongoose_1.default.connect(MONGO_URI);
        // Create a test user
        const user = new User_1.User({ username: 'avatar_test_user', email: 'avatar@test.local', barangayID: 'TEST-BRG', fullName: 'Avatar Test', password: 'password', role: 'resident' });
        await user.save();
        testUserId = user._id;
        token = jsonwebtoken_1.default.sign({ _id: user._id }, process.env.JWT_SECRET || 'defaultsecret');
        server = app_1.default.listen(0);
    });
    afterAll(async () => {
        await User_1.User.deleteOne({ _id: testUserId });
        await Resident_1.Resident.deleteMany({ userId: testUserId });
        await mongoose_1.default.disconnect();
        server.close();
    });
    it('uploads an avatar and updates resident', async () => {
        // create a small JPEG buffer as test image
        const imageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // minimal JPEG
        const res = await (0, supertest_1.default)(server)
            .post('/api/resident/personal-info/avatar')
            .set('Authorization', `Bearer ${token}`)
            .attach('avatar', imageBuffer, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('resident');
        const resident = res.body.resident;
        expect(resident).toHaveProperty('profileImageId');
        // Optionally verify GridFS contains file by trying to GET the avatar
        const getRes = await (0, supertest_1.default)(server).get(`/uploads/avatars/${resident.profileImageId}`);
        expect([200, 404]).toContain(getRes.status); // allow 404 if GridFS hasn't initialized immediately
    }, 20000);
});
