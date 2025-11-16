"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = require("../models/User");
async function createAdmin() {
    // Connect to MongoDB first
    await mongoose_1.default.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion');
    // Log current database name
    console.log('Connected to DB:', mongoose_1.default.connection.name);
    // Log all users for debugging
    const allUsers = await User_1.User.find({});
    console.log('Current users:', allUsers);
    const existing = await User_1.User.findOne({ role: 'admin' });
    if (existing) {
        console.log('Admin already exists:', existing.username);
        return;
    }
    const password = 'admin123!'; // Change this after first login
    const hashed = await bcrypt_1.default.hash(password, 10);
    const admin = new User_1.User({
        fullName: 'Admin User',
        role: 'admin',
        username: 'admin',
        password: hashed,
        email: 'admin@yourdomain.com',
        barangayID: '0000',
    });
    await admin.save();
    console.log('Admin created: username=admin, password=admin123!');
}
createAdmin().then(() => mongoose_1.default.disconnect());
