// Drop old `token_1` index and ensure unique index on `tokenHash`
// Usage: node scripts/drop-old-index.js

const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/barangay_system';
  console.log('Connecting to', uri);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const coll = mongoose.connection.db.collection('passwordresettokens');

  try {
    const before = await coll.indexes();
    console.log('Indexes before:', JSON.stringify(before, null, 2));

    // Try to drop the old index named 'token_1' if present
    const hasTokenIndex = before.some(ix => ix.name === 'token_1');
    if (hasTokenIndex) {
      try {
        await coll.dropIndex('token_1');
        console.log('Dropped index: token_1');
      } catch (dropErr) {
        console.error('Failed to drop token_1 index:', dropErr && dropErr.message ? dropErr.message : dropErr);
      }
    } else {
      console.log('No token_1 index found; nothing to drop');
    }

    // Ensure unique index on tokenHash
    try {
      await coll.createIndex({ tokenHash: 1 }, { unique: true, name: 'tokenHash_1' });
      console.log('Ensured unique index on tokenHash');
    } catch (createErr) {
      console.error('Failed to create tokenHash unique index:', createErr && createErr.message ? createErr.message : createErr);
    }

    const after = await coll.indexes();
    console.log('Indexes after:', JSON.stringify(after, null, 2));
  } catch (err) {
    console.error('Error during index operations:', err && err.message ? err.message : err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
