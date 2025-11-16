"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Import the Express app for testing
const app_1 = __importDefault(require("../app"));
// ...existing code...
describe('Authentication', () => {
    it('should fail login with invalid credentials', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/login')
            .send({ email: 'wrong@example.com', password: 'badpass' });
        expect(res.status).toBe(401);
    });
    it('should register a new user', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'testpass', name: 'Test User' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('user');
    });
});
