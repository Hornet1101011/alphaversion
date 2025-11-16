// Script to check and fix missing fullName, username, and barangayID in User documents
// Usage: node fixUsers.js

const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/YOUR_DB_NAME'; // <-- Replace with your actual DB name
const User = require('./src/models/User').User;

async function fixUsers() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await User.find({});
  let updated = 0;
  for (const user of users) {
    let changed = false;
    if (!user.fullName || user.fullName === '') {
      user.fullName = user.username || user.email || 'Unknown';
      changed = true;
    }
    if (!user.username || user.username === '') {
      user.username = user.email ? user.email.split('@')[0] : 'user' + user._id;
      changed = true;
    }
    if (!user.barangayID || user.barangayID === '') {
      user.barangayID = 'UNKNOWN';
      changed = true;
    }
    if (changed) {
      await user.save();
      updated++;
      console.log(`Updated user ${user._id}`);
    }
  }
  console.log(`Done. Updated ${updated} users.`);
  mongoose.disconnect();
}

fixUsers().catch(err => {
  console.error('Error:', err);
  mongoose.disconnect();
});
