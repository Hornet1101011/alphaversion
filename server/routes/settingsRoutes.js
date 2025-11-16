const express = require('express');
const router = express.Router();
const isAdmin = require('../middleware/isAdmin');
const { encryptText, decryptText } = require('../utils/cryptoHelper');
const SystemSetting = require('../models/SystemSetting');
const AuditLog = require('../models/AuditLog');
const nodemailer = require('nodemailer');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Simple validators
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Log requests to settings routes for debugging (method, url, timestamp, and user id if present)
router.use((req, res, next) => {
  try {
    const ts = new Date().toISOString();
    const userId = req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : 'anon';
    console.log(`[Settings API] ${ts} ${req.method} ${req.originalUrl} user=${userId}`);
  } catch (e) {
    console.error('Settings API logger error', e);
  }
  next();
});

// Helper: filter smtp password presence
function sanitizeForClient(setting) {
  const s = setting.toObject ? setting.toObject() : { ...setting };
  if (s.smtp) {
    s.smtp = { ...s.smtp };
    s.smtp.passwordSet = !!s.smtp.encryptedPassword;
    delete s.smtp.encryptedPassword;
  }
  return s;
}

// GET /api/settings
router.get('/', isAdmin, async (req, res) => {
  try {
    let settings = await SystemSetting.findOne().lean();
    if (!settings) {
      // return default shape
      settings = new SystemSetting();
    }
    return res.json(sanitizeForClient(settings));
  } catch (err) {
    console.error('GET /api/settings error', err);
    return res.status(500).json({ message: 'Failed to load settings' });
  }
});

// Admin-only debug: return sanitized SMTP config (do NOT include encryptedPassword)
// Use this to verify what SMTP fields are stored in the DB without exposing secrets.
router.get('/smtp-debug', isAdmin, async (req, res) => {
  try {
    const settings = await SystemSetting.findOne().lean();
    if (!settings || !settings.smtp) return res.json({ smtp: null });
    const smtp = settings.smtp || {};
    return res.json({
      host: smtp.host || null,
      port: smtp.port || null,
      secure: !!smtp.secure,
      user: smtp.user || null,
      passwordSet: !!smtp.encryptedPassword || !!smtp.password,
      hasEncryptedPassword: !!smtp.encryptedPassword
    });
  } catch (err) {
    console.error('GET /api/admin/settings/smtp-debug error', err);
    return res.status(500).json({ message: 'Failed to read SMTP debug info' });
  }
});

// Validate numeric fields helper
function validateSettingsPayload(body) {
  const errors = [];
  if (body.contactEmail && !emailRegex.test(body.contactEmail)) errors.push('Invalid contactEmail');
  if (body.maxDocumentRequestsPerUser != null && !(Number(body.maxDocumentRequestsPerUser) > 0)) errors.push('maxDocumentRequestsPerUser must be > 0');
  if (body.documentProcessingDays != null && !(Number(body.documentProcessingDays) > 0)) errors.push('documentProcessingDays must be > 0');
  if (body.maxAccountsPerIP != null && !(Number(body.maxAccountsPerIP) > 0)) errors.push('maxAccountsPerIP must be > 0');
  return errors;
}

// Helper to record audit
async function recordAudit(userId, action, details, ip) {
  try {
    await AuditLog.create({ userId, action, details, ip });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
}

// PUT /api/settings (full upsert)
router.put('/', isAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const errors = validateSettingsPayload(payload);
    if (errors.length) return res.status(400).json({ message: 'Validation error', errors });

    // handle smtp password plaintext
    if (payload.smtp && payload.smtp.password) {
      if (!process.env.SETTINGS_ENCRYPTION_KEY) {
        return res.status(500).json({ message: 'Encryption key not configured' });
      }
      try {
        payload.smtp.encryptedPassword = encryptText(String(payload.smtp.password), process.env.SETTINGS_ENCRYPTION_KEY);
      } catch (e) {
        console.error('Failed to encrypt smtp password', e);
        return res.status(500).json({ message: 'Failed to encrypt smtp password' });
      }
      delete payload.smtp.password;
    }

    // perform upsert
    const before = await SystemSetting.findOne().lean();
    const updated = await SystemSetting.findOneAndUpdate({}, payload, { new: true, upsert: true, setDefaultsOnInsert: true });

    // compute a simple diff for audit
    const diff = { before, after: updated.toObject ? updated.toObject() : updated };
    await recordAudit(req.user?._id, 'update_settings', diff, req.ip || req.headers['x-forwarded-for']);

    return res.json(sanitizeForClient(updated));
  } catch (err) {
    console.error('PUT /api/settings error', err);
    return res.status(500).json({ message: 'Failed to save settings' });
  }
});

