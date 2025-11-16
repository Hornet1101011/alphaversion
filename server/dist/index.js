"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSockets = exports.io = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
// Load environment variables from .env file in server root directory
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const app = (0, express_1.default)();
app.set('trust proxy', 1); // Trust only the first proxy (safer for local dev)
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
exports.io = io;
// Middleware
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
const express_2 = __importDefault(require("express"));
// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay_system';
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        // Retry connection after 5 seconds
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};
connectDB();
// Ensure processed_documents GridFS bucket exists (collections and indexes)
mongoose_1.default.connection.on('connected', async () => {
    try {
        const db = mongoose_1.default.connection.db;
        if (!db) {
            console.warn('MongoDB db not available to ensure processed_documents bucket');
            return;
        }
        const filesName = 'processed_documents.files';
        const chunksName = 'processed_documents.chunks';
        const collList = await db.listCollections({}).toArray();
        const collNames = collList.map((c) => c.name);
        if (!collNames.includes(filesName)) {
            console.log('Creating collection', filesName);
            try {
                await db.createCollection(filesName);
            }
            catch (e) {
                console.warn('createCollection files failed', e && e.message);
            }
        }
        if (!collNames.includes(chunksName)) {
            console.log('Creating collection', chunksName);
            try {
                await db.createCollection(chunksName);
            }
            catch (e) {
                console.warn('createCollection chunks failed', e && e.message);
            }
        }
        // Ensure indexes on files collection
        try {
            const filesColl = db.collection(filesName);
            await filesColl.createIndex({ filename: 1 });
            await filesColl.createIndex({ uploadDate: 1 });
            await filesColl.createIndex({ 'metadata.sourceFileId': 1 });
        }
        catch (e) {
            console.warn('Failed to create indexes on processed_documents.files', e && e.message);
        }
        // Ensure unique index on chunks (files_id + n)
        try {
            const chunksColl = db.collection(chunksName);
            await chunksColl.createIndex({ files_id: 1, n: 1 }, { unique: true });
        }
        catch (e) {
            console.warn('Failed to create index on processed_documents.chunks', e && e.message);
        }
        console.log('Ensured processed_documents GridFS bucket collections and indexes.');
    }
    catch (err) {
        console.error('Error ensuring processed_documents bucket', err && err.message);
    }
});
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const documentRoutes_1 = __importDefault(require("./routes/documentRoutes"));
const documentRequestRoutes_1 = __importDefault(require("./routes/documentRequestRoutes"));
const requestRoutes_1 = __importDefault(require("./routes/requestRoutes"));
const inquiryRoutes_1 = __importDefault(require("./routes/inquiryRoutes"));
const myInquiryRoutes_1 = __importDefault(require("./routes/myInquiryRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const residents_1 = __importDefault(require("./routes/residents"));
// Import the TS module explicitly to avoid accidentally loading a duplicated .js file
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const activityLogRoutes_1 = __importDefault(require("./routes/activityLogRoutes"));
const announcementRoutes_1 = __importDefault(require("./routes/announcementRoutes"));
// WebSocket setup
// User socket tracking
const userSockets = new Map(); // userId -> Set<socketId>
exports.userSockets = userSockets;
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('register-user', (userId) => {
        if (!userId)
            return;
        if (!userSockets.has(userId))
            userSockets.set(userId, new Set());
        userSockets.get(userId).add(socket.id);
        socket.data.userId = userId;
        console.log(`User ${userId} registered socket ${socket.id}`);
    });
    socket.on('disconnect', () => {
        const userId = socket.data.userId;
        if (userId && userSockets.has(userId)) {
            userSockets.get(userId).delete(socket.id);
            if (userSockets.get(userId).size === 0)
                userSockets.delete(userId);
            console.log(`User ${userId} disconnected socket ${socket.id}`);
        }
        else {
            console.log('Client disconnected:', socket.id);
        }
    });
});
// Routes
// Public fallback for notifications (keep this before notification routes are mounted)
app.get('/api/notifications/fallback', (_req, res) => {
    return res.json([]);
});
app.use('/api/auth', authRoutes_1.default);
app.use('/api/documents', documentRoutes_1.default);
// Mount processed documents routes (metadata + GridFS streaming + upload)
try {
    // Use require because the route is implemented in CommonJS under server/src/routes
    // and exports an Express router
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const processedDocs = require('./routes/processedDocuments');
    if (processedDocs)
        app.use('/api/processed-documents', processedDocs);
}
catch (e) {
    console.error('Failed to mount /api/processed-documents routes in src/index.ts', e);
}
app.use('/api/document-requests', documentRequestRoutes_1.default);
app.use('/api/requests', requestRoutes_1.default);
app.use('/api/inquiries', inquiryRoutes_1.default);
app.use('/api/inquiries', myInquiryRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
// Mount public officials route so unauthenticated pages (login) can fetch officials
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const publicOfficials = require('../routes/publicOfficials');
    if (publicOfficials)
        app.use('/api/officials', publicOfficials);
}
catch (e) {
    console.error('Failed to mount /api/officials public route in src/index.ts', e);
}
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/resident', residents_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/activity-logs', activityLogRoutes_1.default);
// Verification routes: resident uploads and admin actions
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const verificationRoutes = require('./routes/verificationRoutes');
    if (verificationRoutes)
        app.use('/api/verification', verificationRoutes.default || verificationRoutes);
}
catch (e) {
    console.error('Failed to mount /api/verification routes in src/index.ts', e);
}
// Mount settings routes under admin namespace for parity with legacy app.js
try {
    // require is used to allow loading the JS route which expects CommonJS
    // and uses middleware/requireAuth which is CommonJS in server root
    // We use .default if it's an ES module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const settingsRoutes = require('../routes/settingsRoutes');
    const requireAuth = require('../middleware/requireAuth');
    app.use('/api/admin/settings', requireAuth, settingsRoutes);
    // Mount officials routes (created as CommonJS in server/routes/officials.js)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const officialsRoutes = require('../routes/officials');
        app.use('/api/admin/officials', requireAuth, officialsRoutes);
    }
    catch (e) {
        console.error('Failed to mount /api/admin/officials routes in src/index.ts', e);
    }
}
catch (e) {
    console.error('Failed to mount /api/admin/settings routes in src/index.ts', e);
}
// Serve Templates static (so client refs like /Templates/default-avatar.png resolve)
app.use('/Templates', express_2.default.static(path_1.default.join(process.cwd(), 'client', 'public', 'Templates')));
// Public announcements listing
app.use('/api/announcements', announcementRoutes_1.default);
// Serve uploaded files
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Serve React client build when running in production (Hostinger will place the
// client build at `client/build` relative to project root). This allows the
// same Node app to serve API routes and the frontend.
if (process.env.NODE_ENV === 'production') {
    const clientBuildPath = path_1.default.join(process.cwd(), 'client', 'build');
    try {
        app.use(express_1.default.static(clientBuildPath));
        app.get('*', (_req, res) => {
            res.sendFile(path_1.default.join(clientBuildPath, 'index.html'));
        });
        console.log('Serving client build from', clientBuildPath);
    }
    catch (e) {
        console.warn('Could not serve client build:', e && e.message);
    }
}
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
