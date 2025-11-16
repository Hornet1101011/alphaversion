import mongoose from 'mongoose';
import { User } from '../models/User';
import { Resident } from '../models/Resident';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/alphaversion';

async function backfillResidents() {
  await mongoose.connect(MONGO_URI);
  const users = await User.find({ role: 'resident' });
  let created = 0;
  for (const user of users) {
    // Check if a Resident document exists for this user (by barangayID or email)
    const exists = await Resident.findOne({
      $or: [
        { barangayID: user.barangayID },
        { email: user.email }
      ]
    });
    if (!exists) {
      await Resident.create({
        firstName: user.fullName?.split(' ')[0] || '',
        lastName: user.fullName?.split(' ').slice(-1)[0] || '',
        barangayID: user.barangayID,
        email: user.email,
        contactNumber: user.contactNumber,
        address: user.address,
      });
      created++;
    }
  }
  console.log(`Backfill complete. Created ${created} Resident containers.`);
  await mongoose.disconnect();
}

backfillResidents().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
