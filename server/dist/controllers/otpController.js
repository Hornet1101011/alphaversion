"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.verifyOtpAndEmailNewPassword = verifyOtpAndEmailNewPassword;
const User_1 = require("../models/User");
const PasswordResetToken_1 = require("../models/PasswordResetToken");
const EmailService_1 = require("../services/EmailService");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
    try {
        const { email, mode } = req.body; // mode: 'link' (default) or 'otp'
        if (!email)
            return res.status(400).json({ message: 'Email is required' });
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('forgotPassword: email not found, returning generic response for', email);
            return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' }); // avoid enumeration
        }
        // Support two modes: 'link' (default) or 'otp' (numeric 6-digit code)
        let token;
        let tokenHash;
        let expiresAt;
        if (mode === 'otp') {
            // generate a 6-digit numeric OTP (zero-padded)
            const otpNum = crypto_1.default.randomInt(0, 1000000);
            token = String(otpNum).padStart(6, '0');
            tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes for OTP
            await PasswordResetToken_1.PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });
            const html = `<p>You requested a password reset. Use the 6-digit code below to reset your password. This code expires in 10 minutes.</p>
      <h2 style="letter-spacing:4px">${token}</h2>
      <p>If you didn't request this, you can safely ignore this email.</p>`;
            // send email containing OTP
            try {
                await (0, EmailService_1.sendMail)(user.email, 'Your password reset code', html);
            }
            catch (emailErr) {
                console.error('Failed to send reset OTP email', emailErr);
                // continue - do not leak email sending errors
            }
        }
        else {
            // default: link-token flow (existing behavior)
            token = crypto_1.default.randomBytes(32).toString('hex');
            tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
            expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            await PasswordResetToken_1.PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });
            // include the raw token in the reset link (raw token is emailed once)
            const resetLink = `${process.env.FRONTEND_URL || ''}/reset-password/${token}`;
            const html = `<p>You requested a password reset. Click the link below to reset your password. This link expires in 15 minutes.</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>`;
            // send email
            try {
                await (0, EmailService_1.sendMail)(user.email, 'Password reset request', html);
            }
            catch (emailErr) {
                console.error('Failed to send reset email', emailErr);
                // continue - do not leak email sending errors
            }
        }
        console.log('forgotPassword: reset token created for userId=', String(user._id));
        return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }
    catch (err) {
        console.error('forgotPassword error', err);
        return res.status(500).json({ message: 'Server error' });
    }
}
// POST /api/auth/reset-password/:token
async function resetPassword(req, res) {
    try {
        // token may be in URL param (link flow) or in body (OTP or client-posted token)
        const tokenFromParams = req.params && req.params.token;
        const token = tokenFromParams || req.body?.token;
        const { password } = req.body;
        if (!token || !password)
            return res.status(400).json({ message: 'Token and password are required' });
        // Look up token document
        // Hash incoming token and look up by tokenHash
        const incomingHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const tokenDoc = await PasswordResetToken_1.PasswordResetToken.findOne({ tokenHash: incomingHash });
        if (!tokenDoc) {
            console.log('resetPassword: token not found (hash)', incomingHash);
            return res.status(404).json({ message: 'Invalid or expired token' });
        }
        if (tokenDoc.expiresAt.getTime() < Date.now()) {
            console.log('resetPassword: token expired for tokenHash=', incomingHash);
            return res.status(410).json({ message: 'Token has expired' });
        }
        const user = await User_1.User.findById(tokenDoc.userId);
        if (!user) {
            console.log('resetPassword: user not found for token=', token);
            return res.status(404).json({ message: 'User not found' });
        }
        // server-side password strength validation (require strong password)
        // at minimum: 8+ chars, upper, lower, number, special
        const strongPwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!strongPwdRegex.test(password)) {
            return res.status(400).json({ message: 'Password does not meet complexity requirements' });
        }
        // hash password
        const salt = await bcryptjs_1.default.genSalt(12);
        const hash = await bcryptjs_1.default.hash(password, salt);
        user.password = hash;
        await user.save();
        // remove token document
        await PasswordResetToken_1.PasswordResetToken.deleteOne({ _id: tokenDoc._id });
        console.log('resetPassword: password reset successful for userId=', String(user._id));
        return res.json({ message: 'Password has been reset successfully' });
    }
    catch (err) {
        console.error('resetPassword error', err);
        return res.status(500).json({ message: 'Server error' });
    }
}
// POST /api/auth/verify-otp
// Accepts { token } (numeric OTP) and will, if valid, generate a new random password,
// set it on the user account (hashed), delete the token document, and email the new password
async function verifyOtpAndEmailNewPassword(req, res) {
    try {
        const { token } = req.body;
        if (!token)
            return res.status(400).json({ message: 'Token is required' });
        // Hash incoming token and look up the token doc
        const incomingHash = crypto_1.default.createHash('sha256').update(String(token)).digest('hex');
        const tokenDoc = await PasswordResetToken_1.PasswordResetToken.findOne({ tokenHash: incomingHash });
        if (!tokenDoc) {
            console.log('verifyOtp: token not found (hash)', incomingHash);
            return res.status(404).json({ message: 'Invalid or expired token' });
        }
        if (tokenDoc.expiresAt.getTime() < Date.now()) {
            console.log('verifyOtp: token expired for tokenHash=', incomingHash);
            return res.status(410).json({ message: 'Token has expired' });
        }
        const user = await User_1.User.findById(tokenDoc.userId);
        if (!user) {
            console.log('verifyOtp: user not found for token=', token);
            return res.status(404).json({ message: 'User not found' });
        }
        // Generate a secure random password that meets complexity rules
        function generatePassword(len = 12) {
            const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const lower = 'abcdefghijklmnopqrstuvwxyz';
            const digits = '0123456789';
            const symbols = '!@#$%^&*()-_=+[]{}<>?';
            const all = upper + lower + digits + symbols;
            // ensure at least one from each set
            const parts = [
                upper[crypto_1.default.randomInt(0, upper.length)],
                lower[crypto_1.default.randomInt(0, lower.length)],
                digits[crypto_1.default.randomInt(0, digits.length)],
                symbols[crypto_1.default.randomInt(0, symbols.length)],
            ];
            while (parts.join('').length < len) {
                parts.push(all[crypto_1.default.randomInt(0, all.length)]);
            }
            // shuffle
            for (let i = parts.length - 1; i > 0; i--) {
                const j = crypto_1.default.randomInt(0, i + 1);
                const tmp = parts[i];
                parts[i] = parts[j];
                parts[j] = tmp;
            }
            return parts.join('');
        }
        const newPassword = generatePassword(12);
        // Hash new password and save
        const salt = await bcryptjs_1.default.genSalt(12);
        const hash = await bcryptjs_1.default.hash(newPassword, salt);
        user.password = hash;
        await user.save();
        // delete token so it cannot be reused
        await PasswordResetToken_1.PasswordResetToken.deleteOne({ _id: tokenDoc._id });
        // Email the new password to the user
        const html = `<p>Your password has been reset as requested. A new temporary password has been generated for your account. Please log in and change it immediately.</p>
      <p><strong>Temporary password:</strong> <code style="letter-spacing:2px">${newPassword}</code></p>
      <p>If you didn't request this, contact support immediately.</p>`;
        try {
            await (0, EmailService_1.sendMail)(user.email, 'Your new temporary password', html);
        }
        catch (emailErr) {
            console.error('Failed to send new-password email', emailErr);
            // proceed — user password has been changed; but return 200 with message advising to check email
        }
        console.log('verifyOtp: new password generated and emailed for userId=', String(user._id));
        return res.json({ message: 'If the code was valid, a temporary password has been emailed to the account.' });
    }
    catch (err) {
        console.error('verifyOtp error', err);
        return res.status(500).json({ message: 'Server error' });
    }
}
