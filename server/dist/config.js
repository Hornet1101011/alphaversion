"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    PORT: parseInt(process.env.PORT || '5000'),
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay-system',
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key'
};
exports.default = config;
