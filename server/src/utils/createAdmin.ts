import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/User';

async function createAdmin() {
  // Connect to MongoDB first
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion');

  // Log current database name
  console.log('Connected to DB:', mongoose.connection.name);

  // Log all users for debugging
  const allUsers = await User.find({});
  console.log('Current users:', allUsers);

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('Admin already exists:', existing.username);
    return;
  }
  const password = 'admin123!'; // Change this after first login
  const hashed = await bcrypt.hash(password, 10);
  const admin = new User({
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

createAdmin().then(() => mongoose.disconnect());
