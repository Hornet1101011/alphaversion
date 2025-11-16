"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhoneNumber = exports.validateBarangayID = exports.validateUsername = exports.validatePassword = exports.validateEmail = void 0;
// Email validation
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
// Password validation (min 6 chars, 1 number, 1 uppercase, 1 special char)
const validatePassword = (password) => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    return passwordRegex.test(password);
};
exports.validatePassword = validatePassword;
// Username validation (alphanumeric, 4-20 chars)
const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
    return usernameRegex.test(username);
};
exports.validateUsername = validateUsername;
// Barangay ID validation (new format: brgyparian-YYYY-######)
const validateBarangayID = (barangayID) => {
    // Allow case-insensitive match (brgyparian-2025-ABC123) — last segment now alphanumeric (6 chars)
    const barangayIDRegex = /^brgyparian-\d{4}-[A-Za-z0-9]{6}$/i;
    return barangayIDRegex.test(barangayID);
};
exports.validateBarangayID = validateBarangayID;
// Phone number validation (PH format)
const validatePhoneNumber = (phoneNumber) => {
    const phoneRegex = /^(\+63|0)[0-9]{10}$/;
    return phoneRegex.test(phoneNumber);
};
exports.validatePhoneNumber = validatePhoneNumber;
