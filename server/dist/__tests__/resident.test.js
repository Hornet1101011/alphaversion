"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Import the Express app for testing
const app_1 = __importDefault(require("../app"));
// ...existing code...
describe('Resident CRUD', () => {
    let residentId;
    it('should create a resident', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/resident')
            .send({ firstName: 'Juan', lastName: 'Dela Cruz', email: 'juan@example.com' });
        expect(res.status).toBe(201);
        residentId = res.body._id;
    });
    it('should get resident by ID', async () => {
        const res = await (0, supertest_1.default)(app_1.default).get(`/api/resident/${residentId}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('email', 'juan@example.com');
    });
    it('should update resident', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .put(`/api/resident/${residentId}`)
            .send({ lastName: 'Santos' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('lastName', 'Santos');
    });
    it('should delete resident', async () => {
        const res = await (0, supertest_1.default)(app_1.default).delete(`/api/resident/${residentId}`);
        expect(res.status).toBe(200);
    });
});
