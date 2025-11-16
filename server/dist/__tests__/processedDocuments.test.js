"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
// ProcessedDocument model lives under server/models (CommonJS), require it directly
const ProcessedDocument = require('../../models/ProcessedDocument');
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
describe('ProcessedDocuments upload endpoint', () => {
    let server;
    let token;
    let testUserId;
    let savedProcessedId;
    beforeAll(async () => {
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion_test';
        await mongoose_1.default.connect(MONGO_URI);
        // create a test user (staff role)
        const user = new User_1.User({ username: 'proc_test_user', email: 'proc@test.local', barangayID: 'TEST-BRG', fullName: 'Proc Test', password: 'password', role: 'staff' });
        await user.save();
        testUserId = user._id;
        token = jsonwebtoken_1.default.sign({ _id: user._id }, process.env.JWT_SECRET || 'defaultsecret');
        server = app_1.default.listen(0);
    });
    afterAll(async () => {
        if (savedProcessedId) {
            await ProcessedDocument.deleteOne({ _id: savedProcessedId });
        }
        await User_1.User.deleteOne({ _id: testUserId });
        await mongoose_1.default.disconnect();
        server.close();
    });
    it('accepts multipart upload and saves to processed_documents GridFS and metadata', async () => {
        // small DOCX-like buffer (not a real docx but sufficient for upload path)
        const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
        const res = await (0, supertest_1.default)(server)
            .post('/api/processed-documents/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', buf, { filename: 'test_generated.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
            .field('sourceTemplateId', '')
            .field('requestId', '');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('gridFsFileId');
        const gridFsId = res.body.gridFsFileId;
        // Check metadata was created (if any)
        const pd = await ProcessedDocument.findOne({ gridFsFileId: gridFsId }).lean();
        if (pd) {
            savedProcessedId = pd._id;
            expect(pd).toHaveProperty('filename');
            expect(pd.filename).toMatch(/test_generated\.docx/);
        }
    }, 20000);
});
