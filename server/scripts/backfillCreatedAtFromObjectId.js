/*
  backfillCreatedAtFromObjectId.js
  Safe script to populate createdAt/updatedAt for Resident documents that are missing timestamps.

  Usage (from server folder):
    node scripts/backfillCreatedAtFromObjectId.js

  The script will:
  - connect to MongoDB using MONGODB_URI from environment or default
  - find Resident documents where createdAt is null/undefined
  - compute a timestamp from the document _id (ObjectId.getTimestamp())
  - update the document with createdAt and updatedAt set to that timestamp
  - log a summary

  NOTE: This mutates data. Back up your DB if needed. Run in a maintenance window.
*/

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay_system';

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Load Resident model from compiled TS or mongoose registry
  let Resident;
  try {
    Resident = require('../dist/models/Resident');
    Resident = Resident && (Resident.Resident || Resident.default || Resident);
  } catch (e) {
    try {
      Resident = mongoose.model('Resident');
    } catch (err) {
      console.error('Failed to load Resident model:', err);
      process.exit(1);
    }
  }

  const cursor = Resident.find({ createdAt: { $exists: false } }).cursor();
  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      const oid = doc._id;
      const ts = oid.getTimestamp ? oid.getTimestamp() : new Date();
      await Resident.updateOne({ _id: doc._id }, { $set: { createdAt: ts, updatedAt: ts } });
      count++;
    } catch (err) {
      console.error('Failed to update doc', doc._id, err);
    }
  }

  console.log(`Backfilled ${count} resident documents with createdAt/updatedAt`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
