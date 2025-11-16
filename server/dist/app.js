"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const inboxRoutes_1 = __importDefault(require("./routes/inboxRoutes"));
console.log('Loaded inboxRoutes in app.ts');
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const body_parser_1 = __importDefault(require("body-parser"));
const passport_1 = __importDefault(require("passport"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Register notification routes
app.use('/api/notifications', require('./routes/notificationRoutes'));
// Register inquiry message routes
app.use('/api/inquiry-messages', require('./routes/inquiryMessageRoutes'));
// Basic security settings
app.set('trust proxy', 1); // Trust only the first proxy (safer for local dev)
app.disable('x-powered-by'); // Disable x-powered-by header
// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});
// Logging middleware
app.use((0, morgan_1.default)('dev'));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use((0, cookie_session_1.default)({ name: 'session', keys: ['secretKey'], maxAge: 24 * 60 * 60 * 1000 }));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Serve uploaded files (profile images) from /uploads
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsPath = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsPath)) {
    fs_1.default.mkdirSync(uploadsPath, { recursive: true });
}
// Serve files stored on disk
app.use('/uploads', express_1.default.static(uploadsPath));
// Serve avatars stored in GridFS by id: /uploads/avatars/:id
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_1 = require("mongodb");
const mongodb_2 = require("mongodb");
let avatarsBucket = null;
mongoose_1.default.connection.on('open', () => {
    // @ts-ignore
    const db = mongoose_1.default.connection.db;
    avatarsBucket = new mongodb_2.GridFSBucket(db, { bucketName: 'avatars' });
});
app.get('/uploads/avatars/:id', async (req, res) => {
    if (!avatarsBucket)
        return res.status(500).send('Avatar storage not ready');
    try {
        const id = req.params.id;
        const objectId = new mongodb_1.ObjectId(id);
        const files = await avatarsBucket.find({ _id: objectId }).toArray();
        if (!files || files.length === 0)
            return res.status(404).send('Not found');
        const file = files[0];
        res.set('Content-Type', file.contentType || 'image/jpeg');
        avatarsBucket.openDownloadStream(objectId).pipe(res);
    }
    catch (err) {
        console.error('Avatar stream error:', err);
        res.status(500).send('Error streaming avatar');
    }
});
// Routes
app.get('/', (req, res) => {
    res.send('Alphaversion backend running');
});
// Use templates route (TypeScript)
app.use('/api/templates', require('./routes/templates'));
app.use('/api/resident', require('./routes/residents'));
app.use('/api/document', require('./routes/documents'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/inbox', (req, res, next) => { console.log('Received request to /api/inbox'); next(); }, inboxRoutes_1.default);
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/notifications', require('./routes/notificationRoutes').default);
// Verification routes for resident ID uploads and admin verification actions
app.use('/api/verification', require('./routes/verificationRoutes').default);
exports.default = app;