// PATCH /api/settings (partial update)
router.patch('/', isAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const errors = validateSettingsPayload(payload);
    if (errors.length) return res.status(400).json({ message: 'Validation error', errors });

    // handle smtp.password plaintext: encrypt to encryptedPassword
    if (payload.smtp && payload.smtp.password) {
      if (!process.env.SETTINGS_ENCRYPTION_KEY) {
        return res.status(500).json({ message: 'Encryption key not configured' });
      }
      try {
        payload['smtp.encryptedPassword'] = encryptText(String(payload.smtp.password), process.env.SETTINGS_ENCRYPTION_KEY);
      } catch (e) {
        console.error('Failed to encrypt smtp password', e);
        return res.status(500).json({ message: 'Failed to encrypt smtp password' });
      }
      delete payload.smtp.password;
    }

    const before = await SystemSetting.findOne().lean();
    const updated = await SystemSetting.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const diff = { before, after: updated.toObject ? updated.toObject() : updated };
    await recordAudit(req.user?._id, 'patch_settings', diff, req.ip || req.headers['x-forwarded-for']);
    return res.json(sanitizeForClient(updated));
  } catch (err) {
    console.error('PATCH /api/settings error', err);
    return res.status(500).json({ message: 'Failed to update settings' });
  }
});

// POST /api/settings/test-smtp
// Protect test-smtp endpoint with rate limiter: 5 requests per hour per IP
// Allow a higher limit for SMTP tests to avoid quick lockouts during debugging
// POST /api/settings/test-smtp
// This endpoint is admin-only; do not apply the per-IP rate limiter to admins so admins can freely debug SMTP settings.
router.post('/test-smtp', isAdmin, async (req, res) => {
  try {
    const to = req.body?.to;
    const settings = await SystemSetting.findOne().lean();
    if (!settings || !settings.smtp || !settings.smtp.host) return res.status(400).json({ message: 'SMTP not configured' });

    const smtp = settings.smtp;
    let smtpPassword = null;
    // Prefer encryptedPassword, but allow legacy plaintext smtp.password if present (helpful during config/debug)
    if (smtp.encryptedPassword) {
      if (!process.env.SETTINGS_ENCRYPTION_KEY) {
        console.error('SMTP test: SETTINGS_ENCRYPTION_KEY missing but encryptedPassword exists');
        return res.status(500).json({ message: 'Encryption key not configured for SMTP password' });
      }
      try {
        smtpPassword = decryptText(smtp.encryptedPassword, process.env.SETTINGS_ENCRYPTION_KEY);
      } catch (e) {
        console.error('Failed to decrypt smtp password', e);
        return res.status(500).json({ message: 'Failed to decrypt smtp password' });
      }
    } else if (smtp.password) {
      // fallback: developer/admin may have saved plaintext password in DB during manual edits
      smtpPassword = smtp.password;
    }

    // show sanitized smtp config in server logs for debugging
    try {
      console.log('SMTP test config:', { host: smtp.host, port: smtp.port || 587, secure: !!smtp.secure, user: smtp.user ? smtp.user : null });
    } catch (e) {}

    const transportOptions = {
      host: smtp.host,
      port: smtp.port || 587,
      secure: !!smtp.secure,
    };
    // only set auth when both user and password are available
    if (smtp.user && smtpPassword) {
      transportOptions.auth = { user: smtp.user, pass: smtpPassword };
    }
    // allow optional tls settings in smtp config (useful for self-signed servers)
    if (smtp.tls && typeof smtp.tls === 'object') transportOptions.tls = smtp.tls;
    // enable debug/logging if DEBUG_SMTP env var is truthy
    if (process.env.DEBUG_SMTP) {
      transportOptions.logger = true;
      transportOptions.debug = true;
    }

    const transporter = nodemailer.createTransport(transportOptions);

    const sendTo = to || settings.contactEmail || (req.user && req.user.email) || 'no-reply@example.com';
    const html = `<p>Test Email from Barangay System</p><p>Time: ${new Date().toISOString()}</p><p>Site: ${settings.siteName || ''}</p>`;

    try {
      await transporter.sendMail({ from: `${smtp.fromName || settings.siteName || 'Barangay'} <${settings.contactEmail || smtp.user || 'no-reply@example.com'}>`, to: sendTo, subject: 'Test Email from Barangay System', html });
      return res.json({ success: true, message: 'SMTP test sent' });
    } catch (err) {
      // Log full error on server for debugging (sanitized in response)
      console.error('SMTP test failed', err && err.message ? err.message : err);
      const serverMsg = err && err.message ? String(err.message).slice(0, 300) : 'SMTP test failed';
      return res.status(500).json({ success: false, message: serverMsg });
    }
  } catch (err) {
    console.error('POST /api/settings/test-smtp error', err);
    return res.status(500).json({ message: 'Failed to run SMTP test' });
  }
});

module.exports = router;
