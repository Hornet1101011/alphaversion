require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const passport = require('passport');
const cookieSession = require('cookie-session');
const cors = require('cors');

const app = express();

// Load and validate important env vars
const SETTINGS_ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY;
if (!SETTINGS_ENCRYPTION_KEY) {
  console.warn('WARNING: SETTINGS_ENCRYPTION_KEY is not set. Encrypted settings and SMTP passwords will not work.');
} else if (Buffer.from(SETTINGS_ENCRYPTION_KEY, 'utf8').length !== 32) {
  console.warn('WARNING: SETTINGS_ENCRYPTION_KEY should be 32 bytes. Current length:', Buffer.from(SETTINGS_ENCRYPTION_KEY, 'utf8').length);
}

// SMTP fallback env values (available for services that need immediate defaults)
app.locals.smtpDefaults = {
  host: process.env.SMTP_HOST || '',
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  fromName: process.env.SMTP_FROM_NAME || process.env.SMTP_FROM || '',
};

// Middleware
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieSession({ name: 'session', keys: ['secretKey'], maxAge: 24 * 60 * 60 * 1000 }));
app.use(passport.initialize());
app.use(passport.session());
app.use(cors({ 
  origin: 'http://localhost:3000', 
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // Expose custom headers so the browser/axios can read them
  exposedHeaders: ['Authorization', 'X-Filled-File-Id', 'X-Generated-Doc-Id', 'X-Processed-Doc-Id', 'X-Processed-GridFS-Id']
}));

// Serve static files from client and its subfolders
const path = require('path');
app.use(express.static(path.join(__dirname, '../client')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/javascript', express.static(path.join(__dirname, '../javascript')));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});
// Ensure processed_documents GridFS bucket exists (collections and indexes)
mongoose.connection.on('connected', async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn('MongoDB db not available to ensure processed_documents bucket');
      return;
    }
    const filesName = 'processed_documents.files';
    const chunksName = 'processed_documents.chunks';

    const collList = await db.listCollections({}).toArray();
    const collNames = collList.map(c => c.name);

    if (!collNames.includes(filesName)) {
      console.log('Creating collection', filesName);
      try { await db.createCollection(filesName); } catch (e) { console.warn('createCollection files failed', e && e.message); }
    }
    if (!collNames.includes(chunksName)) {
      console.log('Creating collection', chunksName);
      try { await db.createCollection(chunksName); } catch (e) { console.warn('createCollection chunks failed', e && e.message); }
    }

    // Ensure indexes on files collection
    try {
      const filesColl = db.collection(filesName);
      await filesColl.createIndex({ filename: 1 });
      await filesColl.createIndex({ uploadDate: 1 });
      await filesColl.createIndex({ 'metadata.sourceFileId': 1 });
    } catch (e) {
      console.warn('Failed to create indexes on processed_documents.files', e && e.message);
    }

    // Ensure unique index on chunks (files_id + n)
    try {
      const chunksColl = db.collection(chunksName);
      await chunksColl.createIndex({ files_id: 1, n: 1 }, { unique: true });
    } catch (e) {
      console.warn('Failed to create index on processed_documents.chunks', e && e.message);
    }

    console.log('Ensured processed_documents GridFS bucket collections and indexes.');
  } catch (err) {
    console.error('Error ensuring processed_documents bucket', err && err.message);
  }
});


// Template routes
app.use('/api/templates', require('./src/routes/templates.ts'));
app.use('/api/gridfs', require('./src/routes/gridfs.js'));

// Document routes
app.use('/api/documents', require('./src/routes/documents.js'));
// Generated documents (metadata + GridFS streaming)
try {
  app.use('/api/generated-documents', require('./src/routes/generatedDocuments'));
} catch (e) {
  console.error('Failed to mount /api/generated-documents route', e);
}
// Processed documents (metadata + GridFS streaming)
try {
  app.use('/api/processed-documents', require('./src/routes/processedDocuments'));
} catch (e) {
  console.error('Failed to mount /api/processed-documents route', e);
}

// Routes
app.get('/', (req, res) => {
  res.send('Alphaversion backend running');
});
app.use('/api/messages', require('./src/routes/messageRoutes').default);
app.use('/api/inquiries', require('./src/routes/inquiryRoutes').default);
app.use('/api/resident', require('./src/routes/residents').default);
// Analytics routes
app.use('/api/analytics', require('./src/routes/analyticsRoutes'));
function safeUseRoute(path, routeModule) {
  if (typeof routeModule === 'function' || (routeModule && typeof routeModule === 'object' && typeof routeModule.use === 'function')) {
    app.use(path, routeModule);
  } else {
    console.error(`Invalid router for ${path}`);
  }
}

// safeUseRoute('/api/resident', require('./dist/routes/residents.js').default); // Commented out to avoid double registration
safeUseRoute('/api/document-requests', require('./dist/routes/documentRequestRoutes.js').default);
safeUseRoute('/api/auth', require('./dist/routes/authRoutes.js').default);
safeUseRoute('/api/logs', require('./dist/routes/logs.js').default);
safeUseRoute('/api/admin', require('./dist/routes/adminRoutes.js').default);

// Public officials endpoint for unauthenticated pages (e.g., login preview)
try {
  const publicOfficials = require('./routes/publicOfficials');
  app.use('/api/officials', publicOfficials);
} catch (e) {
  console.error('Failed to mount /api/officials public route', e);
}

// Settings routes (require authentication first so req.user is populated for isAdmin)
try {
  const requireAuth = require('./middleware/requireAuth');
  const settingsRoutes = require('./routes/settingsRoutes');
  app.use('/api/settings', requireAuth, settingsRoutes);
  // Also mount under admin namespace so client-side calls to /api/admin/settings resolve
  app.use('/api/admin/settings', requireAuth, settingsRoutes);
  // Mount officials admin routes
  try {
    const officialsRoutes = require('./routes/officials');
    app.use('/api/admin/officials', requireAuth, officialsRoutes);
  } catch (e) {
    console.error('Failed to mount /api/admin/officials routes', e);
  }
} catch (e) {
  console.error('Failed to mount /api/settings routes', e);
}

// Optional public settings endpoint for quick local debugging.
// Enable by setting DEBUG_PUBLIC_SETTINGS=true in the server environment.
if (process.env.DEBUG_PUBLIC_SETTINGS === 'true') {
  try {
    const SystemSetting = require('./src/models/SystemSetting');
    app.get('/api/settings/public', async (req, res) => {
      try {
        let settings = await SystemSetting.findOne().lean();
        if (!settings) settings = new SystemSetting();
        // Sanitize SMTP password presence similar to settingsRoutes.sanitizeForClient
        if (settings && settings.smtp) {
          settings.smtp = { ...settings.smtp };
          settings.smtp.passwordSet = !!settings.smtp.encryptedPassword;
          delete settings.smtp.encryptedPassword;
        }
        return res.json(settings);
      } catch (err) {
        console.error('Public settings endpoint error', err);
        return res.status(500).json({ message: 'Failed to load settings' });
      }
    });
    console.log('DEBUG_PUBLIC_SETTINGS endpoint enabled at GET /api/settings/public');
  } catch (e) {
    console.error('Failed to create public settings endpoint', e);
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
