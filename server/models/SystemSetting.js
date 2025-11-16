const mongoose = require('mongoose');

const smtpSchema = new mongoose.Schema({
  host: { type: String },
  port: { type: Number },
  secure: { type: Boolean },
  user: { type: String },
  encryptedPassword: { type: String },
  fromName: { type: String },
});

const systemSettingSchema = new mongoose.Schema({
  siteName: { type: String },
  barangayName: { type: String },
  barangayAddress: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  maintenanceMode: { type: Boolean, default: false },
  allowRegistrations: { type: Boolean, default: true },
  requireEmailVerification: { type: Boolean, default: true },
  maxDocumentRequestsPerUser: { type: Number, default: 5 },
  documentProcessingDays: { type: Number, default: 3 },
  // Rate-limit / abuse prevention: whether multiple accounts from same IP are allowed
  allowMultipleAccountsPerIP: { type: Boolean, default: false },
  // Maximum number of accounts allowed per IP when the above is enabled
  maxAccountsPerIP: { type: Number, default: 1 },
  systemNotice: { type: String },
  smtp: { type: smtpSchema, default: {} },
}, { timestamps: true });

// Prevent OverwriteModelError when this file is required multiple times (e.g. ts-node/nodemon)
module.exports = mongoose.models && mongoose.models.SystemSetting
  ? mongoose.model('SystemSetting')
  : mongoose.model('SystemSetting', systemSettingSchema);
