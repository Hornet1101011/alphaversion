"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDocumentNotification = sendDocumentNotification;
exports.sendMail = sendMail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const mongoose_1 = __importDefault(require("mongoose"));
const SystemSetting_1 = __importDefault(require("../models/SystemSetting"));
// crypto helper (encrypt/decrypt) - commonjs module
// use require to match existing module.exports in utils
// eslint-disable-next-line @typescript-eslint/no-var-requires
// helper lives outside of src at server/utils/cryptoHelper.js
const cryptoHelper = require('../../utils/cryptoHelper');
async function resolveSmtpConfig() {
    // Prefer environment variables if provided
    const envHost = process.env.SMTP_HOST;
    if (envHost) {
        return {
            host: envHost,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            user: process.env.SMTP_USER || undefined,
            pass: process.env.SMTP_PASS || undefined,
            from: process.env.SMTP_FROM || process.env.SMTP_USER || undefined,
        };
    }
    // fallback: read from SystemSetting document in DB
    try {
        // Ensure mongoose connection exists before querying
        if (mongoose_1.default.connection.readyState === 0) {
            // no DB connection
            return null;
        }
        const settings = await SystemSetting_1.default.findOne().lean().exec();
        if (!settings || !settings.smtp || !settings.smtp.host)
            return null;
        const passEncrypted = settings.smtp.encryptedPassword;
        let pass = undefined;
        if (passEncrypted && process.env.SETTINGS_ENCRYPTION_KEY) {
            try {
                pass = cryptoHelper.decryptText(passEncrypted, process.env.SETTINGS_ENCRYPTION_KEY);
            }
            catch (e) {
                console.error('Failed to decrypt SMTP password from SystemSetting:', e);
            }
        }
        return {
            host: settings.smtp.host || '',
            port: settings.smtp.port || 587,
            secure: !!settings.smtp.secure,
            user: settings.smtp.user || undefined,
            pass,
            from: settings.smtp.fromName || settings.smtp.user || undefined,
        };
    }
    catch (err) {
        console.error('resolveSmtpConfig error', err);
        return null;
    }
}
function createTransporterFromConfig(cfg) {
    return nodemailer_1.default.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure === true, // true for 465, false for other ports
        // Only supply auth when both user and pass are available. Supplying a user without a pass
        // causes Nodemailer to try PLAIN auth with missing credentials which produces a 'Missing credentials for "PLAIN"' error.
        auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
}
async function sendDocumentNotification(to, status, documentType, notes) {
    const cfg = await resolveSmtpConfig();
    if (!cfg) {
        console.error('No SMTP config available; cannot send document notification');
        return;
    }
    // Validate credentials before attempting to send. If user is provided without a pass,
    // avoid attempting an authenticated login which will fail with a PLAIN credential error.
    if (cfg.user && !cfg.pass) {
        console.error('SMTP configuration incomplete: user is set but pass is missing. Aborting send.');
        throw new Error('SMTP configuration incomplete (missing password)');
    }
    const transporter = createTransporterFromConfig(cfg);
    const subject = `Your document request has been ${status}`;
    const body = `
    <p>Dear user,</p>
    <p>Your request for <strong>${documentType}</strong> has been <strong>${status}</strong>.</p>
    ${notes ? `<p>Notes: ${notes}</p>` : ''}
    <p>If you have questions, please contact support.</p>
    <p>Thank you.</p>
  `;
    await transporter.sendMail({
        from: cfg.from || cfg.user,
        to,
        subject,
        html: body,
    });
}
async function sendMail(to, subject, html) {
    const cfg = await resolveSmtpConfig();
    if (!cfg) {
        console.error('No SMTP config available; cannot send email');
        return;
    }
    if (cfg.user && !cfg.pass) {
        console.error('SMTP configuration incomplete: user is set but pass is missing. Aborting send.');
        throw new Error('SMTP configuration incomplete (missing password)');
    }
    const transporter = createTransporterFromConfig(cfg);
    await transporter.sendMail({
        from: cfg.from || cfg.user,
        to,
        subject,
        html,
    });
}
