const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in the environment');
  process.exit(2);
}

const opts = {
  // Mongoose will accept the options from the MongoDB driver automatically;
  // leave empty unless you need to set authSource, tls, or other flags.
};

mongoose.connect(uri, opts)
  .then(() => {
    console.log('MongoDB: connection successful');
    return mongoose.disconnect();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('MongoDB: connection error:', err && err.message ? err.message : err);
    process.exit(1);
  });
