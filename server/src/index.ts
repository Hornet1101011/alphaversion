import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Load environment variables from .env file in server root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.set('trust proxy', 1); // Trust only the first proxy (safer for local dev)
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
// Configure CORS: allow the frontend origin from env var or default to localhost
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
import expressStatic from 'express';

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay_system';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Retry connection after 5 seconds
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Ensure processed_documents GridFS bucket exists (collections and indexes)
mongoose.connection.on('connected', async () => {
  try {
    const db: any = (mongoose.connection as any).db;
    if (!db) {
      console.warn('MongoDB db not available to ensure processed_documents bucket');
      return;
    }
    const filesName = 'processed_documents.files';
    const chunksName = 'processed_documents.chunks';

    const collList = await db.listCollections({}).toArray();
    const collNames = collList.map((c: any) => c.name);

    if (!collNames.includes(filesName)) {
      console.log('Creating collection', filesName);
      try { await db.createCollection(filesName); } catch (e: any) { console.warn('createCollection files failed', e && e.message); }
    }
    if (!collNames.includes(chunksName)) {
      console.log('Creating collection', chunksName);
      try { await db.createCollection(chunksName); } catch (e: any) { console.warn('createCollection chunks failed', e && e.message); }
    }

    // Ensure indexes on files collection
    try {
      const filesColl = db.collection(filesName);
      await filesColl.createIndex({ filename: 1 });
      await filesColl.createIndex({ uploadDate: 1 });
      await filesColl.createIndex({ 'metadata.sourceFileId': 1 });
    } catch (e: any) {
      console.warn('Failed to create indexes on processed_documents.files', e && e.message);
    }

    // Ensure unique index on chunks (files_id + n)
    try {
      const chunksColl = db.collection(chunksName);
      await chunksColl.createIndex({ files_id: 1, n: 1 }, { unique: true });
    } catch (e: any) {
      console.warn('Failed to create index on processed_documents.chunks', e && e.message);
    }

    console.log('Ensured processed_documents GridFS bucket collections and indexes.');
  } catch (err: any) {
    console.error('Error ensuring processed_documents bucket', err && err.message);
  }
});

// Import routes
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';
import documentRequestRoutes from './routes/documentRequestRoutes';
import requestRoutes from './routes/requestRoutes';
import inquiryRoutes from './routes/inquiryRoutes';
import myInquiryRoutes from './routes/myInquiryRoutes';
import adminRoutes from './routes/adminRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import residentsRoutes from './routes/residents';
// Import the TS module explicitly to avoid accidentally loading a duplicated .js file
import notificationRoutes from './routes/notificationRoutes';
import activityLogRoutes from './routes/activityLogRoutes';
import announcementRoutes from './routes/announcementRoutes';

// WebSocket setup

// User socket tracking
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register-user', (userId: string) => {
    if (!userId) return;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);
    socket.data.userId = userId;
    console.log(`User ${userId} registered socket ${socket.id}`);
  });

  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    if (userId && userSockets.has(userId)) {
      userSockets.get(userId)!.delete(socket.id);
      if (userSockets.get(userId)!.size === 0) userSockets.delete(userId);
      console.log(`User ${userId} disconnected socket ${socket.id}`);
    } else {
      console.log('Client disconnected:', socket.id);
    }
  });
});

// Make io and userSockets accessible in routes/controllers
export { io, userSockets };


// Routes
// Public fallback for notifications (keep this before notification routes are mounted)
app.get('/api/notifications/fallback', (_req, res) => {
  return res.json([]);
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
// Mount processed documents routes (metadata + GridFS streaming + upload)
try {
  // Use require because the route is implemented in CommonJS under server/src/routes
  // and exports an Express router
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const processedDocs = require('./routes/processedDocuments');
  if (processedDocs) app.use('/api/processed-documents', processedDocs);
} catch (e) {
  console.error('Failed to mount /api/processed-documents routes in src/index.ts', e);
}
app.use('/api/document-requests', documentRequestRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/inquiries', myInquiryRoutes);
app.use('/api/admin', adminRoutes);
// Mount public officials route so unauthenticated pages (login) can fetch officials
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const publicOfficials = require('../routes/publicOfficials');
  if (publicOfficials) app.use('/api/officials', publicOfficials);
} catch (e) {
  console.error('Failed to mount /api/officials public route in src/index.ts', e);
}
app.use('/api/analytics', analyticsRoutes);
app.use('/api/resident', residentsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
// Verification routes: resident uploads and admin actions
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const verificationRoutes = require('./routes/verificationRoutes');
  if (verificationRoutes) app.use('/api/verification', verificationRoutes.default || verificationRoutes);
} catch (e) {
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
  } catch (e) {
    console.error('Failed to mount /api/admin/officials routes in src/index.ts', e);
  }
} catch (e) {
  console.error('Failed to mount /api/admin/settings routes in src/index.ts', e);
}
// Serve Templates static (so client refs like /Templates/default-avatar.png resolve)
app.use('/Templates', expressStatic.static(path.join(process.cwd(), 'client', 'public', 'Templates')));
// Public announcements listing
app.use('/api/announcements', announcementRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve React client build when running in production (Hostinger will place the
// client build at `client/build` relative to project root). This allows the
// same Node app to serve API routes and the frontend.
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(process.cwd(), 'client', 'build');
  try {
    app.use(express.static(clientBuildPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
    console.log('Serving client build from', clientBuildPath);
  } catch (e) {
    console.warn('Could not serve client build:', e && (e as Error).message);
  }
}

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
