"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
// Import the Express app for testing
const app_1 = __importDefault(require("../app"));
// ...existing code...
describe('Document Requests', () => {
    let docId;
    it('should create a document request', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/document/request')
            .send({ type: 'Barangay Clearance', residentId: '12345' });
        expect(res.status).toBe(201);
        docId = res.body._id;
    });
    it('should get document request by ID', async () => {
        const res = await (0, supertest_1.default)(app_1.default).get(`/api/document/request/${docId}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('type', 'Barangay Clearance');
    });
    it('should update document request status', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .put(`/api/document/request/${docId}`)
            .send({ status: 'approved' });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('status', 'approved');
    });
    it('should delete document request', async () => {
        const res = await (0, supertest_1.default)(app_1.default).delete(`/api/document/request/${docId}`);
        expect(res.status).toBe(200);
    });
});
