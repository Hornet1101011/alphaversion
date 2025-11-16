import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay_system';

async function seedNotification() {
  await mongoose.connect(MONGODB_URI);
  const User = require('../models/User').default || require('../models/User').User;
  const Notification = require('../models/Notification').Notification;

  // Find all admin users
  const admins = await User.find({ role: 'admin' });
  if (!admins.length) throw new Error('No admin users found');

  // Find a resident user (requester)
  const resident = await User.findOne({ role: 'resident' });
  if (!resident) throw new Error('No resident user found');

  // Create a notification for each admin
  const notifications = await Promise.all(admins.map(admin =>
    Notification.create({
      user: admin._id,
      type: 'staff_approval',
      message: `${resident.fullName} requested staff access`,
      data: {
        userId: resident._id,
        fullName: resident.fullName,
        email: resident.email,
        username: resident.username
      },
      read: false,
      createdAt: new Date()
    })
  ));
  console.log('Seeded notifications:', notifications);
  await mongoose.disconnect();
}

seedNotification().catch(console.error);
